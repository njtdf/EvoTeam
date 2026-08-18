// chat.js - Chat history storage (file-based)
// Per-student JSON file, keep last 50 messages

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
  return trimmed
}
