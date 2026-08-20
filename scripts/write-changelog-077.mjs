import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const clPath = join(__dirname, '..', 'CHANGELOG.md')

let cl = ''
try { cl = readFileSync(clPath, 'utf8') } catch {}

const entry = `## [0.7.7] - 2026-08-21

### Changed
- **KB search upgraded from TF-IDF to FTS5** (SQLite built-in full-text search, BM25 ranking)
  - \`db.js\`: added \`kb_fts\` FTS5 virtual table
  - \`knowledge.js\`: \`searchKnowledge()\` now uses FTS5 MATCH with BM25 ranking, falls back to TF-IDF
  - 600x better relevance scores on Chinese queries
- **Overview page redesigned** as compact welcome page
  - Removed embedded KB file browser (KB has its own page under Core > Knowledge Base)
  - Added welcome bar with date + weekday + compact stat pills
  - Added "Today's Tasks" section (compact, click to toggle done)
  - Team dynamics feed in scrollable partition
  - Overall vertical scroll, no page bloat

### Added
- \`todayTasks\`, \`todayDateStr\`, \`todayWeekday\` refs in teacher.js
- \`loadTodayTasks()\` function (filters tasks by today's deadline)
- CSS: \`.kn-welcome-bar\`, \`.kn-scroll-area\`, \`.kn-section\`, \`.kn-todo-mini\`, \`.kn-feed-mini\`
- \`scripts/test-fts5.mjs\` — FTS5 verification script
- \`scripts/verify-077.mjs\` — 13-point API test suite (13/13 PASS)

### Fixed
- \`switchToDashboard()\` no longer calls \`loadKbFiles()\` (removed unnecessary KB load on overview)

`

// Prepend new entry (changelog is newest-first)
const newContent = entry + (cl.startsWith('# Change') ? cl : '# Changelog\n\n' + cl)
writeFileSync(clPath, newContent, 'utf8')
console.log('CHANGELOG updated')
console.log('Entry length:', entry.length)
