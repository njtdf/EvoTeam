// server.js - AutoProf Lab Brief v2
// Express 5 + Vue 3 SPA + DeepSeek AI
// Usage: node server.js

import express from 'express'
import { readFileSync, existsSync, statSync } from 'fs'
import { readdirSync } from 'fs'
import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { load as parseYaml } from 'js-yaml'
import { parseReport, scanReportFiles } from './packages/lab-brief/lib/parser.js'
import { evaluateRisks } from './packages/lab-brief/lib/risk.js'
import { generateBrief, renderBriefMarkdown } from './packages/lab-brief/lib/brief.js'
import {
  authenticate, createSession, getSession, destroySession,
  requireAuth, requireRole, setSessionCookie, clearSessionCookie, loadUsers,
} from './lib/auth.js'
import { generateAndSaveSummary, loadSummary } from './lib/summary.js'
import { loadChat, saveMessage } from './lib/chat.js'
import { chatStream, buildChatMessages, hasApiKey } from './lib/ai.js'
import {
  saveMeeting, loadMeeting, loadActions, saveActions, listMeetings, runExtraction,
} from './lib/meeting.js'
import { WebSocketServer } from 'ws'
import {
  loadTasks, createTask, updateTask, deleteTask, getAllTasks, getTasksByStudent,
  getBoardStats, promoteMeetingAction,
} from './lib/kanban.js'
import { getLatestNews } from './lib/rss.js'
import { generateDailyDigest, loadDailyNews } from './lib/news.js'
import { loadSubmissions, createSubmission, updateSubmission, deleteSubmission, getSubmissionStats } from './lib/submissions.js'
import { fetchUnread, createTasksFromEmails, hasImapConfig } from './lib/email.js'
import { getStatus as getSttStatus, appendTranscript, startMeetingSession, endMeetingSession } from './lib/stt.js'
import { generateWeeklyDraft } from './lib/progress.js'
import { generateSeating, loadSeating, listSeatings, deleteSeating } from './lib/seating.js'
import { generateLesson, listLessons, loadLesson, deleteLesson } from './lib/lesson.js'
import { calculateWorkload, loadWorkload, loadCoefficients, saveCoefficients, listWorkloads } from './lib/workload.js'
import { loadInvoices, addInvoice, updateInvoice, deleteInvoice, getInvoiceStats } from './lib/invoice.js'
import { loadMemory, updateMemory, accumulateFromReport, accumulateFromChat, accumulateFromSkill, accumulateFromTask, getContextString, injectContext } from './lib/memory.js'
import { createRoom, listRooms, getRoom, addMessage, joinRoom, leaveRoom, deleteRoom, shouldTriggerAI, buildAIContext, addClient, broadcast } from './lib/chatroom.js'
import { buildStudentContext } from './lib/ai-context.js'
import { getEntityGraph, buildAllEntities, buildRelations, searchEntities, addRelation, removeRelation, applyNaturalLanguage, getOntologyStats } from './lib/ontology.js'
import { trigger as flywheelTrigger, buildFlywheelContext, getFlywheelStats, getFlywheelLog } from './lib/flywheel.js'
import { loadValueCycle, updateValueCycle, loadGroupValueCycle, saveGroupValueCycle, getAllAlignments } from './lib/valuecycle.js'
import { loadCalendarEvents } from './lib/calendar.js'
import { searchTrajectories, getTrajectoryStats, listTrajectories } from './lib/trajectory.js'
import { getDb, initDb, getStats } from './lib/db.js'
import { storeMemory, retrieveMemories, searchMemories, deleteMemory, buildMemoryContext, extractMemoriesFromChat } from './lib/llm-memory.js'
import { indexAll, searchKnowledge, getDocumentStats, getKnowledgeGraph } from './lib/knowledge.js'
import { runAgentLoop } from './lib/agent-loop.js'

import { getRequirementsTemplate, getRequirementCategories, seedGraduationRequirements, updateRequirement, getGraduationSummary, getAllGraduationSummaries, syncToDb as syncGraduationToDb, indexToKb as indexGraduationToKb } from './lib/graduation.js'

import { createDecision, listDecisions, getDecision, updateDecision, deleteDecision, updateOutcome, getAllDecisions, getDecisionStats } from './lib/decisions.js'

import { canTransition, getValidTransitions, transitionTask } from './lib/kanban.js'
import { createPromise, getPromises, fulfillPromise, getOverduePromises, getUpcomingDeadlines, getConsistencyIndex, getAllConsistencyIndices, getGoalTree, autoExtractFromMeeting, getPromiseStats, markOverdue, getPromiseUrgency } from './lib/promise-ledger.js'
import { getStudentProfile, getAllStudentProfiles, getLabGraduationProgress, taskStatusToPct } from './lib/student-profile.js'
import { getLabState, recordReward, getRewards, getLabRewardSummary, deleteReward } from './lib/lab-state.js'
import { recordEvent, recordFromNews, recordFromEmails, getUnprocessed, markProcessed, getRecentEvents, buildExternalContext, getEventStats } from './lib/external-events.js'
import { extractFromAllTrajectories, listExtractedSkills, searchSkills, getSkillStats } from './lib/skill-extractor.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const labosDir = join(__dirname, 'labos')
const app = express()
// Load .env into process.env (no dotenv dependency; matches ai.js direct-read pattern)
;(function loadEnv() {
  const envPath = join(__dirname, '.env')
  if (!existsSync(envPath)) return
  const raw = readFileSync(envPath, 'utf-8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_]+)\s*=\s*(.+)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
})()
const PORT = process.env.PORT || 3000

app.use(express.json({ limit: '2mb' }))
app.use(express.static(join(__dirname, 'public'), {
  setHeaders: (res, filepath) => {
    // Force browser to always revalidate static assets (prevents stale JS/CSS cache)
    res.setHeader('Cache-Control', 'no-cache, must-revalidate')
  }
}))

// Prevent browser from caching HTML pages served via res.sendFile
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, must-revalidate')
  next()
})

// --- Config ---
function loadConfig() {
  const raw = readFileSync(join(__dirname, 'labos', 'cordis.yml'), 'utf-8')
  const parsed = parseYaml(raw)
  const plugin = parsed.plugins?.find(p => p.id === 'lab-brief')
  return plugin?.config || {}
}

function loadStudents() {
  const path = join(__dirname, 'labos', 'students.yaml')
  if (!existsSync(path)) return []
  const raw = readFileSync(path, 'utf-8')
  const parsed = parseYaml(raw)
  return (parsed.students || []).filter(s => s.active)
}

function detectPeriod() {
  const now = new Date()
  const end = now.toISOString().slice(0, 10)
  const start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return { start, end }
}

function getISOWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7)
}

// Get latest report file path for a student
function getLatestReport(config, studentId) {
  const reportsDir = join(__dirname, config.reports_dir)
  const files = scanReportFiles(reportsDir, studentId)
  if (files.length === 0) return null
  return files[files.length - 1] // latest (sorted ascending)
}

// --- Page Routes ---
app.get('/', (req, res) => {
  const sid = (req.headers.cookie || '').match(/sid=([^;]+)/)?.[1]
  const user = sid ? getSession(sid) : null
  if (!user) return res.redirect('/login')
  res.redirect(user.role === 'teacher' ? '/teacher' : '/student')
})

app.get('/login', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'))
})

app.get('/student', requireAuth, (req, res) => {
  res.sendFile(join(__dirname, 'public', 'student.html'))
})

app.get('/teacher', requireRole('teacher'), (req, res) => {
  res.sendFile(join(__dirname, 'public', 'teacher.html'))
})

// --- API: Auth ---
app.post('/api/login', (req, res) => {
  const { student_id, password } = req.body
  if (!student_id || !password) {
    return res.status(400).json({ error: 'Missing student_id or password' })
  }
  const user = authenticate(student_id, password)
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  const sid = createSession(user)
  setSessionCookie(res, sid)
  res.json({
    ok: true,
    user: { id: user.id, name: user.name, role: user.role, project: user.project },
    redirect: user.role === 'teacher' ? '/teacher' : '/student',
  })
})

app.post('/api/logout', (req, res) => {
  const sid = (req.headers.cookie || '').match(/sid=([^;]+)/)?.[1]
  if (sid) destroySession(sid)
  clearSessionCookie(res)
  res.json({ ok: true })
})

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

// --- API: Version ---
const VERSION_FILE = join(__dirname, '..', 'VERSION')
let _cachedVersion = null
app.get('/api/version', (req, res) => {
  try {
    if (!_cachedVersion) {
      _cachedVersion = existsSync(VERSION_FILE) ? readFileSync(VERSION_FILE, 'utf-8').trim() : '0.0.0'
    }
    res.json({ version: _cachedVersion, app: 'AutoProf LabOS' })
  } catch {
    res.json({ version: '0.0.0', app: 'AutoProf LabOS' })
  }
})

// --- API: Students ---
app.get('/api/students', requireRole('teacher'), (req, res) => {
  const students = loadStudents().filter(s => s.role !== 'teacher')
  const config = loadConfig()
  const reportsDir = join(__dirname, config.reports_dir)
  const period = detectPeriod()
  const submittedIds = new Set()
  for (const s of students) {
    const files = scanReportFiles(reportsDir, s.id)
    if (files.length > 0) submittedIds.add(s.id)
  }
  const result = students.map(s => ({
    id: s.id,
    name: s.name,
    project: s.project,
    role: s.role,
    has_submitted: submittedIds.has(s.id),
  }))
  res.json({ students: result })
})

// --- API: Report ---
app.get('/api/report/:id', requireAuth, (req, res) => {
  const config = loadConfig()
  let filePath = null
  if (req.query.file) {
    // Load specific report file by filename
    const reportsDir = join(__dirname, config.reports_dir)
    const candidate = join(reportsDir, req.params.id, req.query.file)
    if (existsSync(candidate)) filePath = candidate
  }
  if (!filePath) filePath = getLatestReport(config, req.params.id)
  if (!filePath) return res.status(404).json({ error: 'No report found' })
  const report = parseReport(filePath)
  res.json({ report })
})

// --- API: List all reports for a student ---
app.get('/api/reports/:id', requireAuth, (req, res) => {
  const config = loadConfig()
  const reportsDir = join(__dirname, config.reports_dir)
  const files = scanReportFiles(reportsDir, req.params.id)
  const list = files.reverse().map(f => {
    const report = parseReport(f)
    const body = (report.raw || '').replace(/^---[\s\S]*?---/, '').trim()
    return {
      filename: f.split(/[\\/]/).pop(),
      period_start: report.meta?.period_start || '',
      period_end: report.meta?.period_end || '',
      submitted_at: report.meta?.submitted_at || '',
      status: report.meta?.status || 'on_track',
      excerpt: body.slice(0, 150),
    }
  })
  res.json({ reports: list })
})

