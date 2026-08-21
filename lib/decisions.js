import { loadValueCycle, saveValueCycle } from './valuecycle.js'
import { getDb } from './db.js'

// Decision record: { id, date, decision, rationale, outcome, source, created_at }
// Stored in valuecycle.decision_log array + synced to DB

let counter = 0

function genId() {
  counter++
  return 'D-' + Date.now().toString(36).toUpperCase() + '-' + counter
}

export function createDecision(studentId, { decision, rationale, outcome, source }) {
  const vc = loadValueCycle(studentId)
  if (!Array.isArray(vc.decision_log)) vc.decision_log = []
  const entry = {
    id: genId(),
    date: new Date().toISOString().slice(0, 10),
    decision: decision || '',
    rationale: rationale || '',
    outcome: outcome || 'pending',
    source: source || 'manual',
    created_at: new Date().toISOString(),
  }
  vc.decision_log.push(entry)
  saveValueCycle(studentId, vc)
  syncToDb(studentId, vc)
  return entry
}

export function listDecisions(studentId) {
  const vc = loadValueCycle(studentId)
  return vc.decision_log || []
}

export function getDecision(studentId, decisionId) {
  const vc = loadValueCycle(studentId)
  return (vc.decision_log || []).find(d => d.id === decisionId)
}

export function updateDecision(studentId, decisionId, patch) {
  const vc = loadValueCycle(studentId)
  const log = vc.decision_log || []
  const idx = log.findIndex(d => d.id === decisionId)
  if (idx < 0) throw new Error(`Decision ${decisionId} not found for ${studentId}`)
  log[idx] = { ...log[idx], ...patch }
  vc.decision_log = log
  saveValueCycle(studentId, vc)
  syncToDb(studentId, vc)
  return log[idx]
}

export function deleteDecision(studentId, decisionId) {
  const vc = loadValueCycle(studentId)
  const log = vc.decision_log || []
  const filtered = log.filter(d => d.id !== decisionId)
  if (filtered.length === log.length) throw new Error(`Decision ${decisionId} not found`)
  vc.decision_log = filtered
  saveValueCycle(studentId, vc)
  syncToDb(studentId, vc)
  return { ok: true, deleted: decisionId }
}

export function updateOutcome(studentId, decisionId, outcome) {
  return updateDecision(studentId, decisionId, { outcome })
}

export function getAllDecisions(studentIds) {
  const all = []
  for (const id of studentIds) {
    for (const d of listDecisions(id)) {
      all.push({ ...d, student_id: id })
    }
  }
  return all.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
}

export function getDecisionStats(studentId) {
  const log = listDecisions(studentId)
  return {
    total: log.length,
    pending: log.filter(d => d.outcome === 'pending').length,
    positive: log.filter(d => d.outcome === 'positive' || d.outcome === 'good').length,
    negative: log.filter(d => d.outcome === 'negative' || d.outcome === 'bad').length,
    neutral: log.filter(d => d.outcome === 'neutral' || d.outcome === 'none').length,
    recent: log.slice(-5).reverse(),
  }
}

function syncToDb(studentId, vc) {
  let db
  try { db = getDb() } catch { return }
  const dataJson = JSON.stringify(vc)
  const row = db.prepare('SELECT student_id FROM value_cycles WHERE student_id = ?').get(studentId)
  if (row) {
    db.prepare('UPDATE value_cycles SET data_json = ?, updated_at = ? WHERE student_id = ?')
      .run(dataJson, new Date().toISOString(), studentId)
  } else {
    db.prepare('INSERT INTO value_cycles (student_id, data_json, updated_at) VALUES (?, ?, ?)')
      .run(studentId, dataJson, new Date().toISOString())
  }
}

// Cordis apply form
export function apply(ctx, config = {}) {
  ctx.decisions = {
    createDecision, listDecisions, getDecision, updateDecision,
    deleteDecision, updateOutcome, getAllDecisions, getDecisionStats,
  }
  return ctx.decisions
}

export default {
  createDecision, listDecisions, getDecision, updateDecision,
  deleteDecision, updateOutcome, getAllDecisions, getDecisionStats, apply,
}
