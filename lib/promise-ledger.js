// lib/promise-ledger.js -- Promise Ledger (Li Kaifu execution closed-loop engine)
// Meeting minutes -> AI extract promises -> track fulfillment -> consistency index
// Four components: 1.Promise Ledger 2.Goal Tree 3.Overdue Warning 4.Consistency Index

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { load as parseYaml } from 'js-yaml'
import { extractPromises } from './ai.js'
import { loadActions, loadMeeting } from './meeting.js'
import { loadTasks, getTasksByStudent } from './kanban.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LABOS_DIR = join(__dirname, '..', 'labos')
const PROMISES_FILE = join(LABOS_DIR, 'promises.json')
const ROLLING_WINDOW_DAYS = 180

// ============================================================
// Storage
// ============================================================

function ensureDir() {
  mkdirSync(LABOS_DIR, { recursive: true })
}

function loadPromises() {
  if (!existsSync(PROMISES_FILE)) return { promises: [], next_id: 1 }
  try {
    return JSON.parse(readFileSync(PROMISES_FILE, 'utf-8'))
  } catch {
    return { promises: [], next_id: 1 }
  }
}

function savePromises(data) {
  ensureDir()
  writeFileSync(PROMISES_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

function getRoster() {
  const path = join(__dirname, '..', 'labos', 'students.yaml')
  if (!existsSync(path)) return []
  const raw = readFileSync(path, 'utf-8')
  const parsed = parseYaml(raw)
  return (parsed.students || [])
    .filter(s => s.active !== false && s.role !== 'teacher')
    .map(s => ({ id: s.id, name: s.name, project: s.project }))
}

function matchNameToId(name, roster) {
  const byName = new Map(roster.map(r => [r.name, r.id]))
  const n = (name || '').trim()
  return n && byName.has(n) ? byName.get(n) : null
}

// ============================================================
// 1. Promise CRUD
// ============================================================

export function createPromise(input) {
  const data = loadPromises()
  const id = `P-${String(data.next_id).padStart(3, '0')}`
  const now = new Date().toISOString()

  const roster = getRoster()
  let studentId = input.promiser_student_id || null
  let promiserName = input.promiser_name || ''
  if (!studentId && promiserName) {
    studentId = matchNameToId(promiserName, roster)
  }
  if (studentId && !promiserName) {
    const m = roster.find(r => r.id === studentId)
    if (m) promiserName = m.name
  }

  const promise = {
    promise_id: id,
    meeting_date: input.meeting_date || '',
    promiser_student_id: studentId,
    promiser_name: promiserName,
    promise: input.promise || '',
    deadline: input.deadline || '',
    promisee: input.promisee || '',
    source_section: input.source_section || '',
    status: 'pending',
    fulfilled_at: null,
    fulfillment_evidence: '',
    task_id: null,
    unmatched: !studentId,
    created_at: now,
    updated_at: now,
  }

  data.promises.push(promise)
  data.next_id++
  savePromises(data)
  return promise
}

export function getPromises(filters = {}) {
  const data = loadPromises()
  let list = data.promises

  if (filters.student_id) {
    list = list.filter(p => p.promiser_student_id === filters.student_id)
  }
  if (filters.meeting_date) {
    list = list.filter(p => p.meeting_date === filters.meeting_date)
  }
  if (filters.status) {
    list = list.filter(p => p.status === filters.status)
  }

  return list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
}

export function fulfillPromise(promiseId, evidence = '') {
  const data = loadPromises()
  const p = data.promises.find(x => x.promise_id === promiseId)
  if (!p) return null

  p.status = 'fulfilled'
  p.fulfilled_at = new Date().toISOString()
  p.fulfillment_evidence = evidence
  p.updated_at = new Date().toISOString()
  savePromises(data)
  return p
}

export function markOverdue() {
  const data = loadPromises()
  const today = new Date().toISOString().slice(0, 10)
  let changed = false

  for (const p of data.promises) {
    if (p.status === 'pending' && p.deadline && p.deadline < today) {
      p.status = 'overdue'
      p.updated_at = new Date().toISOString()
      changed = true
    }
  }

  if (changed) savePromises(data)
  return changed
}

export function getOverduePromises() {
  markOverdue()
  return getPromises({ status: 'overdue' })
}

// ============================================================
// 2. Overdue Warning
// ============================================================

export function getUpcomingDeadlines(days = 7) {
  const data = loadPromises()
  const today = new Date()
  const future = new Date(today.getTime() + days * 86400000)

  return data.promises
    .filter(p => {
      if (p.status !== 'pending' || !p.deadline) return false
      const dl = new Date(p.deadline)
      return dl >= today && dl <= future
    })
    .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))
}

export function getPromiseUrgency(promise) {
  if (promise.status === 'fulfilled') return 'done'
  if (promise.status === 'overdue') return 'overdue'
  if (!promise.deadline) return 'no_deadline'

  const today = new Date()
  const dl = new Date(promise.deadline)
  const diffDays = Math.ceil((dl - today) / 86400000)

  if (diffDays < 0) return 'overdue'
  if (diffDays <= 3) return 'urgent'
  if (diffDays <= 7) return 'warning'
  return 'normal'
}

// ============================================================
// 3. Consistency Index
// ============================================================

