// server.js - AutoProf Lab Brief v2
// Express 5 + Vue 3 SPA + DeepSeek AI
// Usage: node server.js

import express from 'express'
import { readFileSync, existsSync, statSync } from 'fs'
import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { load as parseYaml } from 'js-yaml'
import { parseReport, scanReportFiles } from './packages/lab-brief/lib/parser.js'
import { evaluateRisks } from './packages/lab-brief/lib/risk.js'
import { generateBrief } from './packages/lab-brief/lib/brief.js'
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
  createTask, updateTask, deleteTask, getAllTasks, getTasksByStudent,
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

const __dirname = dirname(fileURLToPath(import.meta.url))
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
app.use(express.static(join(__dirname, 'public')))

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
  const filePath = getLatestReport(config, req.params.id)
  if (!filePath) return res.status(404).json({ error: 'No report found' })
  const report = parseReport(filePath)
  res.json({ report })
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
  }).catch(e => {
    console.error('[submit] AI summary failed:', e.message)
  })

  res.json({ ok: true, file: `${week}.md`, student_id: studentId })
})

// --- API: Summary ---
app.get('/api/summary/:id', requireAuth, (req, res) => {
  const summary = loadSummary(req.params.id)
  res.json({ summary, has_api_key: hasApiKey() })
})

// --- API: Chat (SSE streaming) ---
app.get('/api/chat/:id', requireRole('teacher'), (req, res) => {
  const history = loadChat(req.params.id)
  res.json({ messages: history })
})

app.post('/api/chat/:id', requireRole('teacher'), (req, res) => {
  const studentId = req.params.id
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
  const aiMessages = injectContext(buildChatMessages(report, summary, chatHistory, message), studentId)

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
res.json({ brief, students })
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
   runExtraction(date).catch(e => {
     console.error('[meeting] extract failed:', e.message)
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
  const tasks = req.user.role === 'teacher'
    ? getAllTasks()
    : getTasksByStudent(req.user.id)
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
  const task = promoteMeetingAction(action)
  res.json({ ok: true, task })
})

app.get('/api/board/stats', requireRole('teacher'), (req, res) => {
  res.json({ stats: getBoardStats() })
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

// --- Start ---
const server = app.listen(PORT, () => {
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
