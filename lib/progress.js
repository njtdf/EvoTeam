// progress.js - Feature 5: Codex history -> weekly report draft
// Reads Codex rollout summaries, searches for student name,
// calls AI to generate a bi-weekly report draft.

import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { homedir } from 'os'
import { chatStream, hasApiKey } from './ai.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROLLOUT_DIR = join(homedir(), '.codex', 'memories', 'rollout_summaries')
const MAX_CONTEXT_CHARS = 6000

export function readCodexHistory(studentName, weeks = 4) {
  if (!existsSync(ROLLOUT_DIR)) return []
  const cutoff = Date.now() - weeks * 7 * 24 * 60 * 60 * 1000
  let files = []
  try {
    files = readdirSync(ROLLOUT_DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const fp = join(ROLLOUT_DIR, f)
        const st = statSync(fp)
        return { name: f, path: fp, mtime: st.mtimeMs }
      })
      .filter(f => f.mtime >= cutoff)
      .sort((a, b) => b.mtime - a.mtime)
  } catch { return [] }

  const excerpts = []
  for (const f of files) {
    let content = ''
    try { content = readFileSync(f.path, 'utf-8') } catch { continue }
    const lower = content.toLowerCase()
    const nameLower = studentName.toLowerCase()
    const idx = lower.indexOf(nameLower)
    if (idx < 0) continue
    const start = Math.max(0, idx - 300)
    const end = Math.min(content.length, idx + 1200)
    excerpts.push({
      file: f.name,
      excerpt: content.substring(start, end),
      date: new Date(f.mtime).toISOString().slice(0, 10),
    })
  }
  return excerpts
}

function generateTemplate(studentId, studentName, project) {
  const now = new Date()
  const start = new Date(now.getTime() - 14 * 86400000)
  const fmt = d => d.toISOString().slice(0, 10)
  return `---
title: "Bi-Weekly Report"
student_id: "${studentId}"
name: "${studentName}"
project: "${project || ''}"
period_start: "${fmt(start)}"
period_end: "${fmt(now)}"
submitted_at: "${now.toISOString()}"
status: "on_track"
---

## 1. Progress

1)
2)
3)

## 2. Comments and Concerns

1)

## 3. Activities

1)
2)
3)

## 4. Work Planned Next Two Weeks

1)
2)
3)

## 5. Service Work Done

1)

## 6. Attachments

- (none)
`
}

export async function generateWeeklyDraft(studentId, studentName, project) {
  const excerpts = readCodexHistory(studentName)

  if (excerpts.length === 0 || !hasApiKey()) {
    return {
      draft: generateTemplate(studentId, studentName, project),
      source: excerpts.length === 0 ? 'no_history' : 'no_api_key',
      excerpts_found: excerpts.length,
    }
  }

  // Build context from excerpts, cap total length
  let context = ''
  for (const e of excerpts) {
    const piece = `[${e.date} from ${e.file}]\n${e.excerpt}\n`
    if (context.length + piece.length > MAX_CONTEXT_CHARS) break
    context += piece + '\n---\n\n'
  }

  const now = new Date()
  const start = new Date(now.getTime() - 14 * 86400000)
  const fmt = d => d.toISOString().slice(0, 10)

  const systemPrompt = `You are a research lab AI assistant. Based on the following Codex session excerpts that mention the student "${studentName}", generate a bi-weekly report draft in Markdown.

Rules:
- Output ONLY the Markdown report (frontmatter + 6 sections), no commentary.
- Focus on what the student actually did or is working on, based on the context.
- If context is insufficient for a section, leave placeholder items: 1), 2), 3).
- Use the exact frontmatter format below with real values.

Student info:
- ID: ${studentId}
- Name: ${studentName}
- Project: ${project || ''}
- Period: ${fmt(start)} to ${fmt(now)}

Context excerpts (from teacher's Codex sessions):
${context}`

  let result = ''
  await chatStream(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: 'Generate the bi-weekly report draft now.' }],
    (chunk) => { result += chunk }
  )

  return {
    draft: result || generateTemplate(studentId, studentName, project),
    source: 'ai_generated',
    excerpts_found: excerpts.length,
  }
}

export function apply(ctx, config = {}) {
  const ns = config.namespace || 'progress'
  if (ctx.reflect?.provide) ctx.reflect.provide(ns, { readCodexHistory, generateWeeklyDraft })
  ctx.effect(() => () => {})
}

export default { readCodexHistory, generateWeeklyDraft, apply }