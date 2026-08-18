// skills.js - Feature 6/16: Supervisor-Skills SKILL.md -> LabOS Web
// SKILL.md body 当 DeepSeek system prompt, 师生浏览器里用
import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { chatStream } from './ai.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SKILLS_DIR = join(__dirname, '..', '..', 'Supervisor-Skills-main', 'skills')

function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!m) return { frontmatter: {}, body: content }
  const fm = m[1], body = m[2], obj = {}
  const nm = fm.match(/^name:\s*(.+)$/m)
  if (nm) obj.name = nm[1].trim()
  const dm = fm.match(/^description:\s*>-?\s*\n([\s\S]*?)(?=^\w+:|^$)/m)
  if (dm) obj.description = dm[1].replace(/^\s+/gm, ' ').replace(/\s+/g, ' ').trim()
  else { const ds = fm.match(/^description:\s*(.+)$/m); if (ds) obj.description = ds[1].trim() }
  return { frontmatter: obj, body }
}

export function loadSkillManifest() {
  if (!existsSync(SKILLS_DIR)) return []
  const dirs = readdirSync(SKILLS_DIR).filter(d => {
    const p = join(SKILLS_DIR, d, 'SKILL.md')
    return existsSync(p) && statSync(p).isFile()
  })
  return dirs.map(dirName => {
    const raw = readFileSync(join(SKILLS_DIR, dirName, 'SKILL.md'), 'utf-8')
    const { frontmatter } = parseFrontmatter(raw)
    return { name: frontmatter.name || dirName, dir: dirName, description: frontmatter.description || '' }
  }).sort((a, b) => a.name.localeCompare(b.name))
}

export function getSkillBody(skillName) {
  const manifest = loadSkillManifest()
  const found = manifest.find(s => s.name === skillName || s.dir === skillName)
  if (!found) return null
  const raw = readFileSync(join(SKILLS_DIR, found.dir, 'SKILL.md'), 'utf-8')
  return parseFrontmatter(raw).body
}

export async function runSkill(skillName, userInput, onChunk) {
  const body = getSkillBody(skillName)
  if (!body) { onChunk(`Skill "${skillName}" not found`); return `Skill "${skillName}" not found` }
  return await chatStream(
    [{ role: 'system', content: body }, { role: 'user', content: userInput }],
    onChunk
  )
}

export function apply(ctx, config = {}) {
  const ns = config.namespace || 'skills'
  if (ctx.reflect?.provide) ctx.reflect.provide(ns, { loadSkillManifest, getSkillBody, runSkill })
  ctx.effect(() => () => {})
}
export default { loadSkillManifest, getSkillBody, runSkill, apply }
