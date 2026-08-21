import { readFileSync, writeFileSync } from 'fs'
const s = readFileSync('server.js', 'utf8')

// 1. Add imports
const oldImport = "import { createDecision, listDecisions, getDecision, updateDecision, deleteDecision, updateOutcome, getAllDecisions, getDecisionStats } from './lib/decisions.js'"
if (!s.includes(oldImport)) { console.error('FATAL: decisions import not found'); process.exit(1) }
let updated = s.replace(oldImport, oldImport + `

import { canTransition, getValidTransitions, transitionTask } from './lib/kanban.js'
import { getLabState, recordReward, getRewards, getLabRewardSummary, deleteReward } from './lib/lab-state.js'`)

// 2. Add routes after board stats
const insertAfter = `app.get('/api/board/stats', requireRole('teacher'), (req, res) => {
  res.json({ stats: getBoardStats() })
})`

const newRoutes = `app.get('/api/board/stats', requireRole('teacher'), (req, res) => {
  res.json({ stats: getBoardStats() })
})

// --- API: Kanban State Machine (W7b) ---
app.get('/api/tasks/:id/transitions', requireAuth, (req, res) => {
  const { loadTasks } = await import('./lib/kanban.js')
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
  res.json(result)
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
})`

if (!updated.includes(insertAfter)) { console.error('FATAL: board stats route not found'); process.exit(1) }
updated = updated.replace(insertAfter, newRoutes)

writeFileSync('server.js', updated)
console.log('OK: server.js routes added')
