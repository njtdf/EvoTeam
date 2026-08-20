import { getDb } from './db.js'
import { extractMemories } from './ai.js'

/**
 * Store a single memory into the llm_memory table.
 */
export function storeMemory({ agent_id, student_id, memory_type, content, importance, source }) {
  const db = getDb()
  const stmt = db.prepare('INSERT INTO llm_memory (agent_id, student_id, memory_type, content, importance, source) VALUES (?, ?, ?, ?, ?, ?)')
  const info = stmt.run(
    agent_id || null,
    student_id || null,
    memory_type || 'note',
    content,
    importance || 5,
    source || 'chat'
  )
  return { id: info.lastInsertRowid, ok: true }
}

/**
 * Retrieve memories for an agent+student, ordered by importance DESC then recency.
 */
export function retrieveMemories({ agent_id, student_id, limit = 20 }) {
  const db = getDb()
  let sql = 'SELECT * FROM llm_memory WHERE 1=1'
  const params = []
  if (agent_id) { sql += ' AND agent_id = ?'; params.push(agent_id) }
  if (student_id) { sql += ' AND student_id = ?'; params.push(student_id) }
  sql += ' ORDER BY importance DESC, created_at DESC LIMIT ?'
  params.push(limit)
  return db.prepare(sql).all(...params)
}

/**
 * Keyword search across memories.
 */
export function searchMemories({ agent_id, student_id, query, limit = 10 }) {
  const db = getDb()
  let sql = 'SELECT * FROM llm_memory WHERE content LIKE ?'
  const params = ['%' + query + '%']
  if (agent_id) { sql += ' AND agent_id = ?'; params.push(agent_id) }
  if (student_id) { sql += ' AND student_id = ?'; params.push(student_id) }
  sql += ' ORDER BY importance DESC, created_at DESC LIMIT ?'
  params.push(limit)
  return db.prepare(sql).all(...params)
}

/**
 * Delete a single memory by id.
 */
export function deleteMemory(id) {
  const db = getDb()
  const info = db.prepare('DELETE FROM llm_memory WHERE id = ?').run(id)
  return { deleted: info.changes > 0, id }
}

/**
 * Build a context string for AI system prompts.
 * Returns a string like:
 * === Historical Memory ===
 * [decision] (8/10) student chose Benders decomposition
 * [feedback] (7/10) advisor said lit review needs more recent papers
 * ...
 * Returns empty string if no memories.
 */
export function buildMemoryContext(studentId, agentId) {
  const mems = retrieveMemories({ agent_id: agentId, student_id: studentId, limit: 15 })
  if (mems.length === 0) return ''

  const lines = ['=== Historical Memory ===']
  for (const m of mems) {
    const tag = m.memory_type || 'note'
    const imp = m.importance || 5
    lines.push('[' + tag + '] (' + imp + '/10) ' + m.content)
  }
  lines.push('=== End Memory ===')
  lines.push('Analyze considering the student graduation progress and risk level above.')
  return lines.join('\n')
}

/**
 * Auto-extract memories from a chat conversation using DeepSeek, then store them.
 * Called asynchronously after every N messages — should not block chat response.
 * Returns number of memories stored.
 */
export async function extractMemoriesFromChat(studentId, messages) {
  try {
    const extracted = await extractMemories(messages)
    if (!extracted || extracted.length === 0) return 0

    let stored = 0
    for (const m of extracted) {
      if (!m.content || m.content.length < 5) continue
      storeMemory({
        agent_id: 'steward',
        student_id: studentId,
        memory_type: m.memory_type || 'note',
        content: m.content,
        importance: m.importance || 5,
        source: 'chat'
      })
      stored++
    }
    console.log('[memory.js] Extracted', stored, 'memories for', studentId)
    return stored
  } catch (e) {
    console.error('[memory.js] extractMemoriesFromChat error:', e.message)
    return 0
  }
}

/**
 * Cordis apply() shape (W3 zero-effort integration).
 */
export function apply(ctx, config) {
  ctx.memory = {
    storeMemory, retrieveMemories, searchMemories, deleteMemory,
    buildMemoryContext, extractMemoriesFromChat
  }
  return ctx.memory
}

export default {
  storeMemory, retrieveMemories, searchMemories, deleteMemory,
  buildMemoryContext, extractMemoriesFromChat, apply
}
