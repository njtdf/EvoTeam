import { readFileSync, writeFileSync } from 'fs'

// 1. Add external-events import + routes to server.js
const s = readFileSync('server.js', 'utf8')

const oldImport = "import { getLabState, recordReward, getRewards, getLabRewardSummary, deleteReward } from './lib/lab-state.js'"
const newImport = oldImport + `
import { recordEvent, recordFromNews, recordFromEmails, getUnprocessed, markProcessed, getRecentEvents, buildExternalContext, getEventStats } from './lib/external-events.js'`

if (!s.includes(oldImport)) { console.error('FATAL: lab-state import not found'); process.exit(1) }
let updated = s.replace(oldImport, newImport)

// Add routes after rewards routes
const rewardsEnd = "app.delete('/api/rewards/:rewardId', requireRole('teacher'), (req, res) => {\n  const ok = deleteReward(req.params.rewardId)\n  res.json({ ok })\n})"

const newRoutes = rewardsEnd + `

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
    const { getBoardStats } = await import('./kanban.js')
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
})`

if (!updated.includes(rewardsEnd)) { console.error('FATAL: rewards route not found'); process.exit(1) }
updated = updated.replace(rewardsEnd, newRoutes)

writeFileSync('server.js', updated, 'utf-8')
console.log('OK: server.js updated with W10/W14/W15 routes')
