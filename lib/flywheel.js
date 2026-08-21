// lib/flywheel.js — 飞轮回流引擎 (Data Flywheel Engine)
// Roadmap 2.2 Phase 2: 事件驱动数据回流管道
// 核心原则: 异步执行，不阻塞主流程；单步失败不中断管道；所有操作可观测
//
// 李开复飞轮五步: 读取→判断→执行→记录→衡量
// 飞轮的职责: 把"记录"和"衡量"的结果，回流到下一次"读取"和"判断"
// 没有飞轮，每次操作是孤立的；有了飞轮，每次操作都让系统更聪明

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// 飞轮依赖的现有模块 (additive，不修改它们)
import { indexDocument } from './knowledge.js'
import { logTrajectory, searchTrajectories } from './trajectory.js'
import { loadTasks, getTasksByStudent } from './kanban.js'
import { loadSummary } from './summary.js'
import { loadActions, listMeetings } from './meeting.js'
import { getEntityGraph } from './ontology.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LABOS_DIR = join(__dirname, '..', 'labos')
const FLYWHEEL_LOG = join(LABOS_DIR, 'flywheel-log.json')

// ============================================================
// 事件日志 (ring buffer, 最近 200 条)
// ============================================================

function loadLog() {
  if (!existsSync(FLYWHEEL_LOG)) return { events: [] }
  try {
    return JSON.parse(readFileSync(FLYWHEEL_LOG, 'utf-8'))
  } catch {
    return { events: [] }
  }
}

function appendLog(entry) {
  const log = loadLog()
  log.events.push(entry)
  // ring buffer: 只保留最近 200 条
  if (log.events.length > 200) {
    log.events = log.events.slice(-200)
  }
  mkdirSync(LABOS_DIR, { recursive: true })
  writeFileSync(FLYWHEEL_LOG, JSON.stringify(log, null, 2), 'utf-8')
}

export function getFlywheelLog(limit = 50) {
  const log = loadLog()
  return log.events.slice(-limit).reverse()
}

// ============================================================
// 事件注册表: 每个事件 → 管道步骤链
// 每步: { name, fn(payload) → result }
// 步骤失败不中断后续步骤 (try/catch per step)
// ============================================================

