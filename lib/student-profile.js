// lib/student-profile.js -- Student Profile aggregator
// Aggregates ALL student data: graduation, tasks, consistency, reports, meetings, knowledge, capability, decisions
// This is the "one-stop view" for each student

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { load as parseYaml } from 'js-yaml'
import { loadTasks, getTasksByStudent, getBoardStats } from './kanban.js'
import { loadSummary } from './summary.js'
import { loadActions, listMeetings } from './meeting.js'
import { getConsistencyIndex } from './promise-ledger.js'
import { loadValueCycle } from './valuecycle.js'
import { getGraduationSummary, getRequirementsTemplate } from './graduation.js'
import { searchTrajectories, getTrajectoryStats } from './trajectory.js'
import { getDb } from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// --- Student roster ---
function getRoster() {
  const path = join(__dirname, '..', 'labos', 'students.yaml')
  if (!existsSync(path)) return []
  const raw = readFileSync(path, 'utf-8')
  const parsed = parseYaml(raw)
  return (parsed.students || []).filter(s => s.role !== 'teacher')
}

// --- Task status -> progress percentage ---
export function taskStatusToPct(status) {
  const map = { todo: 0, in_progress: 50, blocked: 25, done: 100 }
  return map[status] ?? 0
}

// --- Enrollment status ---
// If graduation progress is 100% -> graduated, else enrolled
function getEnrollmentStatus(gradData) {
  if (!gradData) return 'enrolled'
  if (gradData.progress_pct >= 100) return 'graduated'
  return 'enrolled'
}

// --- Get latest report info for a student ---
function getLatestReportInfo(studentId) {
  try {
    const summary = loadSummary(studentId)
    if (summary && summary.generated_at) {
      return { date: summary.generated_at.slice(0, 10), path: '' }
    }
  } catch {}
  return { date: '', path: '' }
}

// --- Get student's meeting actions ---
function getStudentMeetingActions(studentId) {
  const result = []
  try {
    const meetings = listMeetings()
    for (const m of meetings) {
      const actions = loadActions(m.date)
      if (!actions || !actions.actions) continue
      const mine = actions.actions.filter(a =>
        a.owner_student_id === studentId || a.owner_name === studentId
      )
      for (const a of mine) {
        result.push({
          meeting_date: m.date,
          task: a.task || '',
          deadline: a.deadline || '',
          status: a.status || 'pending',
          source_section: a.source_section || '',
        })
      }
    }
  } catch {}
  return result
}

// --- Get knowledge docs count for student (from DB) ---
function getStudentKbCount(studentId) {
  try {
    const db = getDb()
    const row = db.prepare('SELECT COUNT(*) as cnt FROM kb_documents WHERE student_id = ?').get(studentId)
    return row ? row.cnt : 0
  } catch {
    return 0
  }
}