export function getConsistencyIndex(studentId) {
  if (!studentId) return null

  const data = loadPromises()
  const cutoff = new Date(Date.now() - ROLLING_WINDOW_DAYS * 86400000)

  const myPromises = data.promises.filter(p => {
    if (p.promiser_student_id !== studentId) return false
    const created = new Date(p.created_at || p.meeting_date || 0)
    return created >= cutoff
  })

  if (myPromises.length === 0) {
    return {
      student_id: studentId,
      total: 0,
      fulfilled: 0,
      overdue: 0,
      pending: 0,
      consistency_pct: 0,
      rating: 'no_data',
    }
  }

  const fulfilled = myPromises.filter(p => p.status === 'fulfilled').length
  const overdue = myPromises.filter(p => p.status === 'overdue').length
  const pending = myPromises.filter(p => p.status === 'pending').length

  const consistency_pct = Math.round((fulfilled / myPromises.length) * 100)

  let rating = 'C'
  if (consistency_pct >= 90) rating = 'A'
  else if (consistency_pct >= 70) rating = 'B'
  else if (consistency_pct >= 50) rating = 'C'
  else rating = 'D'

  return {
    student_id: studentId,
    total: myPromises.length,
    fulfilled,
    overdue,
    pending,
    consistency_pct,
    rating,
  }
}

export function getAllConsistencyIndices() {
  const roster = getRoster()
  return roster.map(s => {
    const idx = getConsistencyIndex(s.id)
    return { ...s, ...idx }
  }).sort((a, b) => (b.consistency_pct || 0) - (a.consistency_pct || 0))
}

// ============================================================
// 4. Goal Tree
// ============================================================

export function getGoalTree() {
  const roster = getRoster()
  const taskData = loadTasks()

  const projects = {}
  for (const s of roster) {
    const proj = s.project || 'Unassigned'
    if (!projects[proj]) {
      projects[proj] = { name: proj, students: [], tasks: [], total_tasks: 0, done_tasks: 0 }
    }
    projects[proj].students.push({ id: s.id, name: s.name })

    const myTasks = (taskData.tasks || []).filter(t => t.owner_student_id === s.id)
    for (const t of myTasks) {
      projects[proj].tasks.push({
        task_id: t.task_id,
        title: t.title,
        status: t.status,
        deadline: t.deadline,
        owner: s.name,
      })
      projects[proj].total_tasks++
      if (t.status === 'done') projects[proj].done_tasks++
    }
  }

  const tree = Object.values(projects).map(p => ({
    ...p,
    progress_pct: p.total_tasks > 0 ? Math.round((p.done_tasks / p.total_tasks) * 100) : 0,
  }))

  const totalTasks = tree.reduce((s, p) => s + p.total_tasks, 0)
  const doneTasks = tree.reduce((s, p) => s + p.done_tasks, 0)

  return {
    lab_objective: 'Power System Resilience & AI-Native Lab Workbench',
    overall_progress: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
    total_tasks: totalTasks,
    done_tasks: doneTasks,
    projects: tree,
  }
}

// ============================================================
// Auto-extract from meeting
// ============================================================

export async function autoExtractFromMeeting(date) {
  const md = loadMeeting(date)
  if (!md) throw new Error(`Meeting ${date} not found`)

  const roster = getRoster()
  const ai = await extractPromises(md, roster)

  if (!ai || ai.status === 'no_api_key') {
    return { date, status: 'no_api_key', promises: [], extracted: 0 }
  }
  if (ai.status === 'error') {
    return { date, status: 'error', error: ai.error, promises: [], extracted: 0 }
  }

  const created = []
  for (const raw of (ai.promises || [])) {
    const studentId = matchNameToId(raw.promiser, roster)
    const p = createPromise({
      meeting_date: date,
      promiser_name: raw.promiser || '',
      promiser_student_id: studentId,
      promise: raw.promise || '',
      deadline: raw.deadline || '',
      promisee: raw.promisee || '',
      source_section: raw.source_section || '',
    })
    created.push(p)
  }

  return {
    date,
    status: 'ok',
    promises: created,
    extracted: created.length,
    unmatched: created.filter(p => p.unmatched).length,
  }
}

// ============================================================
// Stats
// ============================================================

export function getPromiseStats() {
  const data = loadPromises()
  const promises = data.promises

  const byStatus = { pending: 0, fulfilled: 0, overdue: 0 }
  for (const p of promises) {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1
  }

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = promises.filter(p =>
    p.status === 'pending' && p.deadline && p.deadline >= today
  ).length

  return {
    total: promises.length,
    pending: byStatus.pending,
    fulfilled: byStatus.fulfilled,
    overdue: byStatus.overdue,
    upcoming_deadlines: upcoming,
    next_id: data.next_id,
  }
}

// ============================================================
// Cordis form
// ============================================================

export function apply(ctx, config = {}) {
  const ns = config.namespace || 'promiseLedger'
  if (ctx.reflect?.provide) {
    ctx.reflect.provide(ns, {
      createPromise, getPromises, fulfillPromise, markOverdue,
      getOverduePromises, getUpcomingDeadlines, getPromiseUrgency,
      getConsistencyIndex, getAllConsistencyIndices,
      getGoalTree, autoExtractFromMeeting, getPromiseStats,
    })
  }
  ctx.effect(() => () => {})
}

export default {
  createPromise, getPromises, fulfillPromise, markOverdue,
  getOverduePromises, getUpcomingDeadlines, getPromiseUrgency,
  getConsistencyIndex, getAllConsistencyIndices,
  getGoalTree, autoExtractFromMeeting, getPromiseStats, apply,
}