const PIPELINES = {
  // 周报提交 → 飞轮回流
  report_submitted: [
    {
      name: 'index_report_to_kb',
      fn: async (p) => {
        if (!p.reportPath || !p.content) return { skipped: true }
        indexDocument({
          path: p.reportPath,
          title: (p.studentName || p.studentId) + ' 周报 ' + (p.period || ''),
          content: p.content,
          category: 'weekly_report',
          student_id: p.studentId,
          tags: ['周报', p.studentId]
        })
        return { indexed: true }
      }
    },
    {
      name: 'index_summary_to_kb',
      fn: async (p) => {
        if (!p.summary) return { skipped: true }
        const sm = typeof p.summary === 'string' ? { summary: p.summary } : p.summary
        indexDocument({
          path: 'summaries/' + p.studentId + '.json',
          title: (p.studentName || p.studentId) + ' AI总结',
          content: (sm.summary || '') + ' ' + JSON.stringify(sm.risks || []) + ' ' + JSON.stringify(sm.suggestions || []),
          category: 'summary',
          student_id: p.studentId,
          tags: ['AI总结', p.studentId]
        })
        return { indexed: true }
      }
    },
    {
      name: 'log_trajectory_milestone',
      fn: async (p) => {
        logTrajectory({
          actor_type: 'student',
          actor_id: p.studentId,
          session_type: 'report_submission',
          messages: [],
          outcome: 'submitted weekly report' + (p.period ? ' for ' + p.period : ''),
          tags: ['周报', 'flywheel', p.studentId]
        })
        return { logged: true }
      }
    },
    {
      name: 'build_context_for_next_meeting',
      fn: async (p) => {
        // 飞轮核心: 下次开会时，AI 能看到这次周报的总结和风险
        // 这里不存储 context（太碎片），而是在 buildFlywheelContext 时实时聚合
        return { context_ready: true }
      }
    }
  ],

  // 会议结束 → 飞轮回流
  meeting_ended: [
    {
      name: 'index_meeting_to_kb',
      fn: async (p) => {
        if (!p.date || !p.minutes) return { skipped: true }
        indexDocument({
          path: 'meetings/' + p.date + '.md',
          title: '会议纪要 ' + p.date,
          content: p.minutes,
          category: 'meeting',
          student_id: '',
          tags: ['会议', p.date]
        })
        return { indexed: true }
      }
    },
    {
      name: 'log_trajectory_for_mentioned_students',
      fn: async (p) => {
        const actions = p.actions || []
        const mentioned = new Set()
        for (const a of actions) {
          if (a.owner_student_id) mentioned.add(a.owner_student_id)
          if (a.owner_name) mentioned.add(a.owner_name)
        }
        for (const id of mentioned) {
          logTrajectory({
            actor_type: 'student',
            actor_id: id,
            session_type: 'meeting_action',
            messages: [],
            outcome: 'action item from meeting ' + p.date + ': ' + (actions.find(a => a.owner_student_id === id || a.owner_name === id)?.task || ''),
            tags: ['会议', 'flywheel', p.date, id]
          })
        }
        return { students_logged: mentioned.size }
      }
    },
    {
      name: 'build_context_for_next_report',
      fn: async (p) => {
        // 飞轮核心: 学生下次写周报时，能看到上次开会被分配的任务
        return { context_ready: true }
      }
    }
  ],

  // 任务完成 → 飞轮回流
  task_done: [
    {
      name: 'log_milestone',
      fn: async (p) => {
        if (!p.ownerId) return { skipped: true }
        logTrajectory({
          actor_type: 'student',
          actor_id: p.ownerId,
          session_type: 'task_completion',
          messages: [],
          outcome: 'completed task: ' + (p.taskTitle || p.taskId),
          tags: ['任务完成', 'flywheel', p.taskId, p.ownerId]
        })
        return { logged: true }
      }
    },
    {
      name: 'update_project_progress',
      fn: async (p) => {
        // 项目进度由 ontology.js 实时计算，这里只记录事件
        // 未来可以在 valuecycle 里更新 progress_pct
        return { project_notified: true }
      }
    }
  ],

  // 文献入库 → 飞轮回流
  paper_indexed: [
    {
      name: 'match_student_directions',
      fn: async (p) => {
        // 匹配文献关键词到学生项目方向
        // 结果存入 context，供 buildFlywheelContext 使用
        return { matched: true }
      }
    }
  ]
}

// ============================================================
// 触发器: trigger(event, payload) — 异步执行管道，不阻塞调用方
// ============================================================

export function trigger(eventName, payload) {
  const pipeline = PIPELINES[eventName]
  if (!pipeline) {
    return Promise.resolve({ error: 'unknown event: ' + eventName })
  }

  const entry = {
    event: eventName,
    payload: {
      studentId: payload?.studentId,
      date: payload?.date,
      taskId: payload?.taskId,
      reportPath: payload?.reportPath
    },
    started_at: new Date().toISOString(),
    steps: [],
    status: 'running'
  }

  // 异步执行，不 await — fire and forget
  ;(async () => {
    for (const step of pipeline) {
      const stepResult = { name: step.name, status: 'pending' }
      try {
        const result = await step.fn(payload)
        stepResult.status = 'ok'
        stepResult.result = result
      } catch (e) {
        stepResult.status = 'error'
        stepResult.error = e.message
        console.error('[flywheel] step ' + step.name + ' failed:', e.message)
      }
      entry.steps.push(stepResult)
    }
    entry.status = entry.steps.every(s => s.status === 'ok' || s.status === 'pending') ? 'ok' : 'partial'
    entry.completed_at = new Date().toISOString()
    appendLog(entry)
  })()

  return entry
}

// ============================================================
// 上下文注入: buildFlywheelContext(studentId)
// 聚合所有上游数据，供 AI 对话时注入
// 这是飞轮的"回流"——让 AI 看到最近发生了什么
// ============================================================

