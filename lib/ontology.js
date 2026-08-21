// lib/ontology.js — 组织地图 (Ontology 2.0)
// Roadmap 2.2 Phase 1: 实体+关系定义，从现有数据源自动构建，叠加手动关系
// 核心原则: 不复制数据，是索引层。本体知道"s01的周报在哪、任务在哪、它们什么关系"
// 存储: labos/ontology.json (仅存手动关系+元数据，实体从现有数据源实时构建)

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { load as parseYaml } from 'js-yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LABOS_DIR = join(__dirname, '..', 'labos')
const ONTOLOGY_FILE = join(LABOS_DIR, 'ontology.json')

// ============================================================
// Schema: 实体类型 + 关系类型定义
// ============================================================

export const ENTITY_TYPES = {
  student: { label: '学生', props: ['id', 'name', 'role', 'project', 'active'], source: 'students.yaml' },
  project: { label: '项目', props: ['id', 'name', 'members', 'task_count', 'report_count'], source: 'aggregated' },
  task: { label: '任务', props: ['task_id', 'title', 'owner_student_id', 'status', 'priority', 'deadline', 'source', 'project'], source: 'tasks.json' },
  weekly_report: { label: '周报', props: ['student_id', 'file', 'period'], source: 'reports/sXX/*.md' },
  summary: { label: 'AI总结', props: ['student_id', 'summary', 'risks', 'suggestions', 'generated_at'], source: 'summaries/sXX.json' },
  meeting: { label: '会议', props: ['date', 'actions', 'decisions', 'action_count'], source: 'meetings/*.actions.json' },
  submission: { label: '投稿', props: ['id', 'title', 'journal', 'status', 'student_id'], source: 'submissions.json' },
  paper: { label: '文献', props: ['title', 'source', 'url', 'published'], source: 'external-events.json' }
}

export const RELATION_TYPES = {
  belongs_to: { label: '属于', from: ['student'], to: ['project'] },
  authored: { label: '撰写', from: ['student'], to: ['weekly_report'] },
  summarized_by: { label: '被总结', from: ['student'], to: ['summary'] },
  assigned: { label: '被分配', from: ['student'], to: ['task'] },
  derived_from: { label: '来源于', from: ['task'], to: ['meeting', 'weekly_report'] },
  mentions: { label: '提及', from: ['meeting'], to: ['student'] },
  authors: { label: '投稿', from: ['student'], to: ['submission'] },
  relevant_to: { label: '相关于', from: ['paper'], to: ['student'] },
  part_of: { label: '隶属', from: ['task'], to: ['project'] }
}

// ============================================================
// 存储层: ontology.json (仅存手动关系 + 元数据)
// ============================================================

function ensureLabosDir() {
  mkdirSync(LABOS_DIR, { recursive: true })
}

