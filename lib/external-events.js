// lib/external-events.js — W10: 外部感知层
// 把 RSS news + email + calendar → external_events 统一存储 → 注入 LabState
// 这是 EvoTeam 的"感知"环节:课题组从外部环境中获取信号

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LABOS_DIR = join(__dirname, '..', 'labos')
const EVENTS_FILE = join(LABOS_DIR, 'external-events.json')

function ensureDir() { mkdirSync(LABOS_DIR, { recursive: true }) }

export function loadEvents() {
  if (!existsSync(EVENTS_FILE)) return []
  try { return JSON.parse(readFileSync(EVENTS_FILE, 'utf-8')) } catch { return [] }
}

export function saveEvents(events) {
  ensureDir()
  writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2), 'utf-8')
}

// Record an external event (news, email, policy, deadline announcement, etc.)
export function recordEvent({ source, type, title, content, url, relevance, tags }) {
  const events = loadEvents()
  const entry = {
    event_id: 'E-' + Date.now(),
    source: source || 'unknown',
    type: type || 'news',
    title: title || '',
    content: (content || '').slice(0, 2000),
    url: url || '',
    relevance: relevance || 'low',
    tags: tags || [],
    timestamp: new Date().toISOString(),
    processed: false,
  }
  events.push(entry)
  if (events.length > 200) events.splice(0, events.length - 200)
  saveEvents(events)
  return entry
}

// Batch record from RSS/news
export async function recordFromNews(limit = 20) {
  try {
    const { getLatestNews } = await import('./rss.js')
    const news = await getLatestNews(limit)
    let count = 0
    for (const item of news) {
      recordEvent({
        source: 'rss',
        type: 'news',
        title: item.title,
        content: item.contentSnippet || item.summary || '',
        url: item.link || '',
        relevance: 'medium',
        tags: ['daily_digest'],
      })
      count++
    }
    return { ok: true, count }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// Batch record from email sync
export async function recordFromEmails() {
  try {
    const { fetchUnread } = await import('./email.js')
    const emails = await fetchUnread()
    let count = 0
    for (const email of (emails || [])) {
      recordEvent({
        source: 'email',
        type: 'email',
        title: email.subject || '(no subject)',
        content: (email.text || '').slice(0, 2000),
        url: '',
        relevance: 'high',
        tags: ['email', 'unread'],
      })
      count++
    }
    return { ok: true, count }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// Get unprocessed events
export function getUnprocessed() {
  return loadEvents().filter(e => !e.processed)
}

// Mark event as processed
export function markProcessed(eventId) {
  const events = loadEvents()
  const ev = events.find(e => e.event_id === eventId)
  if (ev) { ev.processed = true; saveEvents(events); return true }
  return false
}

// Get recent events for LabState injection
export function getRecentEvents(limit = 10) {
  const events = loadEvents()
  return events.slice(-limit)
}

// Build context string for AI prompts
export function buildExternalContext(limit = 5) {
  const events = getRecentEvents(limit)
  if (events.length === 0) return ''
  const lines = events.map(e =>
    `[${e.type}] ${e.title}${e.relevance === 'high' ? ' (高相关)' : ''}`
  )
  return '=== 外部环境信号 ===\n' + lines.join('\n')
}

// Stats
export function getEventStats() {
  const events = loadEvents()
  const bySource = {}
  const byType = {}
  let unprocessed = 0
  for (const e of events) {
    bySource[e.source] = (bySource[e.source] || 0) + 1
    byType[e.type] = (byType[e.type] || 0) + 1
    if (!e.processed) unprocessed++
  }
  return { total: events.length, bySource, byType, unprocessed, recent: events.slice(-5) }
}

// Cordis form
export function apply(ctx, config = {}) {
  ctx.service('externalEvents', {
    record: (data) => recordEvent(data),
    recordFromNews: () => recordFromNews(),
    recordFromEmails: () => recordFromEmails(),
    getUnprocessed: () => getUnprocessed(),
    markProcessed: (id) => markProcessed(id),
    getRecent: (limit) => getRecentEvents(limit),
    stats: () => getEventStats(),
  })
  ctx.on('ready', () => ctx.logger?.info?.('externalEvents plugin ready'))
}

export default {
  loadEvents, saveEvents, recordEvent, recordFromNews, recordFromEmails,
  getUnprocessed, markProcessed, getRecentEvents, buildExternalContext, getEventStats, apply,
}