// --- Full profile for one student ---
export function getStudentProfile(studentId) {
  const roster = getRoster()
  const student = roster.find(s => s.id === studentId)
  if (!student) return null

  // Tasks
  const myTasks = getTasksByStudent(studentId)
  const taskStats = {
    total: myTasks.length,
    done: myTasks.filter(t => t.status === 'done').length,
    in_progress: myTasks.filter(t => t.status === 'in_progress').length,
    todo: myTasks.filter(t => t.status === 'todo').length,
    blocked: myTasks.filter(t => t.status === 'blocked').length,
  }
  const today = new Date().toISOString().slice(0, 10)
  taskStats.overdue = myTasks.filter(t => t.deadline && t.deadline < today && t.status !== 'done').length
  taskStats.progress_pct = myTasks.length > 0
    ? Math.round((taskStats.done / myTasks.length) * 100)
    : 0
  taskStats.recent = myTasks.slice(-5).map(t => ({
    task_id: t.task_id,
    title: t.title,
    status: t.status,
    progress_pct: taskStatusToPct(t.status),
    deadline: t.deadline,
  }))

  // Graduation
  let gradData = null
  try {
    gradData = getGraduationSummary(studentId)
  } catch {}
  const enrollmentStatus = getEnrollmentStatus(gradData)

  // Value cycle (capability, decisions, rewards)
  let vc = null
  try {
    vc = loadValueCycle(studentId)
  } catch {}

  // Consistency index
 let consistency = null
  try {
    consistency = getConsistencyIndex(studentId)
  } catch {}

  // Summary / reports
  let summary = null
  try {
    summary = loadSummary(studentId)
  } catch {}
  const reportInfo = getLatestReportInfo(studentId)

  // Meeting actions
  const meetingActions = getStudentMeetingActions(studentId)

  // Knowledge base count
  const kbCount = getStudentKbCount(studentId)

  // Trajectory stats
  let trajStats = null
  try {
    trajStats = getTrajectoryStats(studentId)
  } catch {}

  return {
    student: {
      id: student.id,
      name: student.name,
      project: student.project || '',
      role: student.role || 'grad',
      active: student.active !== false,
      enrollment_status: enrollmentStatus,
    },
    graduation: gradData ? {
      progress_pct: gradData.progress_pct || 0,
      risk_level: gradData.risk_level || 'unknown',
      degree: gradData.degree || student.role || 'grad',
      requirements: gradData.requirements || [],
      requirements_template: gradData.template || null,
    } : null,
    capability: vc?.capability || null,
    decisions: vc?.decision_log || [],
    recent_rewards: vc?.recent_rewards || [],
    tasks: taskStats,
    consistency: consistency,
    report: {
      latest_date: reportInfo.date,
      has_summary: !!(summary && summary.summary),
      summary_text: summary?.summary || '',
      risks: summary?.risks || [],
      suggestions: summary?.suggestions || [],
    },
    meetings: {
      action_count: meetingActions.length,
      actions: meetingActions.slice(-5),
    },
    knowledge: {
      doc_count: kbCount,
    },
    trajectory: trajStats,
  }
}

// --- All student profiles (summary, for grid view) ---
export function getAllStudentProfiles() {
  const roster = getRoster()
  return roster.map(s => {
    let gradData = null
    try { gradData = getGraduationSummary(s.id) } catch {}
    const enrollmentStatus = getEnrollmentStatus(gradData)

    const myTasks = getTasksByStudent(s.id)
    const taskProgress = myTasks.length > 0
      ? Math.round((myTasks.filter(t => t.status === 'done').length / myTasks.length) * 100)
      : 0

    let consistency = null
    try { consistency = getConsistencyIndex(s.id) } catch {}

    return {
      id: s.id,
      name: s.name,
      project: s.project || '',
      role: s.role || 'grad',
      active: s.active !== false,
      enrollment_status: enrollmentStatus,
      graduation_progress: gradData?.progress_pct || 0,
      risk_level: gradData?.risk_level || 'unknown',
      task_progress: taskProgress,
      task_total: myTasks.length,
      task_done: myTasks.filter(t => t.status === 'done').length,
      consistency_pct: consistency?.consistency_pct ?? 0,
      consistency_rating: consistency?.rating || 'no_data',
    }
  })
}

// --- Lab-wide graduation progress ---
export function getLabGraduationProgress() {
  const profiles = getAllStudentProfiles()
  const enrolled = profiles.filter(p => p.enrollment_status === 'enrolled')
  const graduated = profiles.filter(p => p.enrollment_status === 'graduated')
  const avgProgress = enrolled.length > 0
    ? Math.round(enrolled.reduce((sum, p) => sum + p.graduation_progress, 0) / enrolled.length)
    : 0
  const atRisk = enrolled.filter(p => p.risk_level === 'high' || p.risk_level === 'critical').length

  return {
    total: profiles.length,
    enrolled: enrolled.length,
    graduated: graduated.length,
    avg_progress: avgProgress,
    at_risk: atRisk,
    profiles: enrolled.map(p => ({
      id: p.id,
      name: p.name,
      progress: p.graduation_progress,
      risk: p.risk_level,
    })),
  }
}

export default {
  getStudentProfile,
  getAllStudentProfiles,
  getLabGraduationProgress,
  taskStatusToPct,
}
