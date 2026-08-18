// kanban.js - Feature 3: 任务看板
// 任务 CRUD + 看板状态 + 会议行动项提升 + 统计
// Cordis-shaped: 导出 apply(ctx, config),W1 由 server.js 直接 import,W3 零改动接入 runtime

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { load as parseYaml } from 'js-yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TASKS_FILE = join(__dirname, '..', 'labos', 'tasks.json')
const LABOS_DIR = join(__dirname, '..', 'labos')

// --- 存储路径 ---
function ensureDir() {
  mkdirSync(LABOS_DIR, { recursive: true })
}

// --- 读取学生 roster(仅 active 学生,用于姓名→ID 匹配) ---
export function getRoster() {
  const path = join(__dirname, '..', 'labos', 'students.yaml')
  if (!existsSync(path)) return []
  const raw = readFileSync(path, 'utf-8')
  const parsed = parseYaml(raw)
  return (parsed.students || [])
    .filter(s => s.active !== false && s.role !== 'teacher')
    .map(s => ({ id: s.id, name: s.name, project: s.project }))
}

// --- 加载全部任务 ---
export function loadTasks() {
  if (!existsSync(TASKS_FILE)) return { tasks: [], next_id: 1 }
  try {
    const raw = readFileSync(TASKS_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { tasks: [], next_id: 1 }
  }
}

// --- 保存全部任务 ---
export function saveTasks(data) {
  ensureDir()
  writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

// --- 创建任务(自增 task_id) ---
export function createTask(input) {
  const data = loadTasks()
  const id = `T-${String(data.next_id).padStart(3, '0')}`
  const now = new Date().toISOString()

  // 姓名→ID 匹配(若只给了 owner_name)
  let ownerStudentId = input.owner_student_id || null
  let ownerName = input.owner_name || ''
  if (!ownerStudentId && ownerName) {
    const roster = getRoster()
    const match = roster.find(s => s.name === ownerName)
    if (match) {
      ownerStudentId = match.id
    }
  }
  // 若给了 owner_student_id 但没给 name,反查
  if (ownerStudentId && !ownerName) {
    const roster = getRoster()
    const match = roster.find(s => s.id === ownerStudentId)
    if (match) ownerName = match.name
  }

  const task = {
    task_id: id,
    title: input.title || '未命名任务',
    description: input.description || '',
    owner_student_id: ownerStudentId,
    owner_name: ownerName,
    status: input.status || 'todo',
    priority: input.priority || 'medium',
    deadline: input.deadline || '',
    source: input.source || 'manual',
    source_ref: input.source_ref || '',
    project: input.project || '',
    created_at: now,
    updated_at: now,
  }

  data.tasks.push(task)
  data.next_id += 1
  saveTasks(data)
  return task
}

// --- 更新任务(合并字段) ---
export function updateTask(taskId, patch) {
  const data = loadTasks()
  const task = data.tasks.find(t => t.task_id === taskId)
  if (!task) return null

  // 导师改派 owner 时同步 owner_name
  if (patch.owner_student_id !== undefined) {
    if (patch.owner_student_id) {
      const roster = getRoster()
      const match = roster.find(s => s.id === patch.owner_student_id)
      if (match) patch.owner_name = match.name
    } else {
      patch.owner_name = ''
    }
  }

  Object.assign(task, patch, { updated_at: new Date().toISOString() })
  saveTasks(data)
  return task
}

// --- 删除任务 ---
export function deleteTask(taskId) {
  const data = loadTasks()
  const before = data.tasks.length
  data.tasks = data.tasks.filter(t => t.task_id !== taskId)
  const deleted = data.tasks.length < before
  if (deleted) saveTasks(data)
  return deleted
}

// --- 按学生过滤任务 ---
export function getTasksByStudent(studentId) {
  const data = loadTasks()
  return data.tasks.filter(t => t.owner_student_id === studentId)
}

// --- 全部任务 ---
export function getAllTasks() {
  return loadTasks().tasks
}

// --- 看板统计 ---
export function getBoardStats() {
  const tasks = getAllTasks()
  const today = new Date().toISOString().slice(0, 10)

  const byStatus = { todo: 0, in_progress: 0, done: 0, blocked: 0 }
  const byPriority = { high: 0, medium: 0, low: 0 }
  const byOwner = {}
  let overdue = 0

  for (const t of tasks) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1
    if (t.owner_student_id) {
      byOwner[t.owner_student_id] = (byOwner[t.owner_student_id] || 0) + 1
    }
    if (t.deadline && t.deadline < today && t.status !== 'done') {
      overdue++
    }
  }

  return { total: tasks.length, byStatus, byPriority, byOwner, overdue }
}

// --- 会议行动项 → 看板任务 ---
export function promoteMeetingAction(action) {
  return createTask({
    title: action.task || action.title || '未命名',
    description: action.context || '',
    owner_student_id: action.owner_student_id || null,
    owner_name: action.owner_name || '',
    status: (action.status && ['todo','in_progress','done','blocked'].includes(action.status)) ? action.status : 'todo',
    priority: 'medium',
    deadline: action.deadline || '',
    source: 'meeting',
    source_ref: action.task_id || '',
    project: action.project || '',
  })
}

// --- Cordis 形态(W3 接入 runtime) ---
export function apply(ctx, config = {}) {
  const store = config.store || { tasks: [], next_id: 1 }

  ctx.service('kanban', {
    create: (input) => {
      const task = createTask(input)
      store.tasks.push(task)
      store.next_id++
      return task
    },
    list: () => getAllTasks(),
    update: (id, patch) => updateTask(id, patch),
    delete: (id) => deleteTask(id),
    stats: () => getBoardStats(),
    promote: (action) => promoteMeetingAction(action),
  })

  ctx.on('ready', () => {
    ctx.logger?.info?.('kanban plugin ready')
  })
}

export default {
  loadTasks, saveTasks, createTask, updateTask, deleteTask,
  getTasksByStudent, getAllTasks, getBoardStats, promoteMeetingAction,
  getRoster, apply,
}
