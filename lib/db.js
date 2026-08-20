import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LABOS_DIR = join(__dirname, '..', 'labos')
const DB_PATH = join(LABOS_DIR, 'autoprof.db')

let _db = null

export function getDb() {
  if (_db) return _db
  if (!existsSync(LABOS_DIR)) mkdirSync(LABOS_DIR, { recursive: true })
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  _db.pragma('busy_timeout = 5000')
  return _db
}

const SCHEMA_SQL = [
  "CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, name TEXT NOT NULL, project TEXT, role TEXT NOT NULL, password TEXT, active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, file_path TEXT NOT NULL, period_start TEXT, period_end TEXT, submitted_at TEXT, content TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (student_id) REFERENCES students(id))",
  "CREATE INDEX IF NOT EXISTS idx_reports_student ON reports(student_id)",
  "CREATE TABLE IF NOT EXISTS summaries (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, report_file TEXT, summary TEXT, risks_json TEXT, suggestions_json TEXT, generated_at TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (student_id) REFERENCES students(id))",
  "CREATE INDEX IF NOT EXISTS idx_summaries_student ON summaries(student_id)",
  "CREATE TABLE IF NOT EXISTS tasks (task_id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, owner_student_id TEXT, owner_name TEXT, status TEXT DEFAULT 'todo', priority TEXT DEFAULT 'medium', deadline TEXT, source TEXT, source_ref TEXT, project TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (owner_student_id) REFERENCES students(id))",
  "CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner_student_id)",
  "CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)",
  "CREATE TABLE IF NOT EXISTS meetings (date TEXT PRIMARY KEY, minutes_md TEXT, actions_json TEXT, decisions_json TEXT, status TEXT, generated_at TEXT, created_at TEXT DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS chat_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, timestamp TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (student_id) REFERENCES students(id))",
  "CREATE INDEX IF NOT EXISTS idx_chat_student ON chat_messages(student_id)",
  "CREATE TABLE IF NOT EXISTS agent_chat_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, timestamp TEXT, created_at TEXT DEFAULT (datetime('now')))",
  "CREATE INDEX IF NOT EXISTS idx_agent_chat_agent ON agent_chat_messages(agent_id)",
  "CREATE TABLE IF NOT EXISTS value_cycles (student_id TEXT PRIMARY KEY, data_json TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (student_id) REFERENCES students(id))",
  "CREATE TABLE IF NOT EXISTS trajectories (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_type TEXT, actor_id TEXT, session_type TEXT, messages_json TEXT, outcome TEXT, tags_json TEXT, created_at TEXT DEFAULT (datetime('now')))",
  "CREATE INDEX IF NOT EXISTS idx_traj_actor ON trajectories(actor_id)",
  "CREATE TABLE IF NOT EXISTS kb_documents (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT UNIQUE, title TEXT, content TEXT, tags_json TEXT, category TEXT, student_id TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))",
  "CREATE INDEX IF NOT EXISTS idx_kb_cat ON kb_documents(category)",
  "CREATE TABLE IF NOT EXISTS kb_keywords (id INTEGER PRIMARY KEY AUTOINCREMENT, document_id INTEGER NOT NULL, keyword TEXT NOT NULL, tf REAL, FOREIGN KEY (document_id) REFERENCES kb_documents(id) ON DELETE CASCADE)",
  "CREATE INDEX IF NOT EXISTS idx_kw_keyword ON kb_keywords(keyword)",
  "CREATE INDEX IF NOT EXISTS idx_kw_doc ON kb_keywords(document_id)",
  "CREATE TABLE IF NOT EXISTS llm_memory (id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id TEXT, student_id TEXT, memory_type TEXT, content TEXT NOT NULL, importance INTEGER DEFAULT 5, source TEXT, created_at TEXT DEFAULT (datetime('now')), expires_at TEXT, FOREIGN KEY (student_id) REFERENCES students(id))",
  "CREATE INDEX IF NOT EXISTS idx_mem_agent ON llm_memory(agent_id)",
  "CREATE INDEX IF NOT EXISTS idx_mem_student ON llm_memory(student_id)",
  "CREATE TABLE IF NOT EXISTS calendar_events (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, date TEXT NOT NULL, type TEXT, student_id TEXT, description TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (student_id) REFERENCES students(id))",
  "CREATE INDEX IF NOT EXISTS idx_cal_date ON calendar_events(date)",
  "CREATE TABLE IF NOT EXISTS submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, title TEXT, journal TEXT, status TEXT, submitted_at TEXT, updated_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (student_id) REFERENCES students(id))",
  "CREATE INDEX IF NOT EXISTS idx_sub_student ON submissions(student_id)",
  "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at TEXT DEFAULT (datetime('now')))"
]

export function initDb() {
  const db = getDb()
  for (const sql of SCHEMA_SQL) {
    db.exec(sql)
  }
  db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)').run(1)
  // Create FTS5 virtual table for full-text search
  try { db.exec('CREATE VIRTUAL TABLE IF NOT EXISTS kb_fts USING fts5(title, content, path, category, tokenize="unicode61")') } catch {}
  return { ok: true, tables: getTableList() }
}

export function getTableList(db) {
  const d = db || getDb()
  const rows = d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
  return rows.map(r => r.name)
}

export function getStats() {
  const db = getDb()
  const tables = getTableList(db)
  const stats = {}
  for (const t of tables) {
    const row = db.prepare('SELECT COUNT(*) as c FROM "' + t + '"').get()
    stats[t] = row.c
  }
  return stats
}

export function transaction(fn) {
  const db = getDb()
  return db.transaction(fn)()
}

export function apply(ctx, config) {
  initDb()
  ctx.db = { getDb, initDb, getStats, transaction, getTableList }
  return ctx.db
}

export default { getDb, initDb, getStats, transaction, getTableList, apply }
