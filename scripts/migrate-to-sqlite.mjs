import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, basename } from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'
import { initDb, getDb, getTableList } from '../lib/db.js'

const __dirname_l = fileURLToPath(new URL('.', import.meta.url))
const LABOS = join(__dirname_l, '..', 'labos')

function readJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null }
}

function readText(p) {
  try { return readFileSync(p, 'utf8') } catch { return null }
}

function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!m) return { meta: {}, body: md }
  const meta = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*"?(.*?)"?\s*$/)
    if (kv) meta[kv[1]] = kv[2]
  }
  return { meta, body: m[2] }
}

console.log('=== SQLite Migration Starting ===')
initDb()
const db = getDb()
db.pragma('foreign_keys = OFF')

// Clear all tables (idempotent)
const tables = getTableList().filter(t => t !== 'schema_version')
const clearAll = db.transaction(() => {
  for (const t of tables) {
    db.prepare('DELETE FROM "' + t + '"').run()
  }
})
clearAll()
console.log('Cleared tables:', tables.join(', '))

let counts = {}

// 1. Students from students.yaml
const studentsYaml = readText(join(LABOS, 'students.yaml'))
if (studentsYaml) {
  const parsed = yaml.load(studentsYaml)
  const students = Array.isArray(parsed) ? parsed : (parsed.students || [])
  const insertStudent = db.prepare('INSERT INTO students (id, name, project, role, password, active) VALUES (@id, @name, @project, @role, @password, @active)')
  const insertMany = db.transaction((rows) => {
    for (const s of rows) {
      insertStudent.run({
        id: s.id || null,
        name: s.name || '',
        project: s.project || '',
        role: s.role || 'grad',
        password: s.password || 'changeme',
        active: s.active === false ? 0 : 1
      })
    }
  })
  insertMany(students)
  counts.students = students.length
  console.log('Migrated students:', students.length)
}

// 2. Reports from reports/sXX/*.md
const reportsDir = join(LABOS, 'reports')
if (existsSync(reportsDir)) {
  const studentDirs = readdirSync(reportsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== 'template')
    .map(d => d.name)
  let reportCount = 0
  const insertReport = db.prepare('INSERT INTO reports (student_id, file_path, period_start, period_end, submitted_at, content) VALUES (@student_id, @file_path, @period_start, @period_end, @submitted_at, @content)')
  for (const sd of studentDirs) {
    const sdir = join(reportsDir, sd)
    const files = readdirSync(sdir).filter(f => f.endsWith('.md'))
    for (const f of files) {
      const fp = join(sdir, f)
      const md = readText(fp)
      if (!md) continue
      const { meta, body } = parseFrontmatter(md)
      insertReport.run({
        student_id: sd,
        file_path: 'reports/' + sd + '/' + f,
        period_start: meta.period_start || '',
        period_end: meta.period_end || '',
        submitted_at: meta.submitted_at || '',
        content: body
      })
      reportCount++
    }
  }
  counts.reports = reportCount
  console.log('Migrated reports:', reportCount)
}

// 3. Summaries from summaries/sXX.json
const summariesDir = join(LABOS, 'summaries')
if (existsSync(summariesDir)) {
  const files = readdirSync(summariesDir).filter(f => f.endsWith('.json'))
  let sumCount = 0
  const insertSummary = db.prepare('INSERT INTO summaries (student_id, report_file, summary, risks_json, suggestions_json, generated_at) VALUES (@student_id, @report_file, @summary, @risks_json, @suggestions_json, @generated_at)')
  for (const f of files) {
    const data = readJson(join(summariesDir, f))
    if (!data) continue
    const sid = f.replace('.json', '')
    insertSummary.run({
      student_id: sid,
      report_file: data.report_file || '',
      summary: data.summary || '',
      risks_json: JSON.stringify(data.risks || []),
      suggestions_json: JSON.stringify(data.suggestions || []),
      generated_at: data.generated_at || ''
    })
    sumCount++
  }
  counts.summaries = sumCount
  console.log('Migrated summaries:', sumCount)
}