// --- API: Submit ---
app.post('/api/submit', requireAuth, async (req, res) => {
  const { content } = req.body
  if (!content || content.trim().length < 10) {
    return res.status(400).json({ error: 'Report content too short' })
  }

  // Only students can submit (or teacher on behalf)
  const studentId = req.user.role === 'teacher' ? req.body.student_id : req.user.id
  if (!studentId) {
    return res.status(400).json({ error: 'Missing student_id' })
  }

  const students = loadStudents()
  const student = students.find(s => s.id === studentId)
  if (!student) {
    return res.status(404).json({ error: 'Student not found' })
  }

  const now = new Date()
  const week = `${now.getFullYear()}-W${String(getISOWeek(now)).padStart(2, '0')}`
  const dir = join(__dirname, 'labos', 'reports', studentId)
  mkdirSync(dir, { recursive: true })
  const filePath = join(dir, `${week}.md`)
  writeFileSync(filePath, content, 'utf-8')

  generateAndSaveSummary(filePath).then(summary => {
    if (summary && summary.summary) {
      accumulateFromReport(studentId, student.name, content, summary)
    }
    // Flywheel: report_submitted -> index KB + log trajectory + build context
    flywheelTrigger('report_submitted', { studentId, reportPath: filePath, content, summary, period: week, studentName: student.name })
  }).catch(e => {
    console.error('[submit] AI summary failed:', e.message)
  })

  res.json({ ok: true, file: `${week}.md`, student_id: studentId, flywheel: true })
})

// --- API: Summary ---
app.get('/api/summary/:id', requireAuth, (req, res) => {
  const summary = loadSummary(req.params.id)
  res.json({ summary, has_api_key: hasApiKey() })
})

// --- API: Report Context (Phase 3: 飞轮↔周报双向) ---
// 返回结构化上下文: 上次AI总结 + 会议行动项 + 未完成任务 + 飞轮最近事件 + 本体关联
app.get('/api/report-context/:id', requireAuth, (req, res) => {
  const sid = req.params.id
  const result = { student_id: sid, last_summary: null, meeting_actions: [], open_tasks: [], done_tasks: [], flywheel_recent: [], ontology_links: null }

  // 1. 上次 AI 总结
  try {
    const summary = loadSummary(sid)
    if (summary && summary.generated_at) {
      result.last_summary = {
        summary: summary.summary || '',
        risks: summary.risks || [],
        suggestions: summary.suggestions || [],
        generated_at: summary.generated_at,
      }
    }
  } catch {}

  // 2. 会议行动项 (分配给该学生的)
  try {
    for (const m of listMeetings()) {
      const a = loadActions(m.date)
      if (!a || !a.actions) continue
      for (const act of a.actions) {
        if (act.owner_student_id === sid || act.owner_name === sid) {
          result.meeting_actions.push({ ...act, meeting_date: m.date })
        }
      }
    }
  } catch {}

  // 3. 未完成任务
  try {
    const tasks = getTasksByStudent(sid)
    result.open_tasks = tasks.filter(t => t.status !== 'done').map(t => ({
      task_id: t.task_id, title: t.title, status: t.status,
      deadline: t.deadline || null, priority: t.priority || 'medium',
      source: t.source || 'manual',
    }))
    result.done_tasks = tasks.filter(t => t.status === 'done').slice(-5).map(t => ({
      task_id: t.task_id, title: t.title, priority: t.priority,
      deadline: t.deadline || '', source: t.source || '',
    }))
  } catch {}

  // 4. 飞轮最近事件 (该学生相关)
  try {
    const log = getFlywheelLog(30)
    result.flywheel_recent = log
      .filter(e => e.payload?.studentId === sid)
      .slice(0, 3)
      .map(e => ({ event: e.event, status: e.status, started_at: e.started_at }))
  } catch {}

  // 5. 本体关联摘要
  try {
    const graph = getEntityGraph('student', sid)
    if (graph && graph.connected) {
      const counts = {}
      for (const c of graph.connected) {
        const t = c.entity?.type || 'unknown'
        counts[t] = (counts[t] || 0) + 1
      }
      result.ontology_links = counts
    }
  } catch {}

  res.json(result)
})

// --- API: Chat (SSE streaming) ---
app.get('/api/chat/:id', requireAuth, (req, res) => {
  const chatId = req.user.role === 'teacher' ? req.params.id : req.user.id
  const history = loadChat(chatId)
  res.json({ messages: history })
})

