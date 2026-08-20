// chat.js - Chat history storage (file-based)
// Per-student JSON file, keep last 50 messages

import { logTrajectory } from './trajectory.js'
import { extractMemoriesFromChat } from './llm-memory.js'

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MAX_MESSAGES = 50

function chatPath(studentId) {
  return join(__dirname, '..', 'labos', 'chat', `${studentId}.json`)
}

// Load chat history for a student
export function loadChat(studentId) {
  const path = chatPath(studentId)
  if (!existsSync(path)) return []
  try {
    const raw = readFileSync(path, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

// Append a message and save (trims to last MAX_MESSAGES)
export function saveMessage(studentId, role, content) {
  const dir = join(__dirname, '..', 'labos', 'chat')
  mkdirSync(dir, { recursive: true })

  const history = loadChat(studentId)
  history.push({
    role,
    content,
    timestamp: new Date().toISOString(),
  })

  const trimmed = history.slice(-MAX_MESSAGES)
  writeFileSync(chatPath(studentId), JSON.stringify(trimmed, null, 2), 'utf-8')

  // v2.1 W7a: Every 5 messages, write a trajectory snapshot
  if (trimmed.length % 5 === 0) {
    try {
      logTrajectory({
        actor_type: 'student',
        actor_id: studentId,
        session_type: 'chat',
        messages: trimmed.slice(-5).map(m => ({
          role: m.role,
          content: m.content?.substring(0, 500),  // truncate for storage
          agent: 'deepseek'
        })),
        outcome: { snapshot: true, message_count: trimmed.length },
        tags: ['chat', studentId]
      })
    } catch (e) {
      // Trajectory failure must not affect chat
      console.error('[chat.js] trajectory log error:', e.message)
    }
  }

  // Wave 8: Auto-extract LLM memories every 5 messages (async, non-blocking)
  if (trimmed.length % 5 === 0) {
    extractMemoriesFromChat(studentId, trimmed).catch(() => {})
  }

  return trimmed
}
