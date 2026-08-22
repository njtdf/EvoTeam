import { readFileSync, writeFileSync } from 'fs'

const R = 'D:/OneDrive/7-SideWork/AutoProf/cordis-main'
const rd = p => readFileSync(`${R}/${p}`, 'utf-8')
const wr = (p, t) => writeFileSync(`${R}/${p}`, t, 'utf-8')

function rep(text, find, repl) {
  if (!text.includes(find)) { console.log(`  WARN not found: ${find.slice(0,60)}`); return text }
  return text.replace(find, repl)
}

// ============================================================
// 1. student.js — Add formatHistoryReport function + export
// ============================================================
function patchStudentJs2() {
  let t = rd('public/js/student.js')

  // Add formatHistoryReport after formatMessage
  t = rep(t,
    "    function formatMessage(content) {\n      if (!content) return ''\n      try { return marked.parse(content) } catch { return content }\n    }",
    "    function formatMessage(content) {\n      if (!content) return ''\n      try { return marked.parse(content) } catch { return content }\n    }\n\n    function formatHistoryReport() {\n      if (!historyViewReport.value || !historyViewReport.value.raw) return ''\n      try { return marked.parse(historyViewReport.value.raw) } catch { return historyViewReport.value.raw }\n    }"
  )

  // Add formatHistoryReport to return block (near formatMessage)
  t = rep(t,
    'updatePreview, loadTemplate, clearEditor, doSubmit, logout,',
    'updatePreview, loadTemplate, clearEditor, doSubmit, logout,\n    formatHistoryReport,'
  )

  wr('public/js/student.js', t)
  console.log('OK student.js (formatHistoryReport)')
}

// ============================================================
// 2. server.js — Support ?file= query param in /api/report/:id
// ============================================================
function patchServer2() {
  let t = rd('server.js')

  // Replace the report endpoint to support ?file= query
  const old = `app.get('/api/report/:id', requireAuth, (req, res) => {
  const config = loadConfig()
  const filePath = getLatestReport(config, req.params.id)
  if (!filePath) return res.status(404).json({ error: 'No report found' })
  const report = parseReport(filePath)
  res.json({ report })
})`

  const neu = `app.get('/api/report/:id', requireAuth, (req, res) => {
  const config = loadConfig()
  let filePath = null
  if (req.query.file) {
    // Load specific report file by filename
    const reportsDir = join(__dirname, config.reports_dir)
    const candidate = join(reportsDir, req.params.id, req.query.file)
    if (existsSync(candidate)) filePath = candidate
  }
  if (!filePath) filePath = getLatestReport(config, req.params.id)
  if (!filePath) return res.status(404).json({ error: 'No report found' })
  const report = parseReport(filePath)
  res.json({ report })
})`

  t = rep(t, old, neu)
  wr('server.js', t)
  console.log('OK server.js (?file= support)')
}

patchStudentJs2()
patchServer2()
console.log('\nDone.')
