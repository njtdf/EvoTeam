import { readFileSync, writeFileSync } from 'fs'

const f = 'D:/OneDrive/7-SideWork/AutoProf/EvoTeam/server.js'
let c = readFileSync(f, 'utf8')

// 1. Add import after knowledge.js import
const importMarker = "import { indexAll, searchKnowledge, getDocumentStats, getKnowledgeGraph } from './lib/knowledge.js'"
const importNew = importMarker + "\nimport { runAgentLoop } from './lib/agent-loop.js'"
if (c.includes(importMarker) && !c.includes("agent-loop.js")) {
  c = c.replace(importMarker, importNew)
  console.log('1. Import added')
} else if (c.includes("agent-loop.js")) {
  console.log('1. Import already exists')
} else {
  console.log('1. Import marker NOT FOUND')
}

// 2. Add two routes after the progress/draft routes (after line ~490)
// Find the dashboard route as insertion point
const insertMarker = "// --- API: Dashboard"
const routesCode = `// --- API: Agent Loop (Phase 2: Waku-style agent) ---
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
        const body = (rep.raw || '').replace(/^[\\s\\S]*?---/, '').trim()
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
        res.write('data: ' + JSON.stringify({ chunk: text }) + '\\n\\n')
      },
      onToolCall: (name, args, result) => {
        res.write('data: ' + JSON.stringify({ tool: name, args }) + '\\n\\n')
      },
    })
    res.write('data: ' + JSON.stringify({ done: true }) + '\\n\\n')
    res.end()
  } catch (e) {
    console.error('[agent report-draft] error:', e.message)
    res.write('data: ' + JSON.stringify({ error: e.message }) + '\\n\\n')
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
        const body = (rep.raw || '').replace(/^[\\s\\S]*?---/, '').trim()
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
        res.write('data: ' + JSON.stringify({ chunk: text }) + '\\n\\n')
      },
      onToolCall: (name, args, result) => {
        res.write('data: ' + JSON.stringify({ tool: name, args }) + '\\n\\n')
      },
    })
    res.write('data: ' + JSON.stringify({ done: true }) + '\\n\\n')
    res.end()
  } catch (e) {
    console.error('[agent report-review] error:', e.message)
    res.write('data: ' + JSON.stringify({ error: e.message }) + '\\n\\n')
    res.end()
  }
})

`

if (c.includes('app.post(' + "'/api/agent/report-draft'")) {
  console.log('2. Routes already exist')
} else {
  c = c.replace(insertMarker, routesCode + insertMarker)
  console.log('2. Routes added')
}

writeFileSync(f, c, 'utf8')
console.log('server.js updated')