export function loadOntology() {
  if (!existsSync(ONTOLOGY_FILE)) {
    return {
      manual_relations: [],
      custom_entities: [],
      metadata: { created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    }
  }
  try {
    return JSON.parse(readFileSync(ONTOLOGY_FILE, 'utf-8'))
  } catch {
    return {
      manual_relations: [],
      custom_entities: [],
      metadata: { created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    }
  }
}

export function saveOntology(data) {
  ensureLabosDir()
  data.metadata = data.metadata || {}
  data.metadata.updated_at = new Date().toISOString()
  writeFileSync(ONTOLOGY_FILE, JSON.stringify(data, null, 2), 'utf-8')
  return data
}

// ============================================================
// 实体构建: 从现有数据源实时读取，不复制
// ============================================================

export function loadStudents() {
  const path = join(LABOS_DIR, 'students.yaml')
  if (!existsSync(path)) return []
  const raw = readFileSync(path, 'utf-8')
  const parsed = parseYaml(raw)
  return (parsed.students || []).map(s => ({
    type: 'student',
    id: s.id,
    name: s.name,
    role: s.role || 'grad',
    project: s.project || '',
    active: s.active !== false
  }))
}

export function loadTaskEntities() {
  const path = join(LABOS_DIR, 'tasks.json')
  if (!existsSync(path)) return []
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'))
    return (data.tasks || []).map(t => ({
      type: 'task',
      id: t.task_id,
      title: t.title,
      owner_student_id: t.owner_student_id || null,
      owner_name: t.owner_name || '',
      status: t.status || 'todo',
      priority: t.priority || 'medium',
      deadline: t.deadline || '',
      source: t.source || 'manual',
      source_ref: t.source_ref || '',
      project: t.project || '',
      created_at: t.created_at || '',
      updated_at: t.updated_at || ''
    }))
  } catch { return [] }
}

export function loadReportEntities() {
  const reportsDir = join(LABOS_DIR, 'reports')
  if (!existsSync(reportsDir)) return []
  const students = loadStudents()
  const reports = []
  for (const s of students) {
    const sDir = join(reportsDir, s.id)
    if (!existsSync(sDir)) continue
    const files = readdirSync(sDir).filter(f => f.endsWith('.md'))
    for (const f of files) {
      reports.push({
        type: 'weekly_report',
        id: s.id + '/' + f,
        student_id: s.id,
        student_name: s.name,
        file: f,
        path: 'labos/reports/' + s.id + '/' + f,
        period: f.replace('.md', '')
      })
    }
  }
  return reports
}

export function loadSummaryEntities() {
  const sDir = join(LABOS_DIR, 'summaries')
  if (!existsSync(sDir)) return []
  const files = readdirSync(sDir).filter(f => f.endsWith('.json'))
  return files.map(f => {
    try {
      const raw = JSON.parse(readFileSync(join(sDir, f), 'utf-8'))
      return {
        type: 'summary',
        id: raw.student_id || f.replace('.json', ''),
        student_id: raw.student_id || '',
        student_name: raw.student_name || '',
        summary: raw.summary || '',
        risks: raw.risks || [],
        suggestions: raw.suggestions || [],
        generated_at: raw.generated_at || ''
      }
    } catch { return null }
  }).filter(Boolean)
}

export function loadMeetingEntities() {
  const mDir = join(LABOS_DIR, 'meetings')
  if (!existsSync(mDir)) return []
  const files = readdirSync(mDir).filter(f => f.endsWith('.actions.json'))
  return files.map(f => {
    try {
      const raw = JSON.parse(readFileSync(join(mDir, f), 'utf-8'))
      const date = f.replace('.actions.json', '')
      const actions = raw.actions || []
      const mentioned = new Set()
      for (const a of actions) {
        if (a.owner_name) mentioned.add(a.owner_name)
        if (a.owner_student_id) mentioned.add(a.owner_student_id)
      }
      return {
        type: 'meeting',
        id: date,
        date,
        decisions: raw.decisions || [],
        actions,
        action_count: actions.length,
        mentioned_names: [...mentioned]
      }
    } catch { return null }
  }).filter(Boolean)
}

export function loadSubmissionEntities() {
  const path = join(LABOS_DIR, 'submissions.json')
  if (!existsSync(path)) return []
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'))
    return (data.submissions || []).map(s => ({
      type: 'submission',
      id: s.id,
      title: s.title || '',
      journal: s.journal || '',
      status: s.status || 'drafting',
      student_id: s.student_id || '',
      student_name: s.student_name || ''
    }))
  } catch { return [] }
}

export function loadPaperEntities() {
  const path = join(LABOS_DIR, 'external-events.json')
  if (!existsSync(path)) return []
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'))
    const events = data.events || data.items || data || []
    if (!Array.isArray(events)) return []
    return events.slice(0, 50).map((e, i) => ({
      type: 'paper',
      id: e.id || ('paper-' + i),
      title: e.title || e.summary || '',
      source: e.source || '',
      url: e.url || e.link || '',
      published: e.published || e.date || ''
    }))
  } catch { return [] }
}

