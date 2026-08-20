const BASE = 'http://localhost:3001'
let cookies = ''

async function api(path, method='GET', body=null) {
  const opts = { method, headers: { Cookie: cookies } }
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body) }
  const r = await fetch(BASE+path, opts)
  if (r.headers.get('set-cookie')) cookies = r.headers.get('set-cookie').split(';')[0]
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}`)
  return r.json()
}

const tests = []
function check(name, cond, detail='') {
  tests.push({ name, pass: !!cond, detail })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${detail}`)
}

async function main() {
  // 1. Login as teacher
  await api('/api/login', 'POST', { role: 'teacher', student_id: 't01', password: 'lab123' })
  check('teacher login', true)

  // 2. KB stats
  const stats = await api('/api/kb/stats')
  check('KB stats', stats.total_docs > 0, `(${stats.total_docs} docs, ${stats.total_keywords} keywords)`)

  // 3. KB FTS5 search - Benders
  const r1 = await api('/api/kb/search?q=Benders&limit=5')
  check('KB FTS5 search Benders', r1.results.length > 0, `(${r1.results.length} results, score=${r1.results[0]?.score})`)

  // 4. KB FTS5 search - V2G
  const r2 = await api('/api/kb/search?q=V2G&limit=5')
  check('KB FTS5 search V2G', r2.results.length > 0, `(${r2.results.length} results)`)

  // 5. KB FTS5 search - Chinese: 韧性
  const r3 = await api('/api/kb/search?q=' + encodeURIComponent('韧性') + '&limit=5')
  check('KB FTS5 search 韧性', r3.results.length > 0, `(${r3.results.length} results, score=${r3.results[0]?.score})`)

  // 6. KB rebuild index (populates FTS5)
  const rb = await api('/api/kb/index', 'POST')
  const rbDocs = rb.indexed ? rb.indexed.docs : rb.docs
  const rbKw = rb.indexed ? rb.indexed.keywords : rb.keywords
  check('KB rebuild index', rbDocs > 0, `(${rbDocs} docs, ${rbKw} keywords)`)

  // 7. Dashboard data
  const dash = await api('/api/dashboard')
  check('Dashboard returns students', dash.students && dash.students.length > 0, `(${dash.students.length} students)`)
  check('Dashboard stats', !!dash.stats, `(${JSON.stringify(dash.stats)})`)

  // 8. Tasks (today's tasks source)
  const tasks = await api('/api/tasks?status=todo,in_progress')
  check('Tasks API', Array.isArray(tasks.tasks), `(${tasks.tasks.length} tasks)`)

  // 9. DB stats
  const dbStats = await api('/api/db/stats')
  check('DB stats', dbStats.students > 0, `(students=${dbStats.students}, docs=${dbStats.kb_documents}, tasks=${dbStats.tasks})`)

  // 10. LLM memory
  const mem = await api('/api/llm-memory/steward')
  check('LLM memory API', Array.isArray(mem.memories) || Array.isArray(mem), `(${JSON.stringify(mem).slice(0,80)})`)

  // 11. KB graph
  const graph = await api('/api/kb/graph')
  check('KB graph', graph.nodes && graph.nodes.length > 0, `(${graph.nodes.length} nodes, ${graph.edges.length} edges)`)

  // 12. Student login + KB search
  cookies = ''
  await api('/api/login', 'POST', { role: 'grad', student_id: 's01', password: 'changeme' })
  const sr = await api('/api/kb/search?q=V2G&limit=3')
  check('Student KB search', sr.results.length > 0, `(${sr.results.length} results)`)

  // Summary
  const passed = tests.filter(t => t.pass).length
  const failed = tests.filter(t => !t.pass).length
  console.log(`\n=== ${passed}/${tests.length} PASS, ${failed} FAIL ===`)
  if (failed > 0) {
    console.log('Failed:')
    tests.filter(t => !t.pass).forEach(t => console.log(`  - ${t.name}: ${t.detail}`))
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