app.post('/api/chat/:id', requireAuth, (req, res) => {
  const studentId = req.user.role === 'teacher' ? req.params.id : req.user.id
  const { message } = req.body
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Empty message' })
  }

  // Load student report + summary + chat history
  const config = loadConfig()
  const reportPath = getLatestReport(config, studentId)
  if (!reportPath) {
    return res.status(404).json({ error: 'No report found for this student' })
  }

  const report = parseReport(reportPath)
  const summary = loadSummary(studentId)
  const chatHistory = loadChat(studentId)

  // Save teacher message
  saveMessage(studentId, 'user', message)

  // Build AI context + inject student memory
  let vcContext = ''
  try {
    vcContext = buildStudentContext(studentId)
  } catch (e) {
    console.error('[chat] buildStudentContext error:', e.message)
  }
  const aiMessages = injectContext(buildChatMessages(report, summary, chatHistory, message, vcContext), studentId)

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  let fullText = ''

  // Stream AI response
  chatStream(aiMessages, (chunk) => {
    fullText += chunk
    const data = JSON.stringify({ chunk })
    res.write(`data: ${data}\n\n`)
  }).then(() => {
    // Save AI response to chat history
    saveMessage(studentId, 'assistant', fullText)
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()
  }).catch((e) => {
    console.error('[chat] stream error:', e.message)
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`)
    res.end()
 })

  // Handle client disconnect (res, not req — req 'close' fires when POST body is received, killing SSE before chatStream starts)
  res.on('close', () => {
    // client went away; chatStream .then/.catch still calls res.end() safely
  })
})

// --- API: Brief (dashboard data) ---
app.get('/api/brief', requireRole('teacher'), (req, res) => {
  const config = loadConfig()
  const students = loadStudents()
  const period = detectPeriod()
  const reportsDir = join(__dirname, config.reports_dir)
  const reports = []
  for (const s of students) {
    const filePath = getLatestReport(config, s.id)
    if (filePath) {
      reports.push(parseReport(filePath))
    }
  }
  const risks = evaluateRisks(reports, students, period.start, period.end)
 const brief = generateBrief(reports, risks, students, period.start, period.end)
  const markdown = renderBriefMarkdown(brief)
  res.json({ brief, markdown, students })
})

// --- API: Progress / Weekly Report Draft (Feature 5) ---
app.get('/api/progress/:id/draft', requireAuth, async (req, res) => {
  const studentId = req.params.id
  const students = loadStudents()
  const student = students.find(s => s.id === studentId)
  if (!student) return res.status(404).json({ error: 'Student not found' })
  if (req.user.role !== 'teacher' && req.user.id !== studentId) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  try {
    const result = await generateWeeklyDraft(student.id, student.name, student.project)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: 'Draft generation failed: ' + e.message })
  }
})

app.post('/api/progress/:id/draft', requireAuth, async (req, res) => {
  const studentId = req.params.id
  const students = loadStudents()
  const student = students.find(s => s.id === studentId)
  if (!student) return res.status(404).json({ error: 'Student not found' })
  if (req.user.role !== 'teacher' && req.user.id !== studentId) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const { content } = req.body
  if (!content || content.trim().length < 10) {
    return res.status(400).json({ error: 'Content too short' })
  }
  const now = new Date()
  const week = `${now.getFullYear()}-W${String(getISOWeek(now)).padStart(2, '0')}`
  const dir = join(__dirname, 'labos', 'reports', studentId)
  mkdirSync(dir, { recursive: true })
  const filePath = join(dir, `${week}.md`)
  writeFileSync(filePath, content, 'utf-8')
  generateAndSaveSummary(filePath).catch(e => console.error('[progress] summary failed:', e.message))
  res.json({ ok: true, file: `${week}.md` })
})

// --- API: Agent Loop (Phase 2: Waku-style agent) ---
// Student: generate weekly report draft using context tools
app.post('/api/agent/report-draft', requireAuth, async (req, res) => {
  const studentId = req.user.role === 'teacher' ? req.body.student_id : req.user.id
  if (!studentId) return res.status(400).json({ error: 'Missing student_id' })
  const students = loadStudents()
  const student = students.find(s => s.id === studentId)
  if (!student) return res.status(404).json({ error: 'Student not found' })

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // Build tools with access to server functions
  const config = loadConfig()
  const tools = {
    read_last_report: {
      description: 'Read the student latest weekly report content',
      parameters: { type: 'object', properties: { student_id: { type: 'string' } }, required: ['student_id'] },
      execute: async (args) => {
        const fp = getLatestReport(config, args.student_id)
        if (!fp) return 'No previous report found.'
        const rep = parseReport(fp)
        const body = (rep.raw || '').replace(/^[\s\S]*?---/, '').trim()
        return body.slice(0, 3000)
      }
    },
    read_report_context: {
      description: 'Read student open tasks, meeting actions, and last AI summary',
      parameters: { type: 'object', properties: { student_id: { type: 'string' } }, required: ['student_id'] },
      execute: async (args) => {
        const sid = args.student_id
        const result = { open_tasks: [], meeting_actions: [], last_summary: '' }
        try { const sum = loadSummary(sid); if (sum) result.last_summary = sum.summary || '' } catch {}
        try {
          const tasks = getTasksByStudent(sid)
          result.open_tasks = tasks.filter(t => t.status !== 'done').map(t => ({ title: t.title, deadline: t.deadline, priority: t.priority }))
        } catch {}
        try {
          for (const m of listMeetings()) {
            const a = loadActions(m.date)
            if (!a || !a.actions) continue
            for (const act of a.actions) {
              if (act.owner_student_id === sid || act.owner_name === sid) {
                result.meeting_actions.push({ task: act.task, deadline: act.deadline, status: act.status })
              }
            }
          }
        } catch {}
        return JSON.stringify(result)
      }
    },
    read_summary: {
      description: 'Read the AI-generated summary for this student latest report',
      parameters: { type: 'object', properties: { student_id: { type: 'string' } }, required: ['student_id'] },
      execute: async (args) => {
        const sum = loadSummary(args.student_id)
        if (!sum) return 'No AI summary available.'
        return JSON.stringify({ summary: sum.summary, risks: sum.risks, suggestions: sum.suggestions })
      }
    },
    read_student_tasks: {
      description: 'Read all tasks assigned to this student',
      parameters: { type: 'object', properties: { student_id: { type: 'string' } }, required: ['student_id'] },
      execute: async (args) => {
        const tasks = getTasksByStudent(args.student_id)
        return JSON.stringify(tasks.map(t => ({ title: t.title, status: t.status, deadline: t.deadline, priority: t.priority, source: t.source })))
      }
    },
    create_task: {
      description: 'Create a new tracking task for a student',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title' },
          owner_student_id: { type: 'string', description: 'Student ID' },
          deadline: { type: 'string', description: 'Deadline YYYY-MM-DD' }
        },
        required: ['title', 'owner_student_id']
      },
      execute: async (args) => {
        const result = createTask({ title: args.title, owner_student_id: args.owner_student_id, source: 'agent', priority: 'medium', deadline: args.deadline || '' })
        return 'Task created: ' + (result.task_id || 'unknown')
      }
    }
  }

  const system = 'You are a research lab AI assistant helping a student write their bi-weekly report. Use the available tools to read the student previous report, open tasks, meeting action items, and AI summary. Then generate a well-structured bi-weekly report draft in Markdown with YAML frontmatter. The draft should reference what was done (from tasks/meetings) and plan next steps. Output ONLY the Markdown report.'

  const userMsg = 'Student: ' + student.name + ' (' + student.id + '), Project: ' + (student.project || 'N/A') + '. Generate a bi-weekly report draft based on available context. Use the tools to gather information first.'

  try {
    await runAgentLoop({
      system,
      messages: [{ role: 'user', content: userMsg }],
      tools,
      maxIter: 5,
      onChunk: (text) => {
        res.write('data: ' + JSON.stringify({ chunk: text }) + '\n\n')
      },
      onToolCall: (name, args, result) => {
        res.write('data: ' + JSON.stringify({ tool: name, args }) + '\n\n')
      },
    })
    res.write('data: ' + JSON.stringify({ done: true }) + '\n\n')
    res.end()
  } catch (e) {
    console.error('[agent report-draft] error:', e.message)
    res.write('data: ' + JSON.stringify({ error: e.message }) + '\n\n')
    res.end()
  }
})

// Teacher: AI review of student report using agent tools
app.post('/api/agent/report-review', requireRole('teacher'), async (req, res) => {
  const studentId = req.body.student_id
  if (!studentId) return res.status(400).json({ error: 'Missing student_id' })

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const config = loadConfig()
  const tools = {
    read_last_report: {
      description: 'Read the student latest weekly report content',
      parameters: { type: 'object', properties: { student_id: { type: 'string' } }, required: ['student_id'] },
      execute: async (args) => {
        const fp = getLatestReport(config, args.student_id)
        if (!fp) return 'No report found.'
        const rep = parseReport(fp)
        const body = (rep.raw || '').replace(/^[\s\S]*?---/, '').trim()
        return body.slice(0, 4000)
      }
    },
    read_summary: {
      description: 'Read the AI-generated summary for this student',
      parameters: { type: 'object', properties: { student_id: { type: 'string' } }, required: ['student_id'] },
      execute: async (args) => {
        const sum = loadSummary(args.student_id)
        if (!sum) return 'No AI summary available.'
        return JSON.stringify({ summary: sum.summary, risks: sum.risks, suggestions: sum.suggestions })
      }
    },
    read_student_tasks: {
      description: 'Read all tasks assigned to this student',
      parameters: { type: 'object', properties: { student_id: { type: 'string' } }, required: ['student_id'] },
      execute: async (args) => {
        const tasks = getTasksByStudent(args.student_id)
        return JSON.stringify(tasks.map(t => ({ title: t.title, status: t.status, deadline: t.deadline, priority: t.priority })))
      }
    },
    read_report_context: {
      description: 'Read student open tasks, meeting actions, and last AI summary',
      parameters: { type: 'object', properties: { student_id: { type: 'string' } }, required: ['student_id'] },
      execute: async (args) => {
        const sid = args.student_id
        const result = { open_tasks: [], meeting_actions: [], last_summary: '' }
        try { const sum = loadSummary(sid); if (sum) result.last_summary = sum.summary || '' } catch {}
        try { const tasks = getTasksByStudent(sid); result.open_tasks = tasks.filter(t => t.status !== 'done').map(t => ({ title: t.title, deadline: t.deadline, priority: t.priority })) } catch {}
        try { for (const m of listMeetings()) { const a = loadActions(m.date); if (!a || !a.actions) continue; for (const act of a.actions) { if (act.owner_student_id === sid || act.owner_name === sid) { result.meeting_actions.push({ task: act.task, deadline: act.deadline, status: act.status }) } } } } catch {}
        return JSON.stringify(result)
      }
    },
  }

  const system = 'You are a research lab AI advisor reviewing a student bi-weekly report. Use the available tools to read the report, AI summary, tasks, and meeting actions. Then provide a structured review: 1) Overall assessment 2) Key concerns/risks 3) Specific suggestions for improvement 4) Questions to discuss at the next meeting. Write in Chinese. Be concise and actionable.'

  const userMsg = 'Review student ' + studentId + ' weekly report. Use tools to gather context first.'

  try {
    await runAgentLoop({
      system,
      messages: [{ role: 'user', content: userMsg }],
      tools,
      maxIter: 5,
      onChunk: (text) => {
        res.write('data: ' + JSON.stringify({ chunk: text }) + '\n\n')
      },
      onToolCall: (name, args, result) => {
        res.write('data: ' + JSON.stringify({ tool: name, args }) + '\n\n')
      },
    })
    res.write('data: ' + JSON.stringify({ done: true }) + '\n\n')
    res.end()
  } catch (e) {
    console.error('[agent report-review] error:', e.message)
    res.write('data: ' + JSON.stringify({ error: e.message }) + '\n\n')
    res.end()
  }
})

// --- API: Dashboard (全局概览仪表盘) ---
app.get('/api/dashboard', requireRole('teacher'), (req, res) => {
  const config = loadConfig()
  const allStudents = loadStudents().filter(s => s.role !== 'teacher')
  const today = new Date().toISOString().slice(0, 10)
  const allTasks = getAllTasks()
  const subsRaw = loadSubmissions()
  const allSubs = Array.isArray(subsRaw) ? subsRaw : (subsRaw.submissions || [])
  let reported = 0, overdueCount = 0, activeSubs = 0
  const cards = allStudents.map(s => {
    const reportPath = getLatestReport(config, s.id)
    const reportSubmitted = !!reportPath
    if (reportSubmitted) reported++
    let reportDate = ''
    if (reportPath) { const m = reportPath.match(/(\d{4}-W\d+|\d{4}-\d{2}-\d{2})/); if (m) reportDate = m[1] }
    const summ = loadSummary(s.id)
    const riskTags = (summ && Array.isArray(summ.risks)) ? summ.risks.slice(0, 2) : []
    const lastSummary = (summ && summ.summary) ? summ.summary : ''
    const sTasks = allTasks.filter(t => t.owner_student_id === s.id)
    const openTasks = sTasks.filter(t => t.status === 'todo' || t.status === 'in_progress').length
    const overdueTasks = sTasks.filter(t => t.deadline && t.deadline < today && t.status !== 'done')
    overdueCount += overdueTasks.length
    const sSubs = allSubs.filter(sub => sub.owner_student_id === s.id)
    const activeSub = sSubs.find(sub => sub.status === 'submitted' || sub.status === 'under_review' || sub.status === 'revision')
    if (activeSub) activeSubs++
    return { id: s.id, name: s.name, project: s.project || '', report_submitted: reportSubmitted, report_date: reportDate, risk_tags: riskTags, last_summary: lastSummary, open_tasks: openTasks, overdue_tasks: overdueTasks.length, submission_status: activeSub ? activeSub.status : '' }
  })
 res.json({ students: cards, stats: { total: allStudents.length, reported, missing: allStudents.length - reported, overdue_tasks: overdueCount, active_submissions: activeSubs } })
})

// --- API: Knowledge Base (file management) ---
// --- API: Agent Management --- //
app.post('/api/agents/save', requireRole('teacher'), (req, res) => {
  try {
    const agents = req.body;
    if (!Array.isArray(agents)) return res.status(400).json({ error: 'Expected array' });
    writeFileSync(join(__dirname, 'labos', 'agents-custom.json'), JSON.stringify(agents, null, 2));
    res.json({ ok: true, count: agents.length });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/agents/custom', requireAuth, (req, res) => {
  try {
    const p = join(__dirname, 'labos', 'agents-custom.json');
    if (!existsSync(p)) return res.json({ agents: [] });
    res.json({ agents: JSON.parse(readFileSync(p, 'utf8')) });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/kb/list', requireAuth, (req, res) => {
  try {
    const labosPath = join(__dirname, 'labos')
    const result = []
    function walkDir(dir, rel) {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const e of entries) {
        if (e.name.startsWith('.') || e.name.startsWith('_')) continue
        const full = join(dir, e.name)
        const relPath = rel ? rel + '/' + e.name : e.name
        if (e.isDirectory()) { walkDir(full, relPath) }
        else { const stat = statSync(full); result.push({ name: e.name, path: relPath, size: stat.size, modified: stat.mtime.toISOString().slice(0,10), ext: e.name.split('.').pop() }) }
      }
    }
    walkDir(labosPath, '')
    result.sort((a, b) => b.modified.localeCompare(a.modified))
    res.json({ files: result.slice(0, 100), path: 'labos/', total: result.length })
  } catch(e) { res.json({ files: [], path: 'labos/', total: 0, error: e.message }) }
})

app.get('/api/kb/file', requireAuth, (req, res) => {
  try {
    const fpath = join(__dirname, 'labos', req.query.path)
    if (!fpath.startsWith(join(__dirname, 'labos'))) return res.status(403).json({ error: 'forbidden' })
    const content = readFileSync(fpath, 'utf8')
    res.json({ content, path: req.query.path })
  } catch(e) { res.status(404).json({ error: 'file not found' }) }
})

 // --- API: Agent Chat (Knowledge Navigator) ---
 const agentDir = join(labosDir, 'agent-chat')
 if (!existsSync(agentDir)) mkdirSync(agentDir, { recursive: true })

 const agentPrompts = {
   manager: '你是课题组大管家。你有全部学生状态数据(周报提交、风险标签、任务数、逾期数)。导师问你问题时,基于学生数据给出简洁回答。可用中文回答。',
   summary: '你是周报分析 Agent。擅长解析学生双周报,生成总结、风险判断、建议。帮助导师快速了解学生进展。',
   meeting: '你是会议抽取 Agent。从会议纪要中抽取决议和行动项,匹配学生姓名。',
   stt: '你是实时语音转写 Agent。负责会议语音转文字。',
   skill: '你是科研技能 Agent。可运行 idea-evaluator, paper-polish, pre-submission-reviewer 等技能。',
   progress: '你是进度追踪 Agent。读取 Codex 工作历史,辅助生成周报草稿。',
   review: '你是审稿辅助 Agent。从5个维度审查论文:宏观逻辑、写作细节、英文语法、LaTeX格式、图表质量。',
   interview: '你是面试/答辩模拟 Agent。模拟答辩场景,推荐回答策略。',
   valuechain: '你是价值链对齐 Agent。分析课题组价值链与学生个人价值链的对齐情况。',
 }

 function loadAgentChat(agentId) {
   const f = join(agentDir, agentId + '.json')
   if (!existsSync(f)) return []
   try { return JSON.parse(readFileSync(f, 'utf8')) } catch { return [] }
 }
 function saveAgentChat(agentId, messages) {
   const trimmed = messages.slice(-50)
   writeFileSync(join(agentDir, agentId + '.json'), JSON.stringify(trimmed, null, 2))
 }

 function buildManagerContext() {
   const config = loadConfig()
   const allStudents = loadStudents().filter(s => s.role !== 'teacher')
   const allTasks = getAllTasks()
   const today = new Date().toISOString().slice(0, 10)
   let ctx = '=== 课题组全貌 ===\n'
   for (const s of allStudents) {
     const reportPath = getLatestReport(config, s.id)
     const summ = loadSummary(s.id)
     const sTasks = allTasks.filter(t => t.owner_student_id === s.id)
     const open = sTasks.filter(t => t.status === 'todo' || t.status === 'in_progress').length
     const overdue = sTasks.filter(t => t.deadline && t.deadline < today && t.status !== 'done').length
     ctx += `${s.id} ${s.name} [${s.project || ''}] 周报:${reportPath ? '已交' : '未交'} 任务:${open} 逾期:${overdue}\n`
     if (summ && summ.summary) ctx += `  总结: ${summ.summary}\n`
     if (summ && summ.risks && summ.risks.length) ctx += `  风险: ${summ.risks.join('; ')}\n`
   }
   return ctx
 }

 app.get('/api/agent-chat/:agentId', requireRole('teacher'), (req, res) => {
   const history = loadAgentChat(req.params.agentId)
   res.json({ messages: history })
 })

 app.post('/api/agent-chat/:agentId', requireRole('teacher'), (req, res) => {
   const agentId = req.params.agentId
   const { message } = req.body
   if (!message || !message.trim()) return res.status(400).json({ error: 'Empty message' })

   const history = loadAgentChat(agentId)
   history.push({ role: 'user', content: message, timestamp: new Date().toISOString() })

   let systemPrompt = agentPrompts[agentId] || '你是 AI 助手。'
   if (agentId === 'manager') systemPrompt += '\n\n' + buildManagerContext()

   const messages = [
     { role: 'system', content: systemPrompt },
     ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
   ]

   res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
   res.setHeader('Cache-Control', 'no-cache')
   res.setHeader('Connection', 'keep-alive')
   res.flushHeaders()

   let fullText = ''
   chatStream(messages, (chunk) => {
     fullText += chunk
     res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
   }).then(() => {
     history.push({ role: 'assistant', content: fullText, timestamp: new Date().toISOString() })
     saveAgentChat(agentId, history)
     res.write(`data: [DONE]\n\n`)
     res.end()
   }).catch((e) => {
     console.error('[agent-chat] stream error:', e.message)
     res.write(`data: ${JSON.stringify({ content: '请求失败: ' + e.message })}\n\n`)
     res.write(`data: [DONE]\n\n`)
     res.end()
   })

   res.on('close', () => {})
 })

 // --- API: Meeting (Feature 2: 会议纪要→行动指令) ---
 // 上传纪要 → 异步 AI 抽取;导师改派确认;学生只读查看分配给自己的行动
 app.post('/api/meeting/upload', requireRole('teacher'), async (req, res) => {
   const { date, content } = req.body
   if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
     return res.status(400).json({ error: 'Invalid date (YYYY-MM-DD required)' })
   }
   if (!content || !content.trim()) {
     return res.status(400).json({ error: 'Meeting content is empty' })
   }
   saveMeeting(date, content)
  runExtraction(date).then(async actions => {
    // Flywheel: meeting_ended -> index KB + log trajectory + build context
    flywheelTrigger('meeting_ended', { date, minutes: content, actions: actions?.actions || [], decisions: actions?.decisions || [] })
    // Auto-extract promises for promise ledger
    try { await autoExtractFromMeeting(date) } catch (pe) { console.error('[meeting] promise extract failed:', pe.message) }
  }).catch(e => {
     console.error('[meeting] extract failed:', e.message)
      saveActions(date, {
        date,
        generated_at: new Date().toISOString(),
        status: 'error',
        error: e.message,
        decisions: [],
        actions: [],
      })
   })
   res.json({ ok: true, date, message: 'Meeting saved. AI extraction in progress.' })
 })
 
 app.get('/api/meeting', requireAuth, (req, res) => {
   res.json({ meetings: listMeetings() })
 })
 
 app.get('/api/meeting/:date', requireAuth, (req, res) => {
   const md = loadMeeting(req.params.date)
   const actions = loadActions(req.params.date)
   res.json({ date: req.params.date, content: md, actions })
 })
 
 app.put('/api/meeting/:date/actions', requireRole('teacher'), async (req, res) => {
   const { date } = req.params
   const existing = loadActions(date)
   if (!existing) {
     return res.status(404).json({ error: 'No actions for this date; upload minutes first' })
   }
   const incoming = req.body.actions || []
   const map = new Map(incoming.map(a => [a.task_id, a]))
   existing.actions = (existing.actions || []).map(a => {
     const edit = map.get(a.task_id)
     if (!edit) return a
     const ownerId = edit.owner_student_id ?? a.owner_student_id
     return {
       ...a,
       task: edit.task ?? a.task,
       owner_name: edit.owner_name ?? a.owner_name,
       owner_student_id: ownerId,
       unmatched: ownerId ? false : (edit.unmatched ?? a.unmatched),
       deadline: edit.deadline ?? a.deadline,
       status: edit.status ?? a.status,
       context: edit.context ?? a.context,
     }
   })
   existing.updated_at = new Date().toISOString()
   saveActions(date, existing)
   res.json({ ok: true, actions: existing.actions })
 })
 
 app.get('/api/my-actions', requireAuth, (req, res) => {
   if (req.user.role === 'teacher') {
     return res.json({ actions: [] })
   }
   const studentId = req.user.id
   const myActions = []
   for (const m of listMeetings()) {
     const a = loadActions(m.date)
     if (!a) continue
     for (const act of (a.actions || [])) {
       if (act.owner_student_id === studentId) {
         myActions.push({ ...act, meeting_date: m.date })
       }
     }
   }
  res.json({ actions: myActions })
})

// --- API: Kanban (Feature 3: 任务看板) ---
app.get('/api/tasks', requireAuth, (req, res) => {
  const today = new Date().toISOString().slice(0, 10)
  const tasks = (req.user.role === 'teacher' ? getAllTasks() : getTasksByStudent(req.user.id))
    .map(t => ({ ...t, is_overdue: !!(t.deadline && t.deadline < today && t.status !== 'done') }))
  res.json({ tasks })
})

app.post('/api/tasks', requireRole('teacher'), (req, res) => {
  const { title, owner_student_id, owner_name, deadline, priority, project, description } = req.body
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Task title required' })
  }
  const task = createTask({ title, owner_student_id, owner_name, deadline, priority, project, description })
  res.json({ ok: true, task })
})

app.put('/api/tasks/:id', requireAuth, (req, res) => {
  const patch = { ...req.body }
  const wasStatus = getAllTasks().find(t => t.task_id === req.params.id)?.status
  // Students can only change status, and only on their own tasks
  if (req.user.role !== 'teacher') {
    const task = getAllTasks().find(t => t.task_id === req.params.id)
    if (!task || task.owner_student_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your task' })
    }
    const allowed = {}
    if (patch.status !== undefined) allowed.status = patch.status
    Object.keys(patch).forEach(k => { if (!(k in allowed)) delete patch[k] })
  }
  const updated = updateTask(req.params.id, patch)
  if (!updated) return res.status(404).json({ error: 'Task not found' })
  // Phase 4: 任务完成自动触发飞轮
  if (wasStatus !== 'done' && updated.status === 'done') {
    flywheelTrigger('task_done', { taskId: req.params.id, ownerId: updated.owner_student_id, taskTitle: updated.title })
  }
  res.json({ ok: true, task: updated })
})

app.delete('/api/tasks/:id', requireRole('teacher'), (req, res) => {
  const ok = deleteTask(req.params.id)
  if (!ok) return res.status(404).json({ error: 'Task not found' })
  res.json({ ok: true })
})

app.post('/api/tasks/from-meeting', requireRole('teacher'), (req, res) => {
  const { date, task_id } = req.body
  if (!date || !task_id) {
    return res.status(400).json({ error: 'date and task_id required' })
  }
  const actions = loadActions(date)
  if (!actions) {
    return res.status(404).json({ error: 'No actions for this date' })
  }
  const action = (actions.actions || []).find(a => a.task_id === task_id)
  if (!action) {
    return res.status(404).json({ error: 'Action item not found' })
  }
  // Check if already promoted
  const existing = getAllTasks().find(t => t.source_ref === task_id)
  if (existing) {
    return res.json({ ok: true, already_promoted: true, task: existing })
  }
  // Default deadline: today + 7 days
  if (!action.deadline) {
    const d = new Date(); d.setDate(d.getDate() + 7)
    action.deadline = d.toISOString().slice(0, 10)
  }
  const task = promoteMeetingAction(action)
  res.json({ ok: true, task })
})

// Bulk promote meeting actions to tasks
app.post('/api/tasks/from-meeting/bulk', requireRole('teacher'), (req, res) => {
  const { date, task_ids } = req.body
  if (!date || !Array.isArray(task_ids)) {
    return res.status(400).json({ error: 'date and task_ids[] required' })
  }
  const actions = loadActions(date)
  if (!actions) {
    return res.status(404).json({ error: 'No actions for this date' })
  }
  const created = [], failed = [], already = []
  const d = new Date(); d.setDate(d.getDate() + 7)
  const defaultDeadline = d.toISOString().slice(0, 10)
  for (const tid of task_ids) {
    const action = (actions.actions || []).find(a => a.task_id === tid)
    if (!action) { failed.push({ task_id: tid, error: 'not found' }); continue }
    const ex = getAllTasks().find(t => t.source_ref === tid)
    if (ex) { already.push({ task_id: tid, task: ex }); continue }
    if (!action.deadline) action.deadline = defaultDeadline
    try {
      const task = promoteMeetingAction(action)
      created.push({ task_id: tid, task })
    } catch (e) {
      failed.push({ task_id: tid, error: e.message })
    }
  }
  res.json({ ok: true, created, failed, already })
})

// Create task from weekly report risk
app.post('/api/tasks/from-risk', requireRole('teacher'), (req, res) => {
  const { student_id, risk_text } = req.body
  if (!student_id || !risk_text) {
    return res.status(400).json({ error: 'student_id and risk_text required' })
  }
  const d = new Date(); d.setDate(d.getDate() + 14)
  const task = createTask({
    title: (risk_text || '').slice(0, 200),
    owner_student_id: student_id,
    source: 'weekly_risk',
    priority: 'high',
    deadline: d.toISOString().slice(0, 10),
  })
  res.json({ ok: true, task })
})

// Batch set default deadlines for tasks without one
app.post('/api/tasks/batch-deadline', requireRole('teacher'), (req, res) => {
  const data = loadTasks()
  const d = new Date(); d.setDate(d.getDate() + 7)
  const defaultDeadline = d.toISOString().slice(0, 10)
  let updated = 0
  for (const t of data.tasks) {
    if (!t.deadline && t.status !== 'done') {
      updateTask(t.task_id, { deadline: defaultDeadline })
      updated++
    }
  }
  res.json({ ok: true, updated, default_deadline: defaultDeadline })
})

app.get('/api/board/stats', requireRole('teacher'), (req, res) => {
  res.json({ stats: getBoardStats() })
})

// --- API: Kanban State Machine (W7b) ---
app.get('/api/tasks/:id/transitions', requireAuth, (req, res) => {
  const data = loadTasks()
  const task = data.tasks.find(t => t.task_id === req.params.id)
  if (!task) return res.status(404).json({ error: 'not found' })
  res.json({ current: task.status, valid: getValidTransitions(task.status) })
})

app.post('/api/tasks/:id/transition', requireAuth, async (req, res) => {
  const { newStatus, evidence } = req.body
  if (!newStatus) return res.status(400).json({ error: 'newStatus required' })
  const result = transitionTask(req.params.id, newStatus, evidence || '')
  if (!result.ok) return res.status(400).json(result)
  // Flywheel: task_done -> log milestone + update project
  if (result.ok && newStatus === 'done') {
    flywheelTrigger('task_done', { taskId: req.params.id, ownerId: result.task?.owner_student_id, taskTitle: result.task?.title })
  }
 res.json(result)
})

// --- API: Task Detail (Phase 4: 关联实体) ---
app.get('/api/tasks/:id/detail', requireAuth, (req, res) => {
  const data = loadTasks()
  const task = data.tasks.find(t => t.task_id === req.params.id)
  if (!task) return res.status(404).json({ error: 'Task not found' })

  const detail = { task, source_meeting: null, source_report: null, ontology_links: null, transition_history: task.transition_history || [] }

  // 来源会议
  if (task.source === 'meeting' && task.source_ref) {
    try {
      const meetingDate = task.source_ref.replace(/-A\d+$/, '').slice(0, 10)
      const actions = loadActions(meetingDate)
      if (actions && actions.actions) {
        const action = actions.actions.find(a => a.task_id === task.source_ref)
        detail.source_meeting = {
          date: meetingDate,
          action: action || null,
          decisions: actions.decisions || [],
        }
      }
    } catch {}
  }

  // 来源周报 (source='weekly' 时 source_ref 可能是学生ID)
  if (task.source === 'weekly') {
    try {
      const summary = loadSummary(task.owner_student_id)
      if (summary) {
        detail.source_report = {
          student_id: task.owner_student_id,
          summary: summary.summary || '',
          risks: summary.risks || [],
          generated_at: summary.generated_at || '',
        }
      }
    } catch {}
  }

  // 本体关联
  try {
    const graph = getEntityGraph('task', req.params.id)
    if (graph && graph.connected) {
      detail.ontology_links = graph.connected.map(c => ({
        type: c.entity?.type || 'unknown',
        id: c.entity?.id || '',
        label: c.entity?.label || c.entity?.name || '',
      }))
    }
  } catch {}

  // 学生信息
  if (task.owner_student_id) {
    try {
      const students = loadStudents()
      const student = students.find(s => s.id === task.owner_student_id)
      if (student) detail.student = { id: student.id, name: student.name, project: student.project || '' }
    } catch {}
  }

  res.json(detail)
})


// --- API: Student Profile (aggregated data) ---

app.get('/api/student-profiles', requireRole('teacher'), (req, res) => {
  res.json({ students: getAllStudentProfiles() })
})

app.get('/api/student-profile/:id', requireAuth, (req, res) => {
  const profile = getStudentProfile(req.params.id)
  if (!profile) return res.status(404).json({ error: 'Student not found' })
  res.json(profile)
})

app.get('/api/lab-progress', requireAuth, (req, res) => {
  res.json(getLabGraduationProgress())
})

// --- API: Promise Ledger (Li Kaifu execution closed-loop engine) ---

app.get('/api/promises/stats', requireRole('teacher'), (req, res) => {
  res.json({ stats: getPromiseStats() })
})

app.get('/api/promises/overdue', requireRole('teacher'), (req, res) => {
  res.json({ promises: getOverduePromises() })
})

app.get('/api/promises/upcoming', requireRole('teacher'), (req, res) => {
  const days = parseInt(req.query.days) || 7
  res.json({ promises: getUpcomingDeadlines(days) })
})

app.get('/api/promises/consistency', requireRole('teacher'), (req, res) => {
  res.json({ students: getAllConsistencyIndices() })
})

app.get('/api/promises/consistency/:id', requireAuth, (req, res) => {
  const idx = getConsistencyIndex(req.params.id)
  if (!idx) return res.status(404).json({ error: 'Student not found' })
  res.json(idx)
})

app.get('/api/promises/goal-tree', requireAuth, (req, res) => {
  res.json(getGoalTree())
})

app.get('/api/promises', requireAuth, (req, res) => {
  const filters = {}
  if (req.query.student_id) filters.student_id = req.query.student_id
  if (req.query.meeting_date) filters.meeting_date = req.query.meeting_date
  if (req.query.status) filters.status = req.query.status
  const promises = getPromises(filters)
  // Attach urgency to each promise
  const withUrgency = promises.map(p => ({ ...p, urgency: getPromiseUrgency(p) }))
  res.json({ promises: withUrgency })
})

app.post('/api/promises', requireRole('teacher'), (req, res) => {
  const p = createPromise(req.body)
  res.json({ ok: true, promise: p })
})

app.post('/api/promises/extract/:date', requireRole('teacher'), async (req, res) => {
  try {
    const result = await autoExtractFromMeeting(req.params.date)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/promises/:id/fulfill', requireRole('teacher'), (req, res) => {
  const p = fulfillPromise(req.params.id, req.body.evidence || '')
  if (!p) return res.status(404).json({ error: 'Promise not found' })
  res.json({ ok: true, promise: p })
})

// --- API: Lab State + Rewards (W8) ---
app.get('/api/lab-state', requireRole('teacher'), async (req, res) => {
  const state = await getLabState()
  res.json(state)
})

app.get('/api/rewards/:studentId', requireAuth, (req, res) => {
  res.json({ rewards: getRewards(req.params.studentId) })
})

app.post('/api/rewards/:studentId', requireRole('teacher'), (req, res) => {
  const { signal, context } = req.body
  if (!signal) return res.status(400).json({ error: 'signal required' })
  const r = recordReward(req.params.studentId, signal, context || '')
  res.json({ ok: true, reward: r })
})

app.get('/api/rewards', requireRole('teacher'), (req, res) => {
  res.json(getLabRewardSummary())
})

app.delete('/api/rewards/:rewardId', requireRole('teacher'), (req, res) => {
  const ok = deleteReward(req.params.rewardId)
  res.json({ ok })
})

// --- API: External Events (W10) ---
app.get('/api/external-events', requireAuth, (req, res) => {
  res.json({ events: getRecentEvents(20), stats: getEventStats() })
})

app.post('/api/external-events/sync-news', requireRole('teacher'), async (req, res) => {
  const result = await recordFromNews(20)
  res.json(result)
})

app.post('/api/external-events/sync-email', requireRole('teacher'), async (req, res) => {
  const result = await recordFromEmails()
  res.json(result)
})

app.post('/api/external-events', requireRole('teacher'), (req, res) => {
  const ev = recordEvent(req.body)
  res.json({ ok: true, event: ev })
})

app.put('/api/external-events/:eventId/processed', requireAuth, (req, res) => {
  const ok = markProcessed(req.params.eventId)
  res.json({ ok })
})

app.get('/api/external-events/unprocessed', requireAuth, (req, res) => {
  res.json({ events: getUnprocessed() })
})

// --- API: LabOS Cockpit (W14) ---
app.get('/api/cockpit', requireRole('teacher'), async (req, res) => {
  try {
    const { getLabState } = await import('./lib/lab-state.js')
    const { getBoardStats } = await import('./lib/kanban.js')
    const { getAllAlignments } = await import('./lib/valuecycle.js')
    const { getEventStats, getRecentEvents } = await import('./lib/external-events.js')
    const { getLabRewardSummary } = await import('./lib/lab-state.js')
    const { loadDailyNews } = await import('./lib/news.js')
    const { getAllGraduationSummaries } = await import('./lib/graduation.js')

    const labState = await getLabState()
    const boardStats = getBoardStats()
    const alignments = getAllAlignments()
    const events = getEventStats()
    const rewards = getLabRewardSummary()

    // Risk radar: aggregate all risks
    const riskRadar = labState.risks.map(r => ({
      student_id: r.student_id,
      student_name: r.student_name,
      risk: r.risk,
    }))

    // Growth trajectory: recent rewards by student
    const growth = {}
    for (const r of rewards.recent || []) {
      if (!growth[r.student_id]) growth[r.student_id] = { rewards: 0, signals: [] }
      growth[r.student_id].rewards++
      growth[r.student_id].signals.push(r.signal)
    }

    // Graduation overview
    const users = (await import('./lib/auth.js')).loadUsers().filter(u => u.active !== false && u.role !== 'teacher')
    const gradSummaries = getAllGraduationSummaries(users.map(u => u.id))

    res.json({
      timestamp: new Date().toISOString(),
      labState,
      boardStats,
      alignments: alignments.slice(0, 20),
      riskRadar,
      growth,
      graduation: gradSummaries,
      events: { stats: events, recent: getRecentEvents(5) },
      rewards,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- API: Skill Extractor (W12) ---
app.get('/api/skills/extracted', requireAuth, (req, res) => {
  res.json({ skills: listExtractedSkills(), stats: getSkillStats() })
})

app.get('/api/skills/extracted/search', requireAuth, (req, res) => {
  const q = req.query.q || ''
  res.json({ results: searchSkills(q, 20) })
})

app.post('/api/skills/extract', requireRole('teacher'), async (req, res) => {
  const result = extractFromAllTrajectories()
  res.json(result)
})

app.get('/api/skills/extracted/stats', requireAuth, (req, res) => {
  res.json(getSkillStats())
})

// --- API: Value Cycle Dashboard (W15) ---
app.get('/api/value-cycle-dashboard', requireRole('teacher'), async (req, res) => {
  try {
    const { getAllAlignments } = await import('./lib/valuecycle.js')
    const { getLabState } = await import('./lib/lab-state.js')
    const { getAllGraduationSummaries } = await import('./lib/graduation.js')
    const { getAllDecisions } = await import('./lib/decisions.js')
    const { getLabRewardSummary } = await import('./lib/lab-state.js')

    const users = (await import('./lib/auth.js')).loadUsers().filter(u => u.active !== false && u.role !== 'teacher')
    const alignments = getAllAlignments()
    const labState = await getLabState()
    const grad = getAllGraduationSummaries(users.map(u => u.id))
    const decisions = getAllDecisions(users.map(u => u.id))
    const rewards = getLabRewardSummary()

    // Value cycle alignment score: 0-100, based on:
    // - graduation progress (40%)
    // - task completion rate (30%)
    // - report submission rate (20%)
    // - risk count (10%, inverse)
    const students = users.map(u => {
      const a = alignments.find(x => x.student_id === u.id) || {}
      const g = grad.find(x => x.student_id === u.id) || {}
      const tasks = labState.tasks
      const studentTasks = Object.entries(tasks.by_status || {})
      const totalTasks = tasks.total || 0
      const doneTasks = tasks.by_status?.done || 0
      const taskRate = totalTasks > 0 ? doneTasks / totalTasks : 0

      const reportRate = labState.students.total > 0 ? labState.reports.submitted / labState.students.total : 0
      const riskScore = Math.max(0, 1 - (labState.risks.filter(r => r.student_id === u.id).length / 10))

      const gradScore = (g.progress_pct || 0) / 100
      const alignmentScore = Math.round(
        gradScore * 40 + taskRate * 30 + reportRate * 20 + riskScore * 10
      )

      return {
        student_id: u.id,
        student_name: u.name,
        role: u.role,
        alignment_score: alignmentScore,
        graduation_progress: g.progress_pct || 0,
        risk_level: g.risk_level || 'unknown',
        decision_count: decisions.filter(d => d.student_id === u.id).length,
        reward_count: rewards.byStudent?.[u.id] || 0,
        recent_alignments: a,
      }
    })

    // Team average
    const teamScore = students.length > 0
      ? Math.round(students.reduce((sum, s) => sum + s.alignment_score, 0) / students.length)
      : 0

    res.json({
      timestamp: new Date().toISOString(),
      team_score: teamScore,
      students,
      stats: {
        total_students: students.length,
        avg_alignment: teamScore,
        high_risk: students.filter(s => s.risk_level === 'high').length,
        total_decisions: decisions.length,
        total_rewards: rewards.total,
      },
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- API: RSS News (Feature 9) ---
app.get('/api/news', requireAuth, async (req, res) => {
  try {
    const news = await getLatestNews(10)
    res.json({ news })
  } catch (e) {
    res.json({ news: [], error: e.message })
  }
})
 
 // --- API: Daily News Digest (Feature 9 扩展) ---
 app.get('/api/news/daily', requireAuth, async (req, res) => {
   const date = req.query.date || new Date().toISOString().slice(0, 10)
   try {
     const data = loadDailyNews(date)
     if (data.exists) {
       res.json(data)
     } else {
       // 未生成,现场拉取并存盘
       const result = await generateDailyDigest(date)
       const fresh = loadDailyNews(date)
       res.json(fresh)
     }
   } catch (e) {
    res.json({ date, content: null, exists: false, error: e.message })
  }
})

// --- API: Calendar Events (Feature: 日历) ---
app.get('/api/calendar/events', requireAuth, (req, res) => {
  try {
    const events = loadCalendarEvents()
    res.json(events)
  } catch (e) {
    res.json([])
  }
})

// --- API: Submissions (Feature 22) ---
app.get('/api/submissions', requireAuth, (req, res) => {
  const data = loadSubmissions()
  res.json(data)
})
app.post('/api/submissions', requireRole('teacher'), (req, res) => {
  const record = createSubmission(req.body || {})
  res.json({ ok: true, submission: record })
})
app.put('/api/submissions/:id', requireAuth, (req, res) => {
  // 学生只能改 status,导师可改全部
  const patch = req.user.role === 'teacher' ? (req.body || {}) : { status: req.body?.status }
  const record = updateSubmission(req.params.id, patch)
  if (!record) return res.status(404).json({ error: 'not found' })
  res.json({ ok: true, submission: record })
})
app.delete('/api/submissions/:id', requireRole('teacher'), (req, res) => {
  const ok = deleteSubmission(req.params.id)
  res.json({ ok })
})
app.get('/api/submissions/stats', requireRole('teacher'), (req, res) => {
  res.json(getSubmissionStats())
})

// --- API: Email → Kanban (Feature 18) ---
app.get('/api/email/unread', requireRole('teacher'), async (req, res) => {
  if (!hasImapConfig()) {
    return res.json({ emails: [], configured: false })
  }
  const emails = await fetchUnread(20)
  res.json({ emails, configured: true })
})

app.post('/api/email/sync', requireRole('teacher'), async (req, res) => {
  if (!hasImapConfig()) {
    return res.json({ emails: [], tasks: [], status: 'not_configured' })
  }
  const result = await createTasksFromEmails()
  res.json(result)
})

// --- API: STT Status (Feature 2 语音) ---
app.get('/api/stt/status', requireAuth, (req, res) => {
  res.json(getSttStatus())
})

// --- Page: Meeting Live (Feature 2 语音) ---
app.get('/meeting-live', requireRole('teacher'), (req, res) => {
  res.sendFile(join(__dirname, 'public', 'meeting-live.html'))
})

// --- API: Exam Seating (Feature 11) ---
app.post('/api/seating/generate', requireRole('teacher'), (req, res) => {
  const { rows, cols, student_names, mode, exam_name } = req.body
  if (!rows || !cols || !student_names || !student_names.length) {
    return res.status(400).json({ error: 'rows, cols, student_names required' })
  }
  try {
    const data = generateSeating({ rows, cols, student_names, mode, exam_name })
    res.json(data)
  } catch (e) { res.status(500).json({ error: e.message }) }
})
app.get('/api/seating', requireAuth, (req, res) => {
  res.json({ seatings: listSeatings() })
})
app.get('/api/seating/:id', requireAuth, (req, res) => {
  const data = loadSeating(req.params.id)
  if (!data) return res.status(404).json({ error: 'Not found' })
  res.json(data)
})
app.delete('/api/seating/:id', requireRole('teacher'), (req, res) => {
  deleteSeating(req.params.id)
  res.json({ ok: true })
})

// --- API: Lesson Plan (Feature 15) ---
app.post('/api/lesson/generate', requireAuth, async (req, res) => {
  const { course, chapter, topic, textbook, extra } = req.body
  if (!course || !chapter) {
    return res.status(400).json({ error: 'course, chapter required' })
  }
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
  try {
    const result = await generateLesson({ course, chapter, topic, textbook, extra }, (chunk) => {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
    })
    res.write(`data: ${JSON.stringify({ done: true, filename: result.filename, source: result.source })}\n\n`)
    res.end()
  } catch (e) {
    console.error('[lesson] error:', e.message)
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`)
    res.end()
  }
})
app.get('/api/lessons', requireAuth, (req, res) => {
  res.json({ lessons: listLessons() })
})
app.get('/api/lesson/:filename', requireAuth, (req, res) => {
  const content = loadLesson(req.params.filename)
  if (content === null) return res.status(404).json({ error: 'Not found' })
  res.json({ content })
})
app.delete('/api/lesson/:filename', requireRole('teacher'), (req, res) => {
  deleteLesson(req.params.filename)
  res.json({ ok: true })
})