export function loadProjectEntities() {
  const students = loadStudents()
  const tasks = loadTaskEntities()
  const reports = loadReportEntities()
  const projectMap = new Map()
  for (const s of students) {
    const p = s.project || '未分配'
    if (!projectMap.has(p)) projectMap.set(p, { type: 'project', id: p, name: p, members: [], task_count: 0, report_count: 0 })
    projectMap.get(p).members.push({ id: s.id, name: s.name, role: s.role })
  }
  for (const t of tasks) {
    const p = t.project || '未分配'
    if (!projectMap.has(p)) projectMap.set(p, { type: 'project', id: p, name: p, members: [], task_count: 0, report_count: 0 })
    projectMap.get(p).task_count++
  }
  for (const r of reports) {
    const student = students.find(s => s.id === r.student_id)
    const p = student ? student.project : '未分配'
    if (!projectMap.has(p)) projectMap.set(p, { type: 'project', id: p, name: p, members: [], task_count: 0, report_count: 0 })
    projectMap.get(p).report_count++
  }
  return [...projectMap.values()]
}

// ============================================================
// 关系构建: 从实体数据自动推导
// ============================================================

export function buildRelations() {
  const students = loadStudents()
  const tasks = loadTaskEntities()
  const reports = loadReportEntities()
  const summaries = loadSummaryEntities()
  const meetings = loadMeetingEntities()
  const submissions = loadSubmissionEntities()
  const relations = []
  let n = 0

  // student -> project: belongs_to
  for (const s of students) {
    if (s.project) {
      relations.push({ id: 'rel-' + n++, from_type: 'student', from_id: s.id, to_type: 'project', to_id: s.project, type: 'belongs_to', source: 'auto' })
    }
  }
  // student -> weekly_report: authored
  for (const r of reports) {
    relations.push({ id: 'rel-' + n++, from_type: 'student', from_id: r.student_id, to_type: 'weekly_report', to_id: r.id, type: 'authored', source: 'auto' })
  }
  // student -> summary: summarized_by
  for (const s of summaries) {
    relations.push({ id: 'rel-' + n++, from_type: 'student', from_id: s.student_id, to_type: 'summary', to_id: s.id, type: 'summarized_by', source: 'auto' })
  }
  // student -> task: assigned
  for (const t of tasks) {
    if (t.owner_student_id) {
      relations.push({ id: 'rel-' + n++, from_type: 'student', from_id: t.owner_student_id, to_type: 'task', to_id: t.id, type: 'assigned', source: 'auto' })
    }
  }
  // task -> meeting/weekly_report: derived_from
  for (const t of tasks) {
    if (t.source === 'meeting' && t.source_ref) {
      relations.push({ id: 'rel-' + n++, from_type: 'task', from_id: t.id, to_type: 'meeting', to_id: t.source_ref, type: 'derived_from', source: 'auto' })
    } else if (t.source === 'weekly') {
      relations.push({ id: 'rel-' + n++, from_type: 'task', from_id: t.id, to_type: 'weekly_report', to_id: t.source_ref || t.owner_student_id, type: 'derived_from', source: 'auto' })
    }
  }
  // meeting -> student: mentions
  for (const m of meetings) {
    const studentsByName = new Map(students.map(s => [s.name, s]))
    const studentsById = new Map(students.map(s => [s.id, s]))
    const mentioned = new Set()
    for (const name of m.mentioned_names) {
      const matched = studentsByName.get(name) || studentsById.get(name)
      if (matched) mentioned.add(matched.id)
    }
    for (const sid of mentioned) {
      relations.push({ id: 'rel-' + n++, from_type: 'meeting', from_id: m.id, to_type: 'student', to_id: sid, type: 'mentions', source: 'auto' })
    }
  }
  // student -> submission: authors
  for (const sub of submissions) {
    if (sub.student_id) {
      relations.push({ id: 'rel-' + n++, from_type: 'student', from_id: sub.student_id, to_type: 'submission', to_id: sub.id, type: 'authors', source: 'auto' })
    }
  }
  // task -> project: part_of
  for (const t of tasks) {
    if (t.project) {
      relations.push({ id: 'rel-' + n++, from_type: 'task', from_id: t.id, to_type: 'project', to_id: t.project, type: 'part_of', source: 'auto' })
    }
  }

  // 合并手动关系
  const onto = loadOntology()
  for (const mr of (onto.manual_relations || [])) {
    relations.push({ ...mr, source: 'manual' })
  }
  return relations
}

