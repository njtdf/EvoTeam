// submissions.js - Feature 22: 投稿追踪器
// 追踪论文投稿状态: drafting/submitted/under_review/revision/accepted/rejected
// 存储: labos/submissions.json
// Cordis-shaped: 导出 apply(ctx, config), W1 由 server.js 直接 import

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_FILE = join(__dirname, '..', 'labos', 'submissions.json')

const STATUSES = ['drafting', 'submitted', 'under_review', 'revision', 'accepted', 'rejected']

// --- 读 ---
export function loadSubmissions() {
  try {
    if (existsSync(DATA_FILE)) {
      return JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
    }
  } catch (e) { console.error('[submissions] load failed:', e.message) }
  return { submissions: [], next_id: 1 }
}

// --- 写 ---
export function saveSubmissions(data) {
  try {
    mkdirSync(dirname(DATA_FILE), { recursive: true })
    writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
    return true
  } catch (e) { console.error('[submissions] save failed:', e.message); return false }
}

// --- 创建 ---
export function createSubmission(entry) {
  const data = loadSubmissions()
  const id = `S-${String(data.next_id).padStart(3, '0')}`
  const record = {
    id,
    title: entry.title || '',
    journal: entry.journal || '',
    submitted_date: entry.submitted_date || new Date().toISOString().slice(0, 10),
    status: entry.status || 'drafting',
    deadline: entry.deadline || '',
    owner_student_id: entry.owner_student_id || null,
    owner_name: entry.owner_name || '',
    reviewer_feedback: entry.reviewer_feedback || '',
    notes: entry.notes || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  data.submissions.push(record)
  data.next_id++
  saveSubmissions(data)
  return record
}

// --- 更新 ---
export function updateSubmission(id, patch) {
  const data = loadSubmissions()
  const sub = data.submissions.find(s => s.id === id)
  if (!sub) return null
  Object.assign(sub, patch, { updated_at: new Date().toISOString() })
  saveSubmissions(data)
  return sub
}

// --- 删除 ---
export function deleteSubmission(id) {
  const data = loadSubmissions()
  const before = data.submissions.length
  data.submissions = data.submissions.filter(s => s.id !== id)
  if (data.submissions.length < before) {
    saveSubmissions(data)
    return true
  }
  return false
}

// --- 统计 ---
export function getSubmissionStats() {
  const data = loadSubmissions()
  const byStatus = {}
  for (const s of data.submissions) {
    byStatus[s.status] = (byStatus[s.status] || 0) + 1
  }
  return {
    total: data.submissions.length,
    by_status: byStatus,
    statuses: STATUSES,
  }
}

// --- Cordis 形态 ---
export function apply(ctx, config = {}) {
  ctx.service('submissions', {
    list: () => loadSubmissions(),
    create: (e) => createSubmission(e),
    update: (id, patch) => updateSubmission(id, patch),
    delete: (id) => deleteSubmission(id),
    stats: () => getSubmissionStats(),
  })
  ctx.on('ready', () => {
    ctx.logger?.info?.('submissions plugin ready')
  })
}

export default { loadSubmissions, saveSubmissions, createSubmission, updateSubmission, deleteSubmission, getSubmissionStats, apply }