// 4. Tasks from tasks.json
const tasksFile = readJson(join(LABOS, 'tasks.json'))
if (tasksFile && tasksFile.tasks) {
  const insertTask = db.prepare('INSERT INTO tasks (task_id, title, description, owner_student_id, owner_name, status, priority, deadline, source, source_ref, project, created_at, updated_at) VALUES (@task_id, @title, @description, @owner_student_id, @owner_name, @status, @priority, @deadline, @source, @source_ref, @project, @created_at, @updated_at)')
  const insertMany = db.transaction((rows) => {
    for (const t of rows) {
      insertTask.run({
        task_id: t.task_id,
        title: t.title || '',
        description: t.description || '',
        owner_student_id: t.owner_student_id || null,
        owner_name: t.owner_name || '',
        status: t.status || 'todo',
        priority: t.priority || 'medium',
        deadline: t.deadline || '',
        source: t.source || 'manual',
        source_ref: t.source_ref || '',
        project: t.project || '',
        created_at: t.created_at || '',
        updated_at: t.updated_at || ''
      })
    }
  })
  insertMany(tasksFile.tasks)
  counts.tasks = tasksFile.tasks.length
  console.log('Migrated tasks:', tasksFile.tasks.length)
}

// 5. Meetings from meetings/
const meetingsDir = join(LABOS, 'meetings')
if (existsSync(meetingsDir)) {
  const mdFiles = readdirSync(meetingsDir).filter(f => f.endsWith('.md') && !f.startsWith('_'))
  let meetingCount = 0
  for (const f of mdFiles) {
    const date = f.replace('.md', '')
    const md = readText(join(meetingsDir, f))
    if (!md) continue
    const actionsFile = readJson(join(meetingsDir, date + '.actions.json'))
    const insertMeeting = db.prepare('INSERT INTO meetings (date, minutes_md, actions_json, decisions_json, status, generated_at) VALUES (@date, @minutes_md, @actions_json, @decisions_json, @status, @generated_at)')
    insertMeeting.run({
      date: date,
      minutes_md: md,
      actions_json: actionsFile ? JSON.stringify(actionsFile.actions || []) : '[]',
      decisions_json: actionsFile ? JSON.stringify(actionsFile.decisions || []) : '[]',
      status: actionsFile ? (actionsFile.status || 'ok') : 'no_actions',
      generated_at: actionsFile ? (actionsFile.generated_at || '') : ''
    })
    meetingCount++
  }
  counts.meetings = meetingCount
  console.log('Migrated meetings:', meetingCount)
}

// 6. Chat messages from chat/sXX.json
const chatDir = join(LABOS, 'chat')
if (existsSync(chatDir)) {
  const files = readdirSync(chatDir).filter(f => f.endsWith('.json'))
  let chatCount = 0
  const insertChat = db.prepare('INSERT INTO chat_messages (student_id, role, content, timestamp) VALUES (@student_id, @role, @content, @timestamp)')
  for (const f of files) {
    const sid = f.replace('.json', '')
    const messages = readJson(join(chatDir, f))
    if (!Array.isArray(messages)) continue
    const insertMany = db.transaction((rows) => {
      for (const m of rows) {
        insertChat.run({
          student_id: sid,
          role: m.role || 'user',
          content: m.content || '',
          timestamp: m.timestamp || ''
        })
      }
    })
    insertMany(messages)
    chatCount += messages.length
  }
  counts.chat_messages = chatCount
  console.log('Migrated chat_messages:', chatCount)
}

