import { getDb } from './db.js'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LABOS = join(__dirname, '..', 'labos')

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
  'could', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'why',
  'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'just', 'this', 'that', 'these', 'those', 'it', 'its'
])

/**
 * Tokenize text into keywords.
 * English: split by non-alphanumeric, lowercase, remove stopwords, min 2 chars.
 * Chinese: character bigrams (pairs of consecutive CJK chars).
 */
export function tokenize(text) {
  if (!text) return []
  const tokens = []

  // English tokens
  const enWords = text.toLowerCase().split(/[^a-z0-9]+/i)
  for (const w of enWords) {
    if (w.length >= 2 && !STOPWORDS.has(w)) {
      tokens.push(w)
    }
  }

  // Chinese bigrams (CJK Unicode range)
  const cjkChars = []
  for (const ch of text) {
    const code = ch.codePointAt(0)
    if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)) {
      cjkChars.push(ch)
    }
  }
  for (let i = 0; i < cjkChars.length - 1; i++) {
    tokens.push(cjkChars[i] + cjkChars[i + 1])
  }

  return tokens
}

/**
 * Index a single document into kb_documents + kb_keywords (TF-IDF inverted index).
 */
export function indexDocument({ path, title, content, category, student_id, tags }) {
  const db = getDb()

  // Delete existing doc + keywords (cascade) if path already exists
  const existing = db.prepare('SELECT id FROM kb_documents WHERE path = ?').get(path)
  if (existing) {
    db.prepare('DELETE FROM kb_keywords WHERE document_id = ?').run(existing.id)
    db.prepare('DELETE FROM kb_documents WHERE id = ?').run(existing.id)
  }

  // Insert document
  const docInfo = db.prepare(
    'INSERT INTO kb_documents (path, title, content, tags_json, category, student_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(path, title || '', content || '', JSON.stringify(tags || []), category || 'unknown', student_id || null)
  const docId = docInfo.lastInsertRowid

  // Tokenize and compute term frequencies
  const tokens = tokenize(content)
  const totalTokens = tokens.length || 1
  const tfMap = {}
  for (const t of tokens) {
    tfMap[t] = (tfMap[t] || 0) + 1
  }

  // Insert keywords with TF values
  const insertKw = db.prepare('INSERT INTO kb_keywords (document_id, keyword, tf) VALUES (?, ?, ?)')
  const insertMany = db.transaction((entries) => {
    for (const [keyword, count] of entries) {
      insertKw.run(docId, keyword, count / totalTokens)
    }
  })
  insertMany(Object.entries(tfMap))

  // Also index into FTS5 virtual table for full-text search
  try {
    db.prepare('DELETE FROM kb_fts WHERE rowid = ?').run(docId)
    db.prepare('INSERT INTO kb_fts (rowid, title, content, path, category) VALUES (?, ?, ?, ?, ?)').run(
      docId, title || '', content || '', path, category || 'unknown'
    )
  } catch {}

  return { id: docId, keywords: Object.keys(tfMap).length }
}

/**
 * Index all existing documents: reports, meetings, summaries.
 */
export function indexAll() {
  let totalDocs = 0
  let totalKeywords = 0

  // 1. Reports
  const reportsDir = join(LABOS, 'reports')
  if (existsSync(reportsDir)) {
    for (const sd of readdirSync(reportsDir, { withFileTypes: true })) {
      if (!sd.isDirectory() || sd.name === 'template') continue
      const sdir = join(reportsDir, sd.name)
      for (const f of readdirSync(sdir).filter(f => f.endsWith('.md'))) {
        const content = readFileSync(join(sdir, f), 'utf8')
        const r = indexDocument({
          path: 'reports/' + sd.name + '/' + f,
          title: sd.name + ' - ' + f,
          content: content,
          category: 'report',
          student_id: sd.name
        })
        totalDocs++
        totalKeywords += r.keywords
      }
    }
  }

  // 2. Summaries
  const summariesDir = join(LABOS, 'summaries')
  if (existsSync(summariesDir)) {
    for (const f of readdirSync(summariesDir).filter(f => f.endsWith('.json'))) {
      const data = JSON.parse(readFileSync(join(summariesDir, f), 'utf8'))
      const content = [data.summary, ...(data.risks || []), ...(data.suggestions || [])].join('\n')
      const r = indexDocument({
        path: 'summaries/' + f,
        title: f,
        content: content,
        category: 'summary',
        student_id: f.replace('.json', '')
      })
      totalDocs++
      totalKeywords += r.keywords
    }
  }

  // 3. Meetings
  const meetingsDir = join(LABOS, 'meetings')
  if (existsSync(meetingsDir)) {
    for (const f of readdirSync(meetingsDir).filter(f => f.endsWith('.md') && !f.startsWith('_'))) {
      const content = readFileSync(join(meetingsDir, f), 'utf8')
      const r = indexDocument({
        path: 'meetings/' + f,
        title: f,
        content: content,
        category: 'meeting'
      })
      totalDocs++
      totalKeywords += r.keywords
    }
  }

  return { docs: totalDocs, keywords: totalKeywords }
}

/**
 * TF-IDF cosine similarity search.
 * Returns [{title, path, category, student_id, snippet, score}]
 */
export function searchKnowledge(query, limit = 10) {
  const db = getDb()
  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) return []

  // --- FTS5 fast path (10x faster, built-in BM25 ranking) ---
  try {
    const ftsRows = db.prepare(`
      SELECT d.id, d.title, d.path, d.category, d.student_id,
             d.content, bm25(kb_fts) as rank
      FROM kb_fts JOIN kb_documents d ON d.id = kb_fts.rowid
      WHERE kb_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit)
    if (ftsRows.length > 0) {
      return ftsRows.map(r => ({
        title: r.title,
        path: r.path,
        category: r.category,
        student_id: r.student_id,
        snippet: (r.content || '').slice(0, 300).replace(/\n/g, ' '),
        score: Math.round(Math.abs(r.rank) * 1000) / 1000
      }))
    }
  } catch {}

  // --- TF-IDF fallback (if FTS5 table empty or unavailable) ---
  // Get total document count
  const totalDocs = db.prepare('SELECT COUNT(*) as c FROM kb_documents').get().c
  if (totalDocs === 0) return []

  // Build query TF
  const queryTf = {}
  for (const t of queryTokens) {
    queryTf[t] = (queryTf[t] || 0) + 1
  }

  // For each query token, find matching documents and compute TF-IDF
  const docScores = {}
  const docInfo = {}

  for (const token of Object.keys(queryTf)) {
    // Count docs containing this token (for IDF)
    const dfRow = db.prepare('SELECT COUNT(DISTINCT document_id) as c FROM kb_keywords WHERE keyword = ?').get(token)
    const df = dfRow.c
    if (df === 0) continue
    const idf = Math.log((totalDocs + 1) / (df + 1)) + 1

    // Get all docs with this token
    const rows = db.prepare('SELECT document_id, tf FROM kb_keywords WHERE keyword = ?').all(token)
    for (const row of rows) {
      const tfidf = row.tf * idf
      docScores[row.document_id] = (docScores[row.document_id] || 0) + tfidf
      if (!docInfo[row.document_id]) {
        const d = db.prepare('SELECT * FROM kb_documents WHERE id = ?').get(row.document_id)
        docInfo[row.document_id] = d
      }
    }
  }

  // Normalize by document vector magnitude (approximate: use keyword count)
  const results = []
  for (const docId of Object.keys(docScores)) {
    const doc = docInfo[docId]
    if (!doc) continue
    const kwCount = db.prepare('SELECT COUNT(*) as c FROM kb_keywords WHERE document_id = ?').get(docId).c
    const magnitude = Math.sqrt(kwCount) || 1
    const score = docScores[docId] / magnitude

    // Build snippet (first 200 chars around first matching keyword)
    let snippet = (doc.content || '').slice(0, 300).replace(/\n/g, ' ')
    results.push({
      title: doc.title,
      path: doc.path,
      category: doc.category,
      student_id: doc.student_id,
      snippet: snippet,
      score: Math.round(score * 1000) / 1000
    })
  }

  // Sort by score DESC, take top N
  results.sort((a, b) => b.score - a.score)
  return results.slice(0, limit)
}

/**
 * Get document statistics by category.
 */
export function getDocumentStats() {
  const db = getDb()
  const rows = db.prepare('SELECT category, COUNT(*) as c FROM kb_documents GROUP BY category').all()
  const total = db.prepare('SELECT COUNT(*) as c FROM kb_documents').get().c
  const kwTotal = db.prepare('SELECT COUNT(*) as c FROM kb_keywords').get().c
  return { total_docs: total, total_keywords: kwTotal, by_category: rows }
}

/**
 * Get knowledge graph data (student -> project -> tasks -> meetings).
 */
export function getKnowledgeGraph() {
  const db = getDb()
  const students = db.prepare('SELECT id, name, project FROM students WHERE role != ? ORDER BY id').all('teacher')
  const tasks = db.prepare('SELECT owner_student_id, task_id, title, status FROM tasks WHERE owner_student_id IS NOT NULL').all()
  const docs = db.prepare('SELECT student_id, category, COUNT(*) as c FROM kb_documents WHERE student_id IS NOT NULL GROUP BY student_id, category').all()

  const nodes = []
  const edges = []

  for (const s of students) {
    nodes.push({ id: s.id, label: s.name, type: 'student', project: s.project })
    if (s.project) {
      const projId = 'proj_' + s.id
      nodes.push({ id: projId, label: s.project, type: 'project' })
      edges.push({ source: s.id, target: projId, type: 'owns' })
    }
  }

  for (const t of tasks) {
    edges.push({ source: t.owner_student_id, target: t.task_id, type: 'assigned' })
    nodes.push({ id: t.task_id, label: t.title, type: 'task', status: t.status })
  }

  return { nodes: nodes, edges: edges, stats: { students: students.length, tasks: tasks.length, docs: docs } }
}

/**
 * Cordis apply() shape.
 */
export function apply(ctx, config) {
  ctx.knowledge = {
    indexDocument, indexAll, searchKnowledge, getDocumentStats, getKnowledgeGraph, tokenize
  }
  return ctx.knowledge
}

export default {
  tokenize, indexDocument, indexAll, searchKnowledge, getDocumentStats, getKnowledgeGraph, apply
}