// ============================================================
// 完整实体索引
// ============================================================

export function buildAllEntities() {
  return {
    students: loadStudents(),
    projects: loadProjectEntities(),
    tasks: loadTaskEntities(),
    reports: loadReportEntities(),
    summaries: loadSummaryEntities(),
    meetings: loadMeetingEntities(),
    submissions: loadSubmissionEntities(),
    papers: loadPaperEntities()
  }
}

// ============================================================
// 核心查询: getEntityGraph — 一次查询展开完整关联图
// 替代翻 7 个文件理解一个学生全貌
// ============================================================

export function getEntityGraph(entityType, entityId) {
  const entities = buildAllEntities()
  const relations = buildRelations()

  const entityMap = {
    student: entities.students,
    project: entities.projects,
    task: entities.tasks,
    weekly_report: entities.reports,
    summary: entities.summaries,
    meeting: entities.meetings,
    submission: entities.submissions,
    paper: entities.papers
  }
  const pool = entityMap[entityType] || []
  const entity = pool.find(e => e.id === entityId || String(e.id) === String(entityId))
  if (!entity) return { entity: null, relations: [], connected: [] }

  const connectedRels = relations.filter(r =>
    (r.from_type === entityType && (r.from_id === entityId || String(r.from_id) === String(entityId))) ||
    (r.to_type === entityType && (r.to_id === entityId || String(r.to_id) === String(entityId)))
  )

  const connectedEntities = []
  const seen = new Set()
  for (const rel of connectedRels) {
    const otherType = rel.from_type === entityType ? rel.to_type : rel.from_type
    const otherId = rel.from_type === entityType ? rel.to_id : rel.from_id
    const key = otherType + ':' + otherId
    if (seen.has(key)) continue
    seen.add(key)
    const otherPool = entityMap[otherType] || []
    const otherEntity = otherPool.find(e => e.id === otherId || String(e.id) === String(otherId))
    if (otherEntity) {
      connectedEntities.push({ entity: otherEntity, relation: rel })
    }
  }

  return { entity, relations: connectedRels, connected: connectedEntities }
}

// ============================================================
// 搜索实体
// ============================================================

export function searchEntities(query) {
  const all = buildAllEntities()
  const q = query.toLowerCase()
  const results = []
  for (const [type, list] of Object.entries(all)) {
    for (const e of list) {
      const searchText = JSON.stringify(e).toLowerCase()
      if (searchText.includes(q)) {
        results.push({ type, ...e })
      }
    }
  }
  return results.slice(0, 50)
}

// ============================================================
// 手动关系 CRUD
// ============================================================

export function addRelation(fromType, fromId, toType, toId, relType, metadata) {
  const onto = loadOntology()
  if (!onto.manual_relations) onto.manual_relations = []
  const id = 'manual-' + Date.now()
  const rel = {
    id,
    from_type: fromType,
    from_id: fromId,
    to_type: toType,
    to_id: toId,
    type: relType || 'related_to',
    metadata: metadata || {},
    created_at: new Date().toISOString()
  }
  onto.manual_relations.push(rel)
  saveOntology(onto)
  return rel
}

export function removeRelation(relId) {
  const onto = loadOntology()
  if (!onto.manual_relations) return false
  const before = onto.manual_relations.length
  onto.manual_relations = onto.manual_relations.filter(r => r.id !== relId)
  saveOntology(onto)
  return onto.manual_relations.length < before
}

// ============================================================
// 自然语言 CRUD (模式匹配，不调 AI)
// ============================================================

