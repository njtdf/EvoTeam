import { initDb, getDb } from '../lib/db.js'
import { indexAll, searchKnowledge } from '../lib/knowledge.js'

initDb()
const db = getDb()

// Check if kb_fts table exists
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kb_fts'").get()
console.log('kb_fts table:', tables ? 'EXISTS' : 'MISSING')

// Count FTS rows
try {
  const cnt = db.prepare('SELECT COUNT(*) as c FROM kb_fts').get()
  console.log('kb_fts rows (before):', cnt.c)
} catch(e) { console.log('kb_fts count error:', e.message) }

// Rebuild index (will populate FTS5)
const result = indexAll()
console.log('indexAll result:', JSON.stringify(result))

// Count FTS rows after rebuild
try {
  const cnt = db.prepare('SELECT COUNT(*) as c FROM kb_fts').get()
  console.log('kb_fts rows (after rebuild):', cnt.c)
} catch(e) { console.log('kb_fts count error:', e.message) }

// FTS5 search tests
const r1 = searchKnowledge('Benders', 5)
console.log('FTS5 search Benders:', r1.length, 'results')
if (r1.length > 0) console.log('  top:', r1[0].title, 'score:', r1[0].score)

const r2 = searchKnowledge('V2G', 5)
console.log('FTS5 search V2G:', r2.length, 'results')
if (r2.length > 0) console.log('  top:', r2[0].title, 'score:', r2[0].score)

const r3 = searchKnowledge('韧性', 5)
console.log('FTS5 search 韧性:', r3.length, 'results')
if (r3.length > 0) console.log('  top:', r3[0].title, 'score:', r3[0].score)

const r4 = searchKnowledge('周报 进度', 5)
console.log('FTS5 search 周报 进度:', r4.length, 'results')
if (r4.length > 0) console.log('  top:', r4[0].title, 'score:', r4[0].score)

console.log('\\n=== FTS5 upgrade verification complete ===')