// --- API: Workload (Feature 13) ---
app.post('/api/workload/calculate', requireRole('teacher'), (req, res) => {
  try {
    const result = calculateWorkload(req.body)
    res.json(result)
  } catch (e) { res.status(500).json({ error: e.message }) }
})
app.get('/api/workload/coefficients', requireRole('teacher'), (req, res) => {
  res.json(loadCoefficients())
})
app.put('/api/workload/coefficients', requireRole('teacher'), (req, res) => {
  saveCoefficients(req.body)
  res.json({ ok: true })
})
app.get('/api/workload/:year', requireRole('teacher'), (req, res) => {
  const data = loadWorkload(req.params.year)
  if (!data) return res.status(404).json({ error: 'Not found' })
  res.json(data)
})

// --- API: Invoice (Feature 14) ---
app.get('/api/invoices', requireRole('teacher'), (req, res) => {
  res.json({ invoices: loadInvoices() })
})
app.get('/api/invoices/stats', requireRole('teacher'), (req, res) => {
  res.json(getInvoiceStats())
})
app.post('/api/invoices', requireRole('teacher'), (req, res) => {
  const { date, amount, category, description, vendor } = req.body
  if (!date || !amount || !category) {
    return res.status(400).json({ error: 'date, amount, category required' })
  }
  res.json(addInvoice({ date, amount, category, description, vendor }))
})
app.put('/api/invoices/:id', requireRole('teacher'), (req, res) => {
  const inv = updateInvoice(req.params.id, req.body)
  if (!inv) return res.status(404).json({ error: 'Not found' })
  res.json(inv)
})
app.delete('/api/invoices/:id', requireRole('teacher'), (req, res) => {
  deleteInvoice(req.params.id)
  res.json({ ok: true })
})

