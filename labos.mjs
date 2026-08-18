#!/usr/bin/env node
// labos.mjs - AutoProf LabOS CLI bridge (Feature 17)
// Connects Codex CLI / terminal to LabOS Web API
// Usage: node labos.mjs <command> [args]

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const COOKIE_PATH = join(homedir(), '.labos-cookie.json')
const ENV_PATH = join(process.cwd(), '.env')

function loadEnv() {
  if (!existsSync(ENV_PATH)) return {}
  const raw = readFileSync(ENV_PATH, 'utf-8')
  const env = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^(\w+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

function getBaseUrl() {
  // shell env vars take priority, then .env file, then default 3001
  if (process.env.LABOS_URL) return process.env.LABOS_URL
  const env = loadEnv()
  if (env.LABOS_URL) return env.LABOS_URL
  const port = process.env.PORT || env.PORT || 3001
  return `http://localhost:${port}`
}

function loadCookie() {
  if (!existsSync(COOKIE_PATH)) return null
  try {
    const data = JSON.parse(readFileSync(COOKIE_PATH, 'utf-8'))
    return data.cookie || null
  } catch { return null }
}

function saveCookie(cookie) {
  writeFileSync(COOKIE_PATH, JSON.stringify({ cookie, saved_at: new Date().toISOString() }, null, 2))
  console.log(`Cookie saved to ${COOKIE_PATH}`)
}

async function api(path, options = {}) {
  const base = getBaseUrl()
  const cookie = loadCookie()
  const headers = { 'Content-Type': 'application/json' }
  if (cookie) headers['Cookie'] = cookie
  const resp = await fetch(`${base}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  })
  const text = await resp.text()
  if (!resp.ok) {
    console.error(`Error ${resp.status}: ${text}`)
    process.exit(1)
  }
  try { return JSON.parse(text) }
  catch { return text }
}

async function cmdLogin(id, password) {
  if (!id || !password) {
    console.error('Usage: node labos.mjs login <id> <password>')
    process.exit(1)
  }
  const base = getBaseUrl()
  const resp = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_id: id, password }),
  })
  if (!resp.ok) {
    const txt = await resp.text()
    console.error(`Login failed: ${resp.status} ${txt}`)
    process.exit(1)
  }
  const setCookie = resp.headers.get('set-cookie')
  if (!setCookie) {
    console.error('No Set-Cookie header in response')
    process.exit(1)
  }
  const cookie = setCookie.split(';')[0]
  saveCookie(cookie)
  const data = await resp.json()
  console.log(`Logged in as ${data.user?.name || id} (${data.user?.role || 'unknown'})`)
}

async function cmdTasks() {
  const data = await api('/api/tasks')
  const tasks = data.tasks || []
  if (tasks.length === 0) { console.log('No tasks'); return }
  console.log(`${tasks.length} tasks:`)
  for (const t of tasks) {
    const icon = t.status === 'done' ? '[x]' : t.status === 'in_progress' ? '[>]' : t.status === 'blocked' ? '[!]' : '[ ]'
    const owner = t.owner_name || 'unassigned'
    const dl = t.deadline ? ` due:${t.deadline}` : ''
    const pri = t.priority ? ` ${t.priority}` : ''
    console.log(`  ${icon} ${t.task_id} ${t.title} -- ${owner}${dl}${pri}`)
  }
}

async function cmdReportSubmit(file) {
  if (!file) { console.error('Usage: node labos.mjs report submit <file>'); process.exit(1) }
  if (!existsSync(file)) { console.error(`File not found: ${file}`); process.exit(1) }
  const content = readFileSync(file, 'utf-8')
  const data = await api('/api/submit', { method: 'POST', body: JSON.stringify({ content }) })
  if (data.ok) console.log('Report submitted. AI summary generating...')
  else console.error('Submit failed')
}

async function cmdMeetingUpload(file, date) {
  if (!file || !date) { console.error('Usage: node labos.mjs meeting upload <file> <YYYY-MM-DD>'); process.exit(1) }
  if (!existsSync(file)) { console.error(`File not found: ${file}`); process.exit(1) }
  const content = readFileSync(file, 'utf-8')
  const data = await api('/api/meeting/upload', { method: 'POST', body: JSON.stringify({ date, content }) })
  if (data.ok) console.log(`Meeting uploaded for ${date}. AI extracting...`)
}

async function cmdBrief() {
  const data = await api('/api/brief')
  if (data.brief) {
    const content = typeof data.brief === 'string' ? data.brief : JSON.stringify(data.brief, null, 2)
    console.log(content)
  } else { console.log('No brief generated') }
}

async function cmdNews() {
  const data = await api('/api/news')
  const news = data.news || []
  if (news.length === 0) { console.log('No news'); return }
  console.log(`${news.length} news items:`)
  for (const n of news) {
    console.log(`  [${n.source || '?'}] ${n.title}`)
    if (n.link) console.log(`    ${n.link}`)
  }
}

async function cmdSubmissions() {
  const data = await api('/api/submissions')
  const subs = data.submissions || []
  if (subs.length === 0) { console.log('No submissions'); return }
  console.log(`${subs.length} submissions:`)
  for (const s of subs) {
    console.log(`  ${s.id} ${s.title} -- ${s.journal || '?'} (${s.status})`)
  }
}

async function cmdDashboard() {
  const data = await api('/api/dashboard')
  if (data.stats) {
    console.log(`Dashboard: ${data.stats.total} students, ${data.stats.reported} reported, ${data.stats.missing} missing, ${data.stats.overdue_tasks} overdue`)
  }
  if (data.students) {
    for (const s of data.students) {
      const icon = s.report_submitted ? '[x]' : '[ ]'
      const risks = s.risk_tags?.length ? ` risks:${s.risk_tags.join(';')}` : ''
      const tasks = s.open_tasks ? ` ${s.open_tasks} open` : ''
      console.log(`  ${icon} ${s.id} ${s.name}${tasks}${risks}`)
    }
  }
}

const [cmd, ...args] = process.argv.slice(2)

if (cmd === 'report' && args[0] === 'submit') {
  await cmdReportSubmit(args[1])
} else if (cmd === 'meeting' && args[0] === 'upload') {
  await cmdMeetingUpload(args[1], args[2])
} else if (cmd === 'login') {
  await cmdLogin(args[0], args[1])
} else if (cmd === 'tasks') {
  await cmdTasks()
} else if (cmd === 'brief') {
  await cmdBrief()
} else if (cmd === 'news') {
  await cmdNews()
} else if (cmd === 'submissions') {
  await cmdSubmissions()
} else if (cmd === 'dashboard') {
  await cmdDashboard()
} else {
  console.log(`AutoProf LabOS CLI (Feature 17)

Usage:
  node labos.mjs login <id> <password>         Login and save session
  node labos.mjs tasks                           List tasks
  node labos.mjs report submit <file>           Submit weekly report (.md)
  node labos.mjs meeting upload <file> <date>  Upload meeting minutes
  node labos.mjs brief                           Generate lab brief
  node labos.mjs news                            Show RSS news
  node labos.mjs submissions                     List submissions
  node labos.mjs dashboard                       Show dashboard summary

Config: .env LABOS_URL (default http://localhost:3001)
Cookie: ~/.labos-cookie.json`)
}