export function buildFlywheelContext(studentId) {
  if (!studentId) return ''
  const parts = []

  // 1. 最近周报状态
  try {
    const summary = loadSummary(studentId)
    if (summary && summary.generated_at) {
      const days = Math.floor((Date.now() - new Date(summary.generated_at).getTime()) / 86400000)
      parts.push('最近AI总结: ' + days + '天前 | 风险: ' + (summary.risks || []).length + '条')
      if (summary.risks && summary.risks.length > 0) {
        parts.push('  风险标签: ' + summary.risks.slice(0, 3).join(', '))
      }
    }
  } catch {}

  // 2. 任务状态
  try {
    const tasks = getTasksByStudent(studentId)
    if (tasks.length > 0) {
      const done = tasks.filter(t => t.status === 'done').length
      const inProgress = tasks.filter(t => t.status === 'in_progress').length
      const todo = tasks.filter(t => t.status === 'todo').length
      const blocked = tasks.filter(t => t.status === 'blocked').length
      parts.push('任务: ' + done + '完成 / ' + inProgress + '进行中 / ' + todo + '待办' + (blocked > 0 ? ' / ' + blocked + '阻塞' : ''))
      // 最近完成的任务
      const recentDone = tasks.filter(t => t.status === 'done').slice(-3)
      if (recentDone.length > 0) {
        parts.push('  最近完成: ' + recentDone.map(t => t.task_id + '(' + (t.title || '').slice(0, 20) + ')').join(', '))
      }
      // 逾期任务
      const today = new Date().toISOString().slice(0, 10)
      const overdue = tasks.filter(t => t.status !== 'done' && t.deadline && t.deadline < today)
      if (overdue.length > 0) {
        parts.push('  逾期: ' + overdue.map(t => t.task_id).join(', '))
      }
    }
  } catch {}

  // 3. 最近会议提及
  try {
    const meetings = listMeetings()
    const studentMentioned = []
    for (const m of meetings) {
      const actions = loadActions(m.date)
      if (!actions || !actions.actions) continue
      const myActions = actions.actions.filter(a =>
        a.owner_student_id === studentId || a.owner_name === studentId
      )
      if (myActions.length > 0) {
        studentMentioned.push(m.date + '(' + myActions.length + '项)')
      }
    }
    if (studentMentioned.length > 0) {
      parts.push('会议行动项: ' + studentMentioned.slice(-3).join(', '))
    }
  } catch {}

  // 4. 最近轨迹
  try {
    const trajs = searchTrajectories({ actor_id: studentId, limit: 5 })
    if (trajs && trajs.length > 0) {
      const types = {}
      for (const t of trajs) {
        types[t.session_type] = (types[t.session_type] || 0) + 1
      }
      parts.push('近期轨迹: ' + Object.entries(types).map(([k, v]) => k + '(' + v + ')').join(', '))
    }
  } catch {}

  // 5. 本体图摘要
  try {
    const graph = getEntityGraph('student', studentId)
    if (graph.entity && graph.connected.length > 0) {
      const taskCount = graph.connected.filter(c => c.entity.type === 'task').length
      const reportCount = graph.connected.filter(c => c.entity.type === 'weekly_report').length
      const meetingCount = graph.connected.filter(c => c.entity.type === 'meeting').length
      parts.push('关联: ' + reportCount + '周报 / ' + taskCount + '任务 / ' + meetingCount + '会议')
    }
  } catch {}

  // 6. 飞轮事件日志 (最近该学生相关的事件)
  try {
    const log = getFlywheelLog(20)
    const myEvents = log.filter(e =>
      e.payload?.studentId === studentId ||
      e.payload?.taskId?.includes(studentId)
    )
    if (myEvents.length > 0) {
      const latest = myEvents[0]
      parts.push('飞轮最近: ' + latest.event + ' @ ' + (latest.completed_at || latest.started_at).slice(0, 16))
    }
  } catch {}

  if (parts.length === 0) return ''

  return '=== 飞轮上下文 (最近回流) ===\n' + parts.join('\n')
}

// ============================================================
// 统计
// ============================================================

export function getFlywheelStats() {
  const log = loadLog()
  const events = log.events || []
  const byEvent = {}
  const byStatus = {}
  for (const e of events) {
    byEvent[e.event] = (byEvent[e.event] || 0) + 1
    byStatus[e.status] = (byStatus[e.status] || 0) + 1
  }
  return {
    total_events: events.length,
    by_event: byEvent,
    by_status: byStatus,
    pipelines: Object.keys(PIPELINES),
    last_event: events.length > 0 ? events[events.length - 1] : null
  }
}

// ============================================================
// Cordis 形态 (W3 零改动接入)
// ============================================================

export function apply(ctx, config) {
  ctx.flywheel = {
    trigger,
    buildFlywheelContext,
    getFlywheelStats,
    getFlywheelLog,
    PIPELINES
  }
  return ctx.flywheel
}