// --- API: Memory (F7-lite) ---
app.get('/api/memory/:id', requireAuth, (req, res) => {
  const mem = loadMemory(req.params.id)
  res.json({ memory: mem })
})

app.put('/api/memory/:id', requireRole('teacher'), (req, res) => {
  const updated = updateMemory(req.params.id, req.body)
  res.json({ memory: updated })
})

// --- API: Chatrooms (F4) ---
app.get('/api/rooms', requireAuth, (req, res) => {
  const rooms = listRooms(req.user.id)
  res.json({ rooms })
})

app.post('/api/rooms', requireAuth, (req, res) => {
  const { name, members, ai_enabled } = req.body
  const allStudents = loadStudents()
  const memberObjs = (members || []).map(m => allStudents.find(s => s.id === m)).filter(Boolean)
  const room = createRoom({
    name,
    created_by: req.user.id,
    created_by_name: req.user.name,
    members: members || [],
    ai_enabled: ai_enabled !== false,
  })
  res.json({ room })
})

app.get('/api/rooms/:id', requireAuth, (req, res) => {
  const room = getRoom(req.params.id)
  if (!room) return res.status(404).json({ error: 'Room not found' })
  if (!room.members.includes(req.user.id)) return res.status(403).json({ error: 'Not a member' })
  res.json({ room })
})

