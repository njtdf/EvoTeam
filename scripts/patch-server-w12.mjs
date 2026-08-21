import { readFileSync, writeFileSync } from 'fs'
const s = readFileSync('server.js', 'utf8')

// Add skill-extractor import
const oldImport = "import { recordEvent, recordFromNews, recordFromEmails, getUnprocessed, markProcessed, getRecentEvents, buildExternalContext, getEventStats } from './lib/external-events.js'"
const newImport = oldImport + `
import { extractFromAllTrajectories, listExtractedSkills, searchSkills, getSkillStats } from './lib/skill-extractor.js'`

if (!s.includes(oldImport)) { console.error('FATAL'); process.exit(1) }
let updated = s.replace(oldImport, newImport)

// Add skill routes before the Value Cycle Dashboard
const beforeVC = "// --- API: Value Cycle Dashboard (W15) ---"
const skillRoutes = `// --- API: Skill Extractor (W12) ---
app.get('/api/skills/extracted', requireAuth, (req, res) => {
  res.json({ skills: listExtractedSkills(), stats: getSkillStats() })
})

app.get('/api/skills/extracted/search', requireAuth, (req, res) => {
  const q = req.query.q || ''
  res.json({ results: searchSkills(q, 20) })
})

app.post('/api/skills/extract', requireRole('teacher'), async (req, res) => {
  const result = extractFromAllTrajectories()
  res.json(result)
})

app.get('/api/skills/extracted/stats', requireAuth, (req, res) => {
  res.json(getSkillStats())
})

`

if (!updated.includes(beforeVC)) { console.error('FATAL: W15 marker not found'); process.exit(1) }
updated = updated.replace(beforeVC, skillRoutes + beforeVC)

writeFileSync('server.js', updated, 'utf-8')
console.log('OK: server.js skill-extractor routes added')
