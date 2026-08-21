import { loadValueCycle, saveValueCycle } from './valuecycle.js'
import { getDb } from './db.js'

// NNU EE standard graduation requirements. [需核对] — verify against actual 培养方案 PDF.
// Each requirement: { id, category, label, weight, status, met_at, notes }
// status: not_started | in_progress | done

const MASTER_REQUIREMENTS = [
  { id: 'm_course', category: 'coursework', label: '课程学分 ≥ 28 (总学分)', weight: 15, detail: '学位课成绩 ≥ 70 分' },
  { id: 'm_degree_course', category: 'coursework', label: '学位课全部通过', weight: 10, detail: '无不及格重修' },
  { id: 'm_proposal', category: 'proposal', label: '开题报告通过', weight: 10, detail: '第三学期内完成' },
  { id: 'm_midterm', category: 'midterm', label: '中期考核通过', weight: 10, detail: '第四学期' },
  { id: 'm_publication', category: 'publication', label: '发表论文 ≥ 1 篇 (SCI/EI/核心)', weight: 20, detail: '导师认可的第一作者或导师一作本人二作' },
  { id: 'm_academic', category: 'academic', label: '学术报告/讲座 ≥ 10 次', weight: 5, detail: '含本人做报告 ≥ 1 次' },
  { id: 'm_thesis', category: 'thesis', label: '学位论文 ≥ 3 万字', weight: 10, detail: '盲审前定稿' },
  { id: 'm_blind', category: 'thesis', label: '论文盲审通过', weight: 10, detail: '校内外专家评审' },
  { id: 'm_defense', category: 'defense', label: '论文答辩通过', weight: 5, detail: '答辩委员会投票' },
  { id: 'm_practice', category: 'practice', label: '实践环节学分', weight: 5, detail: '教学/科研/社会实践' },
]

const PHD_REQUIREMENTS = [
  { id: 'p_course', category: 'coursework', label: '课程学分 ≥ 18', weight: 10, detail: '博士课程体系' },
  { id: 'p_qualification', category: 'qualification', label: '资格考试通过', weight: 15, detail: '入学后 1-1.5 年内' },
  { id: 'p_proposal', category: 'proposal', label: '开题报告通过', weight: 10, detail: '资格考后半年内' },
  { id: 'p_publication', category: 'publication', label: '发表 ≥ 2 篇 SCI (含 1 篇一区/顶刊)', weight: 25, detail: '学院认定的高水平论文' },
  { id: 'p_academic', category: 'academic', label: '学术报告 ≥ 15 次 / 本人做报告 ≥ 3 次', weight: 5, detail: '国内外学术交流' },
  { id: 'p_thesis', category: 'thesis', label: '博士学位论文', weight: 15, detail: '创新性成果' },
  { id: 'p_blind', category: 'thesis', label: '论文盲审通过', weight: 10, detail: '教育部平台送审' },
  { id: 'p_defense', category: 'defense', label: '论文答辩通过', weight: 10, detail: '答辩委员会' },
]

const BACHELOR_REQUIREMENTS = [
  { id: 'b_credit', category: 'coursework', label: '修满培养方案学分', weight: 25, detail: '含通识/专业/实践' },
  { id: 'b_proposal', category: 'proposal', label: '毕业设计开题', weight: 15, detail: '第七学期' },
  { id: 'b_midterm', category: 'midterm', label: '中期检查通过', weight: 10, detail: '第八学期中' },
  { id: 'b_thesis', category: 'thesis', label: '毕业论文完成', weight: 20, detail: '格式规范/字数达标' },
  { id: 'b_plagiarism', category: 'thesis', label: '查重 ≤ 15%', weight: 10, detail: '知网/万方检测' },
  { id: 'b_defense', category: 'defense', label: '毕业答辩通过', weight: 20, detail: '答辩委员会评定' },
]

const CATEGORIES = [
  { id: 'coursework', label: '课程', icon: '📚' },
  { id: 'qualification', label: '资格考试', icon: '📝' },
  { id: 'proposal', label: '开题', icon: '🔑' },
  { id: 'midterm', label: '中期考核', icon: '🔍' },
  { id: 'publication', label: '论文发表', icon: '📄' },
  { id: 'academic', label: '学术活动', icon: '🎤' },
  { id: 'thesis', label: '学位论文', icon: '📖' },
  { id: 'defense', label: '答辩', icon: '🎓' },
  { id: 'practice', label: '实践环节', icon: '🛠️' },
]

export function getRequirementsTemplate(role) {
  if (role === 'phd') return PHD_REQUIREMENTS.map(r => ({ ...r, status: 'not_started', met_at: null, notes: '' }))
  if (role === 'undergrad' || role === 'bachelor') return BACHELOR_REQUIREMENTS.map(r => ({ ...r, status: 'not_started', met_at: null, notes: '' }))
  // default: master (grad)
  return MASTER_REQUIREMENTS.map(r => ({ ...r, status: 'not_started', met_at: null, notes: '' }))
}

export function getRequirementCategories() {
  return CATEGORIES
}

function mapDegree(role) {
  if (role === 'phd') return 'phd'
  if (role === 'undergrad' || role === 'bachelor') return 'bachelor'
  return 'master'
}

// Fill requirements if empty. Does NOT overwrite existing progress.
export function seedGraduationRequirements(studentId, role) {
  const vc = loadValueCycle(studentId)
  const degree = mapDegree(role)
  if (!vc.graduation_state) vc.graduation_state = {}
  if (!vc.graduation_state.degree) vc.graduation_state.degree = degree
  if (!Array.isArray(vc.graduation_state.requirements) || vc.graduation_state.requirements.length === 0) {
    vc.graduation_state.requirements = getRequirementsTemplate(role)
  }
  const pct = calculateProgress(vc.graduation_state.requirements)
  vc.graduation_state.progress_pct = pct
  vc.graduation_state.risk_level = riskFromProgress(pct)
  saveValueCycle(studentId, vc)
  return vc.graduation_state
}