app.post('/api/rooms/:id/messages', requireAuth, async (req, res) => {
  const { content } = req.body
  if (!content || !content.trim()) return res.status(400).json({ error: 'Empty message' })
  const room = getRoom(req.params.id)
  if (!room) return res.status(404).json({ error: 'Room not found' })
  if (!room.members.includes(req.user.id)) return res.status(403).json({ error: 'Not a member' })
  const msg = addMessage(req.params.id, { sender_id: req.user.id, sender_name: req.user.name, content })
  if (!msg) return res.status(500).json({ error: 'Failed to save' })
  broadcast(req.params.id, { type: 'message', message: msg })
  res.json({ ok: true, message: msg })
  // If @AI mentioned, trigger AI response asynchronously
  if (shouldTriggerAI(content, room.ai_enabled) && hasApiKey()) {
    const aiMessages = buildAIContext(req.params.id, (sid) => getContextString(sid))
    // Add the @AI message as latest user input
    aiMessages.push({ role: 'user', content: content.replace(/@ai|@AI|@助手|@小助/gi, '').trim() || '请帮忙分析一下' })
    let aiText = ''
    chatStream(aiMessages, (chunk) => {
      aiText += chunk
      broadcast(req.params.id, { type: 'ai_chunk', chunk })
    }).then(() => {
      const aiMsg = addMessage(req.params.id, { sender_id: 'ai', sender_name: 'AI助手', content: aiText, is_ai: true })
      broadcast(req.params.id, { type: 'message', message: aiMsg })
      // Accumulate to memory for each student member
      for (const m of room.members) {
        if (m.startsWith('s')) accumulateFromChat(m, aiText.substring(0, 200))
      }
    }).catch(e => console.error('[chatroom] AI stream error:', e.message))
  }
})

app.post('/api/rooms/:id/join', requireAuth, (req, res) => {
  const room = joinRoom(req.params.id, req.user.id, req.user.name)
  if (!room) return res.status(404).json({ error: 'Room not found' })
  res.json({ room })
})

app.delete('/api/rooms/:id', requireRole('teacher'), (req, res) => {
  deleteRoom(req.params.id)
  res.json({ ok: true })
})

app.get('/api/rooms/:id/stream', requireAuth, (req, res) => {
  const room = getRoom(req.params.id)
  if (!room) return res.status(404).json({ error: 'Room not found' })
  if (!room.members.includes(req.user.id)) return res.status(403).json({ error: 'Not a member' })
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
  const removeClient = addClient(req.params.id, res)
  req.on('close', () => removeClient())
})

// --- API: AI 面试/答辩 (Feature 20) ---
app.get('/api/interview/scenarios', requireAuth, (req, res) => {
  res.json({ scenarios: getInterviewScenarios() })
})

