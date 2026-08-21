import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LABOS_DIR = join(__dirname, '..', 'labos')

// Check if student has report files
function hasReport(studentId) {
  const dir = join(LABOS_DIR, 'reports', studentId)
  if (!existsSync(dir)) return false
  const files = readdirSync(dir).filter(f => f.endsWith('.md'))
  return files.length > 0
}

// Check if summary exists
function loadSummarySafe(studentId) {
  const p = join(LABOS_DIR, 'summaries', studentId + '.json')
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return null }
}

const content = `// lab-state.js — W8: LabState 聚合 + 奖励信号
// EvoTeam Layer 1: 课题组全局状态

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LABOS_DIR = join(__dirname, '..', 'labos')
const REWARDS_FILE = join(LABOS_DIR, 'rewards.json')
const LAB_STATE_CACHE = join(LABOS_DIR, 'lab-state.json')

function ensureDir() { mkdirSync(LABOS_DIR, { recursive: true }) }

// --- 奖励信号 CRUD ---
export function loadRewards() {
  if (!existsSync(REWARDS_FILE)) return []
  try { return JSON.parse(readFileSync(REWARDS_FILE, 'utf-8')) } catch { return [] }
}
export function saveRewards(rewards) { ensureDir(); writeFileSync(REWARDS_FILE, JSON.stringify(rewards, null, 2), 'utf-8') }
export function recordReward(studentId, signal, context = '') {
  const rewards = loadRewards()
  const entry = { reward_id: 'R-' + Date.now(), student_id: studentId, signal, context, timestamp: new Date().toISOString() }
  rewards.push(entry)
  if (rewards.length > 500) rewards.splice(0, rewards.length - 500)
  saveRewards(rewards)
  return entry
}
export function getRewards(studentId) { return loadRewards().filter(r => r.student_id === studentId) }
export function getLabRewardSummary() {
  const rewards = loadRewards()
  const bySignal = {}, byStudent = {}
  for (const r of rewards) {
    bySignal[r.signal] = (bySignal[r.signal] || 0) + 1
    byStudent[r.student_id] = (byStudent[r.student_id] || 0) + 1
  }
  return { total: rewards.length, bySignal, byStudent, recent: rewards.slice(-10) }
}
export function deleteReward(rewardId) {
  const rewards = loadRewards()
  const filtered = rewards.filter(r => r.reward_id !== rewardId)
  if (filtered.length < rewards.length) { saveRewards(filtered); return true }
  return false
}

// --- LabState 聚合 ---
export async function getLabState() {
  const state = { timestamp: new Date().toISOString(), students: { total: 0, by_role: {} }, tasks: { total: 0, by_status: {}, overdue: 0 }, reports: { submitted: 0, missing: 0 }, rewards: { total: 0, recent: [] }, risks: [], summary: '' }
  try {
    const { loadUsers } = await import('./auth.js')
    const users = loadUsers()
    const active = users.filter(u => u.active !== false && u.role !== 'teacher')
    state.students.total = active.length
    for (const s of active) state.students.by_role[s.role] = (state.students.by_role[s.role] || 0) + 1

    const { getBoardStats } = await import('./kanban.js')
    const stats = getBoardStats()
    state.tasks.total = stats.total
    state.tasks.by_status = stats.byStatus
    state.tasks.overdue = stats.overdue

    for (const s of active) {
      const dir = join(LABOS_DIR, 'reports', s.id)
      let hasReport = false
      if (existsSync(dir)) { hasReport = readdirSync(dir).filter(f => f.endsWith('.md')).length > 0 }
      if (hasReport) state.reports.submitted++; else state.reports.missing++
    }

    const rewardSummary = getLabRewardSummary()
    state.rewards.total = rewardSummary.total
    state.rewards.recent = rewardSummary.recent

    for (const s of active) {
      const p = join(LABOS_DIR, 'summaries', s.id + '.json')
      if (existsSync(p)) {
        try {
          const sum = JSON.parse(readFileSync(p, 'utf-8'))
          if (sum && sum.risks) for (const r of sum.risks) state.risks.push({ student_id: s.id, student_name: s.name, risk: r })
        } catch {}
      }
    }

    state.summary = state.students.total + ' students | ' + state.reports.submitted + '/' + state.students.total + ' reported | ' + state.tasks.total + ' tasks (' + state.tasks.overdue + ' overdue) | ' + state.rewards.total + ' rewards'
    ensureDir()
    writeFileSync(LAB_STATE_CACHE, JSON.stringify(state, null, 2), 'utf-8')
  } catch (e) { state.error = e.message }
  return state
}

export function apply(ctx, config = {}) {
  ctx.service('labState', {
    get: () => getLabState(),
    recordReward: (sid, signal, ctx) => recordReward(sid, signal, ctx),
    getRewards: (sid) => getRewards(sid),
    rewardSummary: () => getLabRewardSummary(),
  })
  ctx.on('ready', () => ctx.logger?.info?.('labState plugin ready'))
}

export default { loadRewards, saveRewards, recordReward, getRewards, getLabRewardSummary, deleteReward, getLabState, apply }
`
writeFileSync('lib/lab-state.js', content, 'utf-8')
console.log('OK lab-state.js rewritten')