export function calculateProgress(requirements) {
  if (!Array.isArray(requirements) || requirements.length === 0) return 0
  const totalW = requirements.reduce((s, r) => s + (r.weight || 1), 0)
  const doneW = requirements.filter(r => r.status === 'done').reduce((s, r) => s + (r.weight || 1), 0)
  const halfW = requirements.filter(r => r.status === 'in_progress').reduce((s, r) => s + (r.weight || 1) * 0.5, 0)
  return totalW === 0 ? 0 : Math.round(((doneW + halfW) / totalW) * 100)
}

function riskFromProgress(pct) {
  if (pct < 30) return 'high'
  if (pct < 60) return 'medium'
  return 'low'
}

export function updateRequirement(studentId, reqId, patch) {
  const vc = loadValueCycle(studentId)
  const reqs = vc.graduation_state?.requirements || []
  const idx = reqs.findIndex(r => r.id === reqId)
  if (idx < 0) throw new Error(`requirement ${reqId} not found for ${studentId}`)
  reqs[idx] = { ...reqs[idx], ...patch }
  if (patch.status === 'done' && !reqs[idx].met_at) reqs[idx].met_at = new Date().toISOString().slice(0, 10)
  vc.graduation_state.requirements = reqs
  const pct = calculateProgress(reqs)
  vc.graduation_state.progress_pct = pct
  vc.graduation_state.risk_level = riskFromProgress(pct)
  saveValueCycle(studentId, vc)
  return vc.graduation_state
}

export function getGraduationSummary(studentId) {
  const vc = loadValueCycle(studentId)
  const gs = vc.graduation_state || {}
  const reqs = gs.requirements || []
  const by_category = {}
  for (const r of reqs) {
    if (!by_category[r.category]) by_category[r.category] = { total: 0, done: 0, items: [] }
    by_category[r.category].total++
    if (r.status === 'done') by_category[r.category].done++
    by_category[r.category].items.push(r)
  }
  return {
    student_id: studentId,
    degree: gs.degree || 'master',
    expected_graduation: gs.expected_graduation || '',
    progress_pct: gs.progress_pct || calculateProgress(reqs),
    risk_level: gs.risk_level || 'unknown',
    total: reqs.length,
    done: reqs.filter(r => r.status === 'done').length,
    in_progress: reqs.filter(r => r.status === 'in_progress').length,
    not_started: reqs.filter(r => r.status === 'not_started').length,
    by_category,
    template_note: '基于NNU电气与自动化工程学院标准培养方案 [需核对]',
  }
}

export function getAllGraduationSummaries(studentIds) {
  return studentIds.map(id => getGraduationSummary(id))
}

// Sync graduation_state into SQLite value_cycles table (additive, dual-read safe)
export function syncToDb(studentId) {
  let db
  try { db = getDb() } catch { return null }
  const vc = loadValueCycle(studentId)
  const gs = vc.graduation_state || {}
  const row = db.prepare('SELECT student_id FROM value_cycles WHERE student_id = ?').get(studentId)
  const dataJson = JSON.stringify(vc)
  if (row) {
    db.prepare('UPDATE value_cycles SET data_json = ?, updated_at = ? WHERE student_id = ?').run(dataJson, new Date().toISOString(), studentId)
  } else {
    db.prepare('INSERT INTO value_cycles (student_id, data_json, updated_at) VALUES (?, ?, ?)').run(studentId, dataJson, new Date().toISOString())
  }
  return gs
}

// Index graduation status as a KB document (category='graduation')
export function indexToKb(studentId) {
  let db
  try { db = getDb() } catch { return null }
  const sum = getGraduationSummary(studentId)
  const lines = [`# 毕业状态 ${studentId}`, `学位: ${sum.degree}`, `进度: ${sum.progress_pct}%`, `风险: ${sum.risk_level}`, '', '## 要求清单']
  for (const [cat, info] of Object.entries(sum.by_category)) {
    lines.push(`### ${cat} (${info.done}/${info.total})`)
    for (const r of info.items) lines.push(`- [${r.status === 'done' ? 'x' : ' '}] ${r.label} (权重${r.weight})`)
  }
  const content = lines.join('\n')
  const path = `graduation/${studentId}`
  const existing = db.prepare('SELECT id FROM kb_documents WHERE path = ?').get(path)
  if (existing) {
    db.prepare('UPDATE kb_documents SET content = ?, title = ? WHERE path = ?').run(content, `毕业状态 ${studentId}`, path)
  } else {
    db.prepare('INSERT INTO kb_documents (path, title, content, category, student_id, tags_json) VALUES (?, ?, ?, ?, ?, ?)')
      .run(path, `毕业状态 ${studentId}`, content, 'graduation', studentId, '[]')
  }
  return { path, content_len: content.length }
}

// Cordis apply form (W3 zero-change integration)
export function apply(ctx, config = {}) {
  ctx.graduation = {
    getRequirementsTemplate, getRequirementCategories, seedGraduationRequirements,
    calculateProgress, updateRequirement, getGraduationSummary,
    getAllGraduationSummaries, syncToDb, indexToKb,
  }
  return ctx.graduation
}

export default {
  getRequirementsTemplate, getRequirementCategories, seedGraduationRequirements,
  calculateProgress, updateRequirement, getGraduationSummary,
  getAllGraduationSummaries, syncToDb, indexToKb, apply,
}
