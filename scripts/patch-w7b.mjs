import { readFileSync, writeFileSync } from 'fs'

// === W7b: kanban.js 状态机 ===
const kanban = readFileSync('lib/kanban.js', 'utf8')

const w7bCode = `

// --- W7b: 状态机 transition guards + evidence ---
const VALID_TRANSITIONS = {
  todo: ['in_progress', 'blocked', 'done'],
  in_progress: ['done', 'blocked', 'todo'],
  blocked: ['todo', 'in_progress', 'done'],
  done: ['todo', 'in_progress'],
}

export function canTransition(from, to) {
  const allowed = VALID_TRANSITIONS[from]
  return allowed ? allowed.includes(to) : false
}

export function getValidTransitions(status) {
  return VALID_TRANSITIONS[status] || []
}

export function transitionTask(taskId, newStatus, evidence = '') {
  const data = loadTasks()
  const task = data.tasks.find(t => t.task_id === taskId)
  if (!task) return { ok: false, error: 'task not found' }

  const oldStatus = task.status
  if (oldStatus === newStatus) return { ok: true, task, transition: null }

  if (!canTransition(oldStatus, newStatus)) {
    return { ok: false, error: \`invalid transition: \${oldStatus} -> \${newStatus}\` }
  }

  task.status = newStatus
  task.updated_at = new Date().toISOString()

  if (!task.transition_history) task.transition_history = []
  task.transition_history.push({
    from: oldStatus,
    to: newStatus,
    evidence: evidence || '',
    timestamp: new Date().toISOString(),
    actor: 'unknown',
  })

  saveTasks(data)
  return { ok: true, task, transition: { from: oldStatus, to: newStatus, evidence } }
}
`

if (!kanban.includes('canTransition')) {
  const insertPos = kanban.indexOf('// --- Cordis 形态')
  if (insertPos === -1) { console.error('FATAL: cordis section not found'); process.exit(1) }
  const updated = kanban.slice(0, insertPos) + w7bCode + '\n' + kanban.slice(insertPos)
  // Update default export
  const oldExport = 'export default {'
  const newExport = 'export default {'
  const updatedExport = updated.replace(oldExport, oldExport)
  // Add to default export
  const oldDefault = "  getRoster, apply,\n}"
  const newDefault = "  getRoster, apply,\n  canTransition, getValidTransitions, transitionTask,\n}"
  const final = updatedExport.replace(oldDefault, newDefault)
  writeFileSync('lib/kanban.js', final)
  console.log('OK: kanban.js W7b state machine added')
} else {
  console.log('SKIP: canTransition already exists')
}
