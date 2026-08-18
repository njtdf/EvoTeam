// auth.js - Session-based authentication (MVP)
// In-memory session store, cookie-based

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { load as parseYaml } from 'js-yaml'
import { randomBytes } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sessions = new Map()

// Load all users from students.yaml
export function loadUsers() {
  const path = join(__dirname, '..', 'labos', 'students.yaml')
  if (!existsSync(path)) return []
  const raw = readFileSync(path, 'utf-8')
  const parsed = parseYaml(raw)
  return parsed.students || []
}

// Find user by id + password
export function authenticate(userId, password) {
  const users = loadUsers()
  const user = users.find(u => u.id === userId && u.password === password)
  if (!user) return null
  return {
    id: user.id,
    name: user.name,
    role: user.role || 'grad',
    project: user.project,
    active: user.active !== false,
  }
}

// Create session, return session id
export function createSession(user) {
  const sid = randomBytes(32).toString('hex')
  sessions.set(sid, {
    id: user.id,
    name: user.name,
    role: user.role,
    project: user.project,
  })
  return sid
}

// Get user from session
export function getSession(sid) {
  return sessions.get(sid) || null
}

// Delete session
export function destroySession(sid) {
  sessions.delete(sid)
}

// Express middleware: require auth
export function requireAuth(req, res, next) {
  const sid = getSessionId(req)
  const user = sid ? getSession(sid) : null
  if (!user) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
    return res.redirect('/login')
  }
  req.user = user
  next()
}

// Express middleware: require specific role
export function requireRole(role) {
  return (req, res, next) => {
    const sid = getSessionId(req)
    const user = sid ? getSession(sid) : null
    if (!user) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Not authenticated' })
      }
      return res.redirect('/login')
    }
    if (user.role !== role) {
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      return res.redirect(user.role === 'teacher' ? '/teacher' : '/student')
    }
    req.user = user
    next()
  }
}

// Extract session id from cookie
function getSessionId(req) {
  const cookie = req.headers.cookie || ''
  const match = cookie.match(/sid=([^;]+)/)
  return match ? match[1] : null
}

// Set session cookie on response
export function setSessionCookie(res, sid) {
  res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; Path=/; SameSite=Strict`)
}

// Clear session cookie
export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0')
}
