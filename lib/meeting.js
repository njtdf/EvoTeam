// meeting.js - Feature 2: 会议纪要 → 行动指令
// 听记硬件生成的会议纪要 MD → AI 抽取决议+行动项 → 姓名匹配学生 → 导师改派确认
// Cordis-shaped: 导出 apply(ctx, config),W1 由 server.js 直接 import,W3 零改动接入 runtime

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { load as parseYaml } from 'js-yaml'
import { extractActions } from './ai.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MEETINGS_DIR = join(__dirname, '..', 'labos', 'meetings')

// --- 存储路径 ---
function meetingMdPath(date) {
  return join(MEETINGS_DIR, `${date}.md`)
}
function actionsPath(date) {
  return join(MEETINGS_DIR, `${date}.actions.json`)
}

function ensureDir() {
  mkdirSync(MEETINGS_DIR, { recursive: true })
}

// --- 读取学生 roster(仅 active 学生,用于姓名→ID 权威匹配) ---
export function getRoster() {
  const path = join(__dirname, '..', 'labos', 'students.yaml')
  if (!existsSync(path)) return []
  const raw = readFileSync(path, 'utf-8')
  const parsed = parseYaml(raw)
  return (parsed.students || [])
    .filter(s => s.active !== false && s.role !== 'teacher')
    .map(s => ({ id: s.id, name: s.name, project: s.project }))
}

// --- parseMinutes: 按常见标题切块,兜底整篇 ---
// 返回 { raw, sections: [{heading, content}] }
export function parseMinutes(md) {
  const sections = []
  const lines = md.split('\n')
  let cur = null
  let buf = []
  for (const line of lines) {
    if (/^\s*#{1,6}\s+/.test(line)) {
      if (cur) sections.push({ heading: cur, content: buf.join('\n').trim() })
      cur = line.replace(/^\s*#{1,6}\s+/, '').trim()
      buf = []
    } else {
      buf.push(line)
    }
  }
  if (cur) sections.push({ heading: cur, content: buf.join('\n').trim() })
  if (sections.length === 0) sections.push({ heading: '全文', content: md.trim() })
  return { raw: md, sections }
}

// --- 会议纪要 CRUD ---
export function saveMeeting(date, md) {
  ensureDir()
  writeFileSync(meetingMdPath(date), md, 'utf-8')
}

export function loadMeeting(date) {
  const p = meetingMdPath(date)
  if (!existsSync(p)) return null
  return readFileSync(p, 'utf-8')
}

export function loadActions(date) {
  const p = actionsPath(date)
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
}

export function saveActions(date, obj) {
  ensureDir()
  writeFileSync(actionsPath(date), JSON.stringify(obj, null, 2), 'utf-8')
}

// 会议历史列表(按日期倒序)
export function listMeetings() {
  if (!existsSync(MEETINGS_DIR)) return []
  const files = readdirSync(MEETINGS_DIR).filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
  const dates = files.map(f => f.replace(/\.md$/, ''))
  return dates.sort().reverse().map(date => {
    const actions = loadActions(date)
    return {
      date,
      has_actions: !!actions,
      status: actions?.status || 'none',
      action_count: actions?.actions?.length || 0,
    }
  })
}

// --- matchOwners: 权威 name→id 匹配(不信任 LLM 的 id 输出) ---
export function matchOwners(actions, roster) {
  const byName = new Map(roster.map(r => [r.name, r.id]))
  return (actions || []).map(a => {
    const name = (a.owner_name || '').trim()
    const matched = name && byName.has(name)
    return {
      ...a,
      owner_name: name,
      owner_student_id: matched ? byName.get(name) : null,
      unmatched: !matched,
    }
  })
}

// --- runExtraction: 读 .md → AI 抽取 → matchOwners → 存 .actions.json ---
export async function runExtraction(date) {
  const md = loadMeeting(date)
  if (!md) throw new Error(`Meeting ${date} not found`)
  const roster = getRoster()
  const ai = await extractActions(md, roster)

  const actions = matchOwners(ai.actions || [], roster).map((a, i) => ({
    task_id: `${date}-A${String(i + 1).padStart(2, '0')}`,
    task: a.task || '',
    owner_name: a.owner_name || '',
    owner_student_id: a.owner_student_id,
    unmatched: a.unmatched,
    deadline: a.deadline || '',
    context: a.context || '',
    source_section: a.source_section || '',
    source: 'meeting',
    status: 'pending',
  }))

  const result = {
    date,
    generated_at: new Date().toISOString(),
    status: ai.status,
    decisions: ai.decisions || [],
    actions,
  }

  saveActions(date, result)
  return result
}

// --- Cordis 形态:apply(ctx, config) ---
// W1 不接入 runtime,server.js 直接 import 上述函数。
// W3 起 Cordis loader 时,此 apply 注册 meeting 服务,零改动复用核心逻辑。
export function apply(ctx, config = {}) {
  const ns = config.namespace || 'meeting'
  if (ctx.reflect?.provide) {
    ctx.reflect.provide(ns, {
      getRoster, parseMinutes, saveMeeting, loadMeeting, loadActions, saveActions,
      listMeetings, matchOwners, runExtraction,
    })
  }
  ctx.effect(() => () => {
    // noop: meeting 模块为无状态文件 I/O,无需运行时清理
  })
}

export default {
  getRoster, parseMinutes, saveMeeting, loadMeeting, loadActions, saveActions,
  listMeetings, matchOwners, runExtraction, apply,
}
