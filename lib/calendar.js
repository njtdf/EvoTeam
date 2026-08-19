import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LABOS = path.join(__dirname, '..', 'labos')

/**
 * Calendar events aggregator.
 * Pulls from: tasks.json (deadlines), meetings/ (dates), submissions (deadlines).
 * Returns flat array of {id, date, title, type, source}
 */

export function loadCalendarEvents() {
  const events = []

  // 1. Task deadlines
  try {
    const tasksPath = path.join(LABOS, 'tasks.json')
    if (fs.existsSync(tasksPath)) {
      const data = JSON.parse(fs.readFileSync(tasksPath, 'utf8'))
      for (const t of data.tasks || []) {
        if (t.deadline && t.status !== 'done') {
          events.push({
            id: 'task-' + t.task_id,
            date: t.deadline,
            title: (t.title || 'Untitled').slice(0, 20),
            type: t.status === 'blocked' ? 'blocked' : 'deadline',
            source: 'task',
            owner: t.owner_name || '',
          })
        }
      }
    }
  } catch (e) { console.error('calendar tasks:', e.message) }

  // 2. Meeting dates
  try {
    const meetingsDir = path.join(LABOS, 'meetings')
    if (fs.existsSync(meetingsDir)) {
      for (const f of fs.readdirSync(meetingsDir)) {
        if (f.endsWith('.md')) {
          const date = f.replace('.md', '')
          events.push({
            id: 'meeting-' + date,
            date,
            title: '组会',
            type: 'meeting',
            source: 'meeting',
          })
        }
      }
    }
  } catch (e) { console.error('calendar meetings:', e.message) }

  // 3. Submission deadlines
  try {
    const subPath = path.join(LABOS, 'submissions.json')
    if (fs.existsSync(subPath)) {
      const data = JSON.parse(fs.readFileSync(subPath, 'utf8'))
      for (const s of data.submissions || []) {
        if (s.deadline && s.status !== 'published' && s.status !== 'rejected') {
          events.push({
            id: 'sub-' + s.id,
            date: s.deadline,
            title: (s.title || 'Submission').slice(0, 20),
            type: 'submission',
            source: 'submission',
          })
        }
      }
    }
  } catch (e) { console.error('calendar subs:', e.message) }

  return events
}

export function apply(ctx, config) {
  ctx.calendar = { loadCalendarEvents }
}