// 7. Agent chat messages from agent-chat/*.json
const agentChatDir = join(LABOS, 'agent-chat')
if (existsSync(agentChatDir)) {
  const files = readdirSync(agentChatDir).filter(f => f.endsWith('.json'))
  let acCount = 0
  const insertAC = db.prepare('INSERT INTO agent_chat_messages (agent_id, role, content, timestamp) VALUES (@agent_id, @role, @content, @timestamp)')
  for (const f of files) {
    const agentId = f.replace('.json', '')
    const messages = readJson(join(agentChatDir, f))
    if (!Array.isArray(messages)) continue
    const insertMany = db.transaction((rows) => {
      for (const m of rows) {
        insertAC.run({
          agent_id: agentId,
          role: m.role || 'user',
          content: m.content || '',
          timestamp: m.timestamp || ''
        })
      }
    })
    insertMany(messages)
    acCount += messages.length
  }
  counts.agent_chat_messages = acCount
  console.log('Migrated agent_chat_messages:', acCount)
}

// 8. Value cycles from valuecycles/sXX.json
const vcDir = join(LABOS, 'valuecycles')
if (existsSync(vcDir)) {
  const files = readdirSync(vcDir).filter(f => f.endsWith('.json'))
  let vcCount = 0
  const insertVC = db.prepare('INSERT INTO value_cycles (student_id, data_json, updated_at) VALUES (@student_id, @data_json, @updated_at)')
  for (const f of files) {
    const sid = f.replace('.json', '')
    const data = readJson(join(vcDir, f))
    if (!data) continue
    insertVC.run({
      student_id: sid,
      data_json: JSON.stringify(data),
      updated_at: new Date().toISOString()
    })
    vcCount++
  }
  counts.value_cycles = vcCount
  console.log('Migrated value_cycles:', vcCount)
}

// 9. Trajectories from trajectories/*.json
const trajDir = join(LABOS, 'trajectories')
if (existsSync(trajDir)) {
  const files = readdirSync(trajDir).filter(f => f.endsWith('.json'))
  let trajCount = 0
  const insertTraj = db.prepare('INSERT INTO trajectories (actor_type, actor_id, session_type, messages_json, outcome, tags_json, created_at) VALUES (@actor_type, @actor_id, @session_type, @messages_json, @outcome, @tags_json, @created_at)')
  for (const f of files) {
    const data = readJson(join(trajDir, f))
    if (!data) continue
    insertTraj.run({
      actor_type: data.actor_type || '',
      actor_id: data.actor_id || '',
      session_type: data.session_type || '',
      messages_json: JSON.stringify(data.messages || []),
      outcome: JSON.stringify(data.outcome || {}),
      tags_json: JSON.stringify(data.tags || []),
      created_at: data.timestamp || data.created_at || new Date().toISOString()
    })
    trajCount++
  }
  counts.trajectories = trajCount
  console.log('Migrated trajectories:', trajCount)
}

// 10. Submissions from submissions.json
const subData = readJson(join(LABOS, 'submissions.json'))
if (subData && Array.isArray(subData.submissions)) {
  const insertSub = db.prepare('INSERT INTO submissions (student_id, title, journal, status, submitted_at) VALUES (@student_id, @title, @journal, @status, @submitted_at)')
  const insertMany = db.transaction((rows) => {
    for (const s of rows) {
      insertSub.run({
        student_id: s.student_id || '',
        title: s.title || '',
        journal: s.journal || '',
        status: s.status || 'draft',
        submitted_at: s.submitted_at || ''
      })
    }
  })
  insertMany(subData.submissions)
  counts.submissions = subData.submissions.length
  console.log('Migrated submissions:', subData.submissions.length)
}

console.log('\n=== Migration Complete ===')
db.pragma('foreign_keys = ON')
console.log('Counts:', JSON.stringify(counts, null, 2))

// Verify with stats
const stats = {}
for (const t of getTableList()) {
  const row = db.prepare('SELECT COUNT(*) as c FROM "' + t + '"').get()
  stats[t] = row.c
}
console.log('DB stats:', JSON.stringify(stats))