app.post('/api/interview', requireAuth, async (req, res) => {
  const { action, scenario, topic, context, history, answer, coachMode } = req.body
  if (!action || !scenario) {
    return res.status(400).json({ error: 'action and scenario required' })
  }
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
  try {
    const params = { scenario, topic, context }
    if (action === 'start') {
      await startInterview(params, (chunk) => {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
      })
    } else if (action === 'continue') {
      await continueInterview({ ...params, history: history || [], answer: answer || '', coachMode }, (chunk) => {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
      })
    } else {
      res.write(`data: ${JSON.stringify({ error: 'action must be start or continue' })}\n\n`)
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()
  } catch (e) {
    console.error('[interview] error:', e.message)
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`)
    res.end()
  }
})

// --- API: ValueCycle (Wave 5 — AI through-line) ---
app.get('/api/valuecycle/group', requireAuth, (req, res) => {
  try {
    res.json(loadGroupValueCycle())
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/valuecycle/group', requireRole('teacher'), (req, res) => {
  try {
    saveGroupValueCycle(req.body)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/valuecycle/alignment/all', requireRole('teacher'), (req, res) => {
  try {
    res.json(getAllAlignments())
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/valuecycle/:id', requireAuth, (req, res) => {
  try {
    res.json(loadValueCycle(req.params.id))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/valuecycle/:id', requireAuth, (req, res) => {
  try {
    // Students can only edit their own; teachers can edit any
    const vc = loadValueCycle(req.params.id)
    if (req.user.role !== 'teacher' && vc.student_id !== req.user.id) {
      return res.status(403).json({ error: 'Cannot edit another student valuecycle' })
    }
    updateValueCycle(req.params.id, req.body)
    res.json({ ok: true, valuecycle: loadValueCycle(req.params.id) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/valuecycle/:id/assessment', requireRole('teacher'), (req, res) => {
  try {
    const vc = loadValueCycle(req.params.id)
    updateValueCycle(req.params.id, {
      advisor_assessment: { ...vc.advisor_assessment, ...req.body }
    })
    res.json({ ok: true, valuecycle: loadValueCycle(req.params.id) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- Graduation (v0.7.8 — NNU standard [需核对]) ---
app.get('/api/graduation/categories', requireAuth, (req, res) => {
  res.json(getRequirementCategories())
})

app.get('/api/graduation/template/:role', requireRole('teacher'), (req, res) => {
  res.json(getRequirementsTemplate(req.params.role))
})

app.get('/api/graduation/all', requireRole('teacher'), (req, res) => {
  try {
    const users = loadUsers().filter(u => u.role !== 'teacher')
    res.json({ students: getAllGraduationSummaries(users.map(u => u.id)) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/graduation/:id', requireAuth, (req, res) => {
  try {
    const vc = loadValueCycle(req.params.id)
    const gs = vc.graduation_state
    if (!gs || !gs.requirements || gs.requirements.length === 0) {
      const users = loadUsers()
      const u = users.find(x => x.id === req.params.id)
      if (u && u.role !== 'teacher') {
        seedGraduationRequirements(u.id, u.role)
      }
    }
    res.json(getGraduationSummary(req.params.id))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/graduation/:id/seed', requireRole('teacher'), (req, res) => {
  try {
    const users = loadUsers()
    const u = users.find(x => x.id === req.params.id)
    if (!u) return res.status(404).json({ error: 'Student not found' })
    const role = req.body.role || u.role
    const gs = seedGraduationRequirements(req.params.id, role)
    try { syncGraduationToDb(req.params.id) } catch {}
    try { indexGraduationToKb(req.params.id) } catch {}
    res.json({ ok: true, graduation_state: gs })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/graduation/:id/requirement/:reqId', requireAuth, (req, res) => {
  try {
    if (req.user.role === 'student' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Students can only update their own requirements' })
    }
    if (req.user.role === 'teacher') {
      // teachers can edit any
    } else if (req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const patch = {}
    if (req.body.status) patch.status = req.body.status
    if (req.body.met_at !== undefined) patch.met_at = req.body.met_at
    if (req.body.notes !== undefined) patch.notes = req.body.notes
    const gs = updateRequirement(req.params.id, req.params.reqId, patch)
    try { syncGraduationToDb(req.params.id) } catch {}
    try { indexGraduationToKb(req.params.id) } catch {}
    res.json({ ok: true, graduation_state: gs })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- Decisions (v0.7.9 W6b) ---
app.get('/api/decisions/all', requireRole('teacher'), (req, res) => {
  try {
    const users = loadUsers().filter(u => u.role !== 'teacher')
    res.json({ decisions: getAllDecisions(users.map(u => u.id)) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/decisions/:studentId', requireAuth, (req, res) => {
  try {
    if (req.user.role === 'student' && req.user.id !== req.params.studentId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    res.json({ decisions: listDecisions(req.params.studentId), stats: getDecisionStats(req.params.studentId) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/decisions/:studentId', requireAuth, (req, res) => {
  try {
    if (req.user.role === 'student' && req.user.id !== req.params.studentId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const d = createDecision(req.params.studentId, {
      decision: req.body.decision,
      rationale: req.body.rationale,
      outcome: req.body.outcome,
      source: req.body.source || 'manual',
    })
    res.json({ ok: true, decision: d })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/decisions/:studentId/:decisionId', requireAuth, (req, res) => {
  try {
    if (req.user.role === 'student' && req.user.id !== req.params.studentId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const d = updateDecision(req.params.studentId, req.params.decisionId, req.body)
    res.json({ ok: true, decision: d })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/decisions/:studentId/:decisionId', requireRole('teacher'), (req, res) => {
  try {
    const r = deleteDecision(req.params.studentId, req.params.decisionId)
    res.json(r)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// --- Trajectory (v2.1 W7a) ---
app.get('/api/trajectories/:actor', requireRole('teacher'), (req, res) => {
  try {
    const results = searchTrajectories({
      actor_id: req.params.actor,
      session_type: req.query.session_type,
      tags: req.query.tags ? req.query.tags.split(',') : undefined,
      limit: parseInt(req.query.limit) || 20
    })
    res.json({ trajectories: results, total: results.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/trajectory-stats/:actor', requireRole('teacher'), (req, res) => {
  try {
    const stats = getTrajectoryStats(req.params.actor)
    res.json(stats)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/trajectories', requireRole('teacher'), (req, res) => {
  try {
    const results = listTrajectories(parseInt(req.query.limit) || 50)
    res.json({ trajectories: results, total: results.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- ValueCycle extensions (v2.1 W6a) ---
app.put('/api/valuecycle/:id/graduation', requireRole('teacher'), (req, res) => {
  try {
    const vc = loadValueCycle(req.params.id)
    updateValueCycle(req.params.id, {
      graduation_state: { ...vc.graduation_state, ...req.body }
    })
    res.json({ ok: true, valuecycle: loadValueCycle(req.params.id) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/valuecycle/:id/capability', requireRole('teacher'), (req, res) => {
  try {
    const vc = loadValueCycle(req.params.id)
    updateValueCycle(req.params.id, {
      capability: { ...vc.capability, ...req.body }
    })
    res.json({ ok: true, valuecycle: loadValueCycle(req.params.id) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/valuecycle/:id/decision', requireRole('teacher'), (req, res) => {
  try {
    const vc = loadValueCycle(req.params.id)
    const log = vc.decision_log || []
    log.push({
      date: req.body.date || new Date().toISOString().slice(0, 10),
      decision: req.body.decision || '',
      rationale: req.body.rationale || '',
      outcome: req.body.outcome || 'pending'
    })
    updateValueCycle(req.params.id, { decision_log: log })
    res.json({ ok: true, decision_count: log.length, valuecycle: loadValueCycle(req.params.id) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- Wave 8: SQLite DB + LLM Memory + Knowledge Base ---

// Init SQLite on startup (idempotent — CREATE TABLE IF NOT EXISTS)
try {
  initDb()
  console.log('[db.js] SQLite ready (labos/autoprof.db)')
} catch (e) {
  console.error('[db.js] initDb failed:', e.message)
}

// API: DB stats — row counts for all tables
app.get('/api/db/stats', requireRole('teacher'), (req, res) => {
  try {
    res.json(getStats())
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// API: DB migrate — re-run full file→SQLite migration (idempotent)
app.post('/api/db/migrate', requireRole('teacher'), async (req, res) => {
  try {
    const { execSync } = await import('child_process')
    execSync('node scripts/migrate-to-sqlite.mjs', { cwd: __dirname, stdio: 'pipe' })
    res.json({ ok: true, stats: getStats() })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// API: LLM Memory — list memories for an agent (+optional student filter)
app.get('/api/llm-memory/:agentId', requireRole('teacher'), (req, res) => {
  try {
    const mems = retrieveMemories({
      agent_id: req.params.agentId,
      student_id: req.query.student_id || undefined,
      limit: parseInt(req.query.limit) || 50
    })
    res.json({ memories: mems })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// API: LLM Memory — store a memory manually
app.post('/api/llm-memory/:agentId', requireRole('teacher'), (req, res) => {
  try {
    const result = storeMemory({
      agent_id: req.params.agentId,
      student_id: req.body.student_id,
      memory_type: req.body.memory_type || 'note',
      content: req.body.content,
      importance: req.body.importance || 5,
      source: req.body.source || 'manual'
    })
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// API: LLM Memory — keyword search
app.get('/api/llm-memory/:agentId/search', requireRole('teacher'), (req, res) => {
  try {
    const results = searchMemories({
      agent_id: req.params.agentId,
      student_id: req.query.student_id || undefined,
      query: req.query.q || '',
      limit: parseInt(req.query.limit) || 10
    })
    res.json({ results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// API: LLM Memory — delete single memory
app.delete('/api/llm-memory/:id', requireRole('teacher'), (req, res) => {
  try {
    const result = deleteMemory(req.params.id)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// API: Knowledge Base — TF-IDF semantic search
app.get('/api/kb/search', requireAuth, (req, res) => {
  try {
    const results = searchKnowledge(req.query.q || '', parseInt(req.query.limit) || 10)
    res.json({ results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// API: Knowledge Base — document list (paginated from kb_documents table)
app.get('/api/kb/documents', requireAuth, (req, res) => {
  try {
    const db = getDb()
    const page = parseInt(req.query.page) || 1
    const perPage = parseInt(req.query.per_page) || 20
    const offset = (page - 1) * perPage
    const rows = db.prepare('SELECT id, path, title, category, student_id, created_at FROM kb_documents ORDER BY created_at DESC LIMIT ? OFFSET ?').all(perPage, offset)
    const total = db.prepare('SELECT COUNT(*) as c FROM kb_documents').get().c
    res.json({ documents: rows, total, page, per_page: perPage })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// API: Knowledge Base — rebuild full index
app.post('/api/kb/index', requireRole('teacher'), (req, res) => {
  try {
    const count = indexAll()
    res.json({ ok: true, indexed: count })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// API: Knowledge Base — stats
app.get('/api/kb/stats', requireAuth, (req, res) => {
  try {
    res.json(getDocumentStats())
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// API: Knowledge Base — entity graph (student→project→task→meeting)
app.get('/api/kb/graph', requireRole('teacher'), (req, res) => {
  try {
    res.json(getKnowledgeGraph())
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- Start ---

// ============================================================
// Ontology API (Roadmap 2.2 Phase 1)
// ============================================================
app.get('/api/ontology/stats', requireRole('teacher'), (req, res) => {
  try {
    res.json(getOntologyStats());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/ontology/entities', requireAuth, (req, res) => {
  try {
    res.json(buildAllEntities());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/ontology/graph/:type/:id', requireAuth, (req, res) => {
  try {
    const graph = getEntityGraph(req.params.type, req.params.id);
    res.json(graph);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/ontology/search', requireAuth, (req, res) => {
  try {
    const q = req.query.q || '';
    res.json(searchEntities(q));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ontology/relation', requireRole('teacher'), (req, res) => {
  try {
    const { from_type, from_id, to_type, to_id, type, metadata } = req.body;
    const rel = addRelation(from_type, from_id, to_type, to_id, type, metadata);
    res.json(rel);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/ontology/relation/:id', requireRole('teacher'), (req, res) => {
  try {
    const ok = removeRelation(req.params.id);
    res.json({ success: ok });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ontology/nl', requireRole('teacher'), (req, res) => {
  try {
    const text = req.body.text || '';
    const result = applyNaturalLanguage(text);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ============================================================
// Flywheel API (Roadmap 2.2 Phase 2)
// ============================================================
app.get('/api/flywheel/stats', requireRole('teacher'), (req, res) => {
  try {
    res.json(getFlywheelStats());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/flywheel/log', requireRole('teacher'), (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    res.json(getFlywheelLog(limit));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ===== Course Routes =====
app.get('/api/courses', (req, res) => {
  try { res.json(listCourses()) } catch(e) { res.status(500).json({error:e.message}) }
})

app.get('/api/course/:name', (req, res) => {
  try {
    const detail = getCourseDetail(req.params.name)
    if (!detail) return res.status(404).json({error:'Course not found'})
    res.json(detail)
  } catch(e) { res.status(500).json({error:e.message}) }
})

app.put('/api/course/:name/week', requireAuth, requireRole('teacher'), (req, res) => {
  try {
    const updated = updateCurrentWeek(req.params.name, req.body.week)
    if (!updated) return res.status(404).json({error:'Course not found'})
    res.json(updated)
  } catch(e) { res.status(500).json({error:e.message}) }
})

app.get('/api/course/:name/progress', (req, res) => {
  try {
    const p = getCourseProgress(req.params.name)
    if (!p) return res.status(404).json({error:'Course not found'})
    res.json(p)
  } catch(e) { res.status(500).json({error:e.message}) }
})


// ===== Value Goal Tree (价值目标树) =====
app.get('/api/goal-tree', requireAuth, (req, res) => {
  try {
    const tree = buildValueGoalTree();
    res.json(tree);
  } catch(e) { res.status(500).json({error:e.message}) }
});

app.get('/api/goal-tree/dependencies', requireAuth, (req, res) => {
  try {
    const deps = getDependencyMap();
    res.json(deps);
  } catch(e) { res.status(500).json({error:e.message}) }
});

// ===== Daily Brief (每日信息) =====
app.get('/api/daily-brief', requireAuth, (req, res) => {
  try {
    const today = new Date().toISOString().slice(0,10);
    const user = req.user;
    
    // Tasks
    const taskData = loadTasks();
    let myTasks = taskData.tasks || [];
    if (user.role === 'student' || user.role === 'grad' || user.role === 'undergrad') {
      myTasks = myTasks.filter(t => t.owner_student_id === user.id);
    }
    const overdueTasks = myTasks.filter(t => t.status !== 'done' && t.deadline && t.deadline < today);
    const dueToday = myTasks.filter(t => t.status !== 'done' && t.deadline === today);
    const inProgress = myTasks.filter(t => t.status === 'in_progress');
    
    // Board stats
    const stats = getBoardStats();
    
    // News
    let news = [];
    try { news = getLatestNews(5) || []; } catch {}
    
    // External events
    let events = [];
    try { events = getRecentEvents(5) || []; } catch {}
    
    // Calendar events
    let calEvents = [];
    try {
      const cal = loadCalendarEvents();
      calEvents = (cal.events || []).filter(e => e.date === today || e.date >= today).slice(0, 5);
    } catch {}
    
    // Goal tree stats
    const tree = buildValueGoalTree();
    
    res.json({
      date: today,
      overdue_tasks: overdueTasks,
      due_today: dueToday,
      in_progress: inProgress,
      board_stats: stats,
      news,
      events,
      calendar: calEvents,
      goal_tree_stats: tree.stats,
      user_role: user.role,
    });
  } catch(e) { res.status(500).json({error:e.message}) }
});

// ===== Ideas / Inspiration Factory (灵感工厂) =====
app.get('/api/ideas', requireAuth, (req, res) => {
  try {
    const user = req.user;
    if (req.query.shared === 'true') {
      const shared = listIdeas({ shared: true, limit: 100 });
      return res.json({ ideas: shared });
    }
    const authorId = (user.role === 'teacher') ? (req.query.author || null) : user.id;
    const ideas = listIdeas({ author_id: authorId, limit: 50 });
    res.json({ ideas });
  } catch(e) { res.status(500).json({error:e.message}) }
});

app.post('/api/ideas', requireAuth, (req, res) => {
  try {
    const user = req.user;
    const idea = storeIdea({
      author_id: user.id,
      author_name: user.name || user.id,
      author_role: user.role,
      title: req.body.title || '',
      content: req.body.content || '',
      tags: req.body.tags || [],
      source: req.body.source || 'manual',
      shared: req.body.shared || false,
    });
    res.json(idea);
  } catch(e) { res.status(500).json({error:e.message}) }
});

app.delete('/api/ideas/:id', requireAuth, requireRole('teacher'), (req, res) => {
  try {
    const ok = deleteIdea(req.params.id);
    if (!ok) return res.status(404).json({error:'Idea not found'});
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}) }
});

app.put('/api/ideas/:id/status', requireAuth, (req, res) => {
  try {
    const idea = updateIdeaStatus(req.params.id, req.body.status);
    if (!idea) return res.status(404).json({error:'Idea not found'});
    res.json(idea);
  } catch(e) { res.status(500).json({error:e.message}) }
});

// Spark ideas via SSE
app.post('/api/ideas/:id/like', requireAuth, (req, res) => {
  try {
    const idea = likeIdea(req.params.id, req.user.id);
    if (!idea) return res.status(404).json({error:'Idea not found'});
    res.json(idea);
  } catch(e) { res.status(500).json({error:e.message}) }
});

app.post('/api/ideas/spark', requireAuth, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Build daily brief for context
  let dailyBrief = null;
  try {
    const today = new Date().toISOString().slice(0,10);
    const taskData = loadTasks();
    const stats = getBoardStats();
    let news = [];
    try { news = getLatestNews(5) || []; } catch {}
    let events = [];
    try { events = getRecentEvents(5) || []; } catch {}
    const overdueTasks = (taskData.tasks || []).filter(t => t.status !== 'done' && t.deadline && t.deadline < today);
    dailyBrief = { overdue_tasks: overdueTasks, news, events, board_stats: stats };
  } catch {}
  
  const controller = new AbortController();
  req.on('close', () => controller.abort());
  
  try {
    await sparkIdeasStream(req.body.idea || '', dailyBrief, (chunk) => {
      res.write('data: ' + JSON.stringify({chunk}) + '\n\n');
    }, controller.signal);
    res.write('data: ' + JSON.stringify({done:true}) + '\n\n');
  } catch(e) {
    res.write('data: ' + JSON.stringify({error: e.message}) + '\n\n');
  }
  res.end();
});

// C-level Agent system prompts (CEO/CFO/CTO/CMO/CAIO/CBO/CHO)
const AGENT_PROMPTS = {
  ceo: '你是课题组的CEO（首席执行官）AI Agent。你负责战略决策、资源分配、优先级判断。从全局视角分析问题，给出战略级建议。简洁有力。',
  cfo: '你是课题组的CFO（首席财务官）AI Agent。你负责经费管理、预算分配、项目成本控制、经费使用效率分析。',
  cto: '你是课题组的CTO（首席技术官）AI Agent。你负责技术方向选择、研究方法评估、工具选型、技术风险评估。',
  cmo: '你是课题组的CMO（首席营销官）AI Agent。你负责投稿策略、期刊选择、学术影响力提升、研究成果推广。',
  caio: '你是课题组的CAIO（首席AI官）AI Agent。你负责AI工具选型、模型策略、自动化方案设计、智能体编排。',
  cbo: '你是课题组的CBO（首席商务官）AI Agent。你负责产学研合作、专利转化、商业化路径、企业合作对接。',
  cho: '你是课题组的CHO（首席人才官）AI Agent。你负责学生培养、团队管理、梯队建设、能力评估、毕业进度跟踪。',
  manager: '你是课题组大管家AI助手。你可以看到全部学生状态数据。简洁回答。',
};

const server = // --- API: Global Chat (bottom bar, all pages) ---

// --- API: Global Chat (bottom bar, all pages) ---
app.post('/api/global-chat', requireAuth, async (req, res) => {
  const u = req.user
  const message = req.body?.message?.trim()
  if (!message) { res.status(400).json({ error: 'no message' }); return }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })
  let agentId = req.body?.agent_id || 'manager'
  let sys = AGENT_PROMPTS[agentId] || AGENT_PROMPTS.manager
  let ctx = ''
  if (u.role === 'teacher') {
    try { ctx = buildManagerContext() } catch {}
    // sys already set by agent_id above
  } else {
    try { ctx = await buildStudentContext(u.id) || '' } catch {}
    sys = AGENT_PROMPTS[agentId] || AGENT_PROMPTS.caio || '你是学生AI助手。简洁回答。'
  }
  const msgs = [
    { role: 'system', content: sys + '\n' + ctx },
    { role: 'user', content: message }
  ]
  let fullText = ''
  chatStream(msgs, (chunk) => {
    fullText += chunk
    res.write('data: ' + JSON.stringify({ content: chunk }) + '\n\n')
  }).then(() => {
    res.write('data: [DONE]\n\n')
    res.end()
  }).catch(e => {
    res.write('data: ' + JSON.stringify({ error: e.message }) + '\n\n')
    res.end()
  })
})


app.listen(PORT, () => {
  console.log(`\n  AutoProf Lab Brief v2 ready:`)
  console.log(`  Login:    http://localhost:${PORT}/login`)
  console.log(`  Teacher:  http://localhost:${PORT}/teacher`)
  console.log(`  Student:  http://localhost:${PORT}/student`)
  console.log(`  AI:       ${hasApiKey() ? 'DeepSeek connected' : 'No API key (AI disabled)'}\n`)
})

// --- WebSocket: STT (Feature 2 语音) ---
const wss = new WebSocketServer({ server, path: '/api/stt' })
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'stt_status', ...getSttStatus() }))

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      if (msg.type === 'transcript') {
        appendTranscript(msg.meetingId || 'default', msg.text)
        for (const client of wss.clients) {
          if (client !== ws && client.readyState === 1) {
            client.send(JSON.stringify({ type: 'transcript', text: msg.text, speaker: msg.speaker || '' }))
          }
        }
      }
      if (msg.type === 'start_session') {
        startMeetingSession(msg.meetingId || 'default')
      }
      if (msg.type === 'end_session') {
        const session = endMeetingSession(msg.meetingId || 'default')
        ws.send(JSON.stringify({ type: 'session_ended', transcript: session?.transcript || '' }))
      }
    } catch (e) {
      console.error('[stt] ws message error:', e.message)
    }
  })
})
import { loadSkillManifest, runSkill } from './lib/skills.js'
import { getScenarios as getInterviewScenarios, startInterview, continueInterview } from './lib/interview.js'
import { getCourseDetail, listCourses, updateCurrentWeek, getCourseProgress } from './lib/course.js'
import { buildValueGoalTree, getDependencyMap } from './lib/goal-tree.js'
import { storeIdea, listIdeas, sparkIdeasStream, buildSparkContext, updateIdeaStatus, deleteIdea, likeIdea } from './lib/ideas.js'
// --- API: AI 工具箱 (Feature 6/16) ---
app.get('/api/skills', requireAuth, (req, res) => {
  const manifest = loadSkillManifest()
  res.json({ skills: manifest })
})

app.post('/api/skills/:name', requireAuth, (req, res) => {
  const { name } = req.params
  const { input } = req.body
  if (!input || !input.trim()) {
    return res.status(400).json({ error: 'Input is empty' })
  }
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
  let fullText = ''
  runSkill(name, input, (chunk) => {
    fullText += chunk
    res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
  }).then(() => {
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()
  }).catch((e) => {
    console.error('[skills] stream error:', e.message)
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`)
    res.end()
  })
})

// --- API: STT Status (Feature 2 语音) ---