export function applyNaturalLanguage(text) {
  const students = loadStudents()
  const studentNames = new Map(students.map(s => [s.name, s]))
  const studentIds = new Map(students.map(s => [s.id, s]))

  // 模式 1: "宋禧 属于 电力韧性项目" -> belongs_to
  // 模式 2: "s01 属于 电力韧性" -> belongs_to
  // 模式 3: "关联 宋禧 和 2026-W33" -> custom relation
  // 模式 4: "新增研究方向 AI Datacenter, 关联 s01 s05" -> project + belongs_to

  // 尝试匹配学生名
  let matchedStudent = null
  for (const [name, s] of studentNames) {
    if (text.includes(name)) {
      matchedStudent = s
      break
    }
  }
  if (!matchedStudent) {
    for (const [id, s] of studentIds) {
      if (text.includes(id)) {
        matchedStudent = s
        break
      }
    }
  }

  if (!matchedStudent) {
    return { success: false, message: '未匹配到学生。请包含学生姓名或ID。' }
  }

  // 匹配关系类型关键词
  const lowerText = text.toLowerCase()

  if (text.includes('属于') || text.includes('关联到项目') || text.includes('分配到')) {
    // 提取项目名 — "属于"后面的内容
    const match = text.match(/属于\s*(.+?)(?:项目)?(?:\s|$)/)
    if (match) {
      const projectName = match[1].trim().replace(/项目$/, '').trim()
      const rel = addRelation('student', matchedStudent.id, 'project', projectName, 'belongs_to')
      return { success: true, message: '已添加关系: ' + matchedStudent.name + ' 属于 ' + projectName, relation: rel }
    }
  }

  if (text.includes('负责') || text.includes('分管')) {
    const match = text.match(/(?:负责|分管)\s*(.+?)(?:\s|$)/)
    if (match) {
      const taskName = match[1].trim()
      const rel = addRelation('student', matchedStudent.id, 'task', taskName, 'assigned')
      return { success: true, message: '已添加关系: ' + matchedStudent.name + ' 负责 ' + taskName, relation: rel }
    }
  }

  if (text.includes('相关') || text.includes('研究方向')) {
    const match = text.match(/(?:相关|研究方向)\s*:?\s*(.+?)(?:\s|$)/)
    if (match) {
      const topic = match[1].trim()
      const rel = addRelation('paper', topic, 'student', matchedStudent.id, 'relevant_to')
      return { success: true, message: '已添加关系: ' + topic + ' 相关于 ' + matchedStudent.name, relation: rel }
    }
  }

  return { success: false, message: '无法解析指令。支持格式: "宋禧 属于 电力韧性项目", "s01 负责 Benders分解"' }
}

// ============================================================
// 统计
// ============================================================

export function getOntologyStats() {
  const entities = buildAllEntities()
  const relations = buildRelations()
  const relByType = {}
  for (const r of relations) {
    relByType[r.type] = (relByType[r.type] || 0) + 1
  }
  const onto = loadOntology()
  return {
    entity_counts: {
      student: entities.students.length,
      project: entities.projects.length,
      task: entities.tasks.length,
      weekly_report: entities.reports.length,
      summary: entities.summaries.length,
      meeting: entities.meetings.length,
      submission: entities.submissions.length,
      paper: entities.papers.length
    },
    relation_total: relations.length,
    relation_by_type: relByType,
    manual_relations: (onto.manual_relations || []).length,
    entity_types: Object.keys(ENTITY_TYPES).length,
    relation_types: Object.keys(RELATION_TYPES).length
  }
}

// ============================================================
// Cordis 形态 (W3 零改动接入)
// ============================================================

export function apply(ctx, config) {
  ctx.ontology = {
    getEntityGraph,
    buildAllEntities,
    buildRelations,
    searchEntities,
    addRelation,
    removeRelation,
    applyNaturalLanguage,
    getOntologyStats,
    ENTITY_TYPES,
    RELATION_TYPES
  }
  return ctx.ontology
}
