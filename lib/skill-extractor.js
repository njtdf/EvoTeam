// lib/skill-extractor.js — W12: 轨迹 → Skill 抽取 (半自动)
// 从人-AI 交互轨迹中提取可复用的技能模板
// 存储: labos/skills/extracted/*.json

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LABOS_DIR = join(__dirname, '..', 'labos')
const SKILLS_DIR = join(LABOS_DIR, 'skills', 'extracted')

function ensureDir() { mkdirSync(SKILLS_DIR, { recursive: true }) }

// Extract skills from a trajectory using heuristics (no AI needed for MVP)
// A "skill" = a pattern that appears in the trajectory: user asked X, AI responded Y, outcome was Z
export function extractSkillsFromTrajectory(trajectory) {
  if (!trajectory || !trajectory.messages) return []

  const skills = []
  const messages = trajectory.messages.filter(m => m.role === 'assistant' || m.role === 'user')

  // Heuristic 1: If a user message contains a question pattern, extract as Q&A skill
  for (let i = 0; i < messages.length - 1; i++) {
    const userMsg = messages[i]
    const aiMsg = messages[i + 1]
    if (userMsg.role === 'user' && aiMsg.role === 'assistant') {
      const content = (userMsg.content || '').toLowerCase()
      // Pattern: "怎么" / "如何" / "how to" → extract as how-to skill
      if (content.includes('怎么') || content.includes('如何') || content.includes('how to') || content.includes('help')) {
        skills.push({
          skill_id: 'SK-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          type: 'how_to',
          trigger: (userMsg.content || '').slice(0, 200),
          response: (aiMsg.content || '').slice(0, 500),
          context_tags: trajectory.tags || [],
          source_trajectory: trajectory.id || trajectory.timestamp,
          extracted_at: new Date().toISOString(),
        })
      }
      // Pattern: code block in response → extract as code skill
      if ((aiMsg.content || '').includes('```')) {
        skills.push({
          skill_id: 'SK-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          type: 'code_snippet',
          trigger: (userMsg.content || '').slice(0, 200),
          response: (aiMsg.content || '').slice(0, 1000),
          context_tags: trajectory.tags || [],
          source_trajectory: trajectory.id || trajectory.timestamp,
          extracted_at: new Date().toISOString(),
        })
      }
    }
  }

  return skills
}

// Extract skills from all trajectories in a directory
export function extractFromAllTrajectories() {
  const trajDir = join(LABOS_DIR, 'trajectories')
  if (!existsSync(trajDir)) return { ok: true, count: 0, skills: [] }

  const files = readdirSync(trajDir).filter(f => f.endsWith('.json'))
  let allSkills = []

  for (const f of files) {
    try {
      const traj = JSON.parse(readFileSync(join(trajDir, f), 'utf-8'))
      const skills = extractSkillsFromTrajectory(traj)
      allSkills = [...allSkills, ...skills]
    } catch {}
  }

  // Deduplicate by trigger similarity (simple: same first 50 chars)
  const seen = new Set()
  const unique = allSkills.filter(s => {
    const key = s.trigger.slice(0, 50)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Save
  ensureDir()
  const outputFile = join(SKILLS_DIR, 'extracted-' + new Date().toISOString().slice(0, 10) + '.json')
  writeFileSync(outputFile, JSON.stringify({ extracted_at: new Date().toISOString(), count: unique.length, skills: unique }, null, 2), 'utf-8')

  return { ok: true, count: unique.length, file: outputFile, skills: unique }
}

// List extracted skills
export function listExtractedSkills() {
  if (!existsSync(SKILLS_DIR)) return []
  const files = readdirSync(SKILLS_DIR).filter(f => f.endsWith('.json'))
  const all = []
  for (const f of files) {
    try {
      const data = JSON.parse(readFileSync(join(SKILLS_DIR, f), 'utf-8'))
      all.push(...(data.skills || []))
    } catch {}
  }
  return all
}

// Search extracted skills by keyword
export function searchSkills(query, limit = 10) {
  const skills = listExtractedSkills()
  const q = (query || '').toLowerCase()
  return skills
    .filter(s => s.trigger.toLowerCase().includes(q) || s.response.toLowerCase().includes(q))
    .slice(0, limit)
}

// Get skill stats
export function getSkillStats() {
  const skills = listExtractedSkills()
  const byType = {}
  for (const s of skills) byType[s.type] = (byType[s.type] || 0) + 1
  return { total: skills.length, byType, recent: skills.slice(-5) }
}

// Cordis form
export function apply(ctx, config = {}) {
  ctx.service('skillExtractor', {
    extract: (traj) => extractSkillsFromTrajectory(traj),
    extractAll: () => extractFromAllTrajectories(),
    list: () => listExtractedSkills(),
    search: (q, l) => searchSkills(q, l),
    stats: () => getSkillStats(),
  })
  ctx.on('ready', () => ctx.logger?.info?.('skillExtractor plugin ready'))
}

export default {
  extractSkillsFromTrajectory, extractFromAllTrajectories,
  listExtractedSkills, searchSkills, getSkillStats, apply,
}
