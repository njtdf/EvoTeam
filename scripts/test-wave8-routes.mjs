// Test all Wave 8 routes — login as teacher, then hit each endpoint
const BASE = 'http://localhost:3001'
const cookieJar = {}

async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  if (Object.keys(cookieJar).length) {
    headers['Cookie'] = Object.entries(cookieJar).map(([k,v]) => k + '=' + v).join('; ')
  }
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  // capture cookies
  const sc = res.headers.get('set-cookie')
  if (sc) {
    for (const c of sc.split(',')) {
      const m = c.match(/^([^=]+)=([^;]+)/)
      if (m) cookieJar[m[1]] = m[2]
    }
  }
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = text }
  return { status: res.status, body: json }
}

async function main() {
  console.log('=== 1. Login as teacher (t01/lab123) ===')
  const login = await req('POST', '/api/login', { role: 'teacher', student_id: 't01', password: 'lab123' })
  console.log('Status:', login.status, '| body:', JSON.stringify(login.body).slice(0, 200))

  console.log('\n=== 2. GET /api/db/stats ===')
  const stats = await req('GET', '/api/db/stats')
  console.log('Status:', stats.status)
  if (stats.body && typeof stats.body === 'object') {
    for (const [k, v] of Object.entries(stats.body)) console.log('  ' + k + ':', v)
  } else {
    console.log('  body:', JSON.stringify(stats.body).slice(0, 300))
  }

  console.log('\n=== 3. GET /api/llm-memory/steward ===')
  const mems = await req('GET', '/api/llm-memory/steward')
  console.log('Status:', mems.status, '| count:', Array.isArray(mems.body?.memories) ? mems.body.memories.length : 'N/A')
  if (mems.body?.memories?.length) console.log('  first:', JSON.stringify(mems.body.memories[0]).slice(0, 150))

  console.log('\n=== 4. POST /api/llm-memory/steward (store test memory) ===')
  const stored = await req('POST', '/api/llm-memory/steward', {
    student_id: 's01',
    memory_type: 'decision',
    content: 'Wave8 test: s01 decided to use Benders decomposition for IEEE 33-bus',
    importance: 8,
    source: 'manual'
  })
  console.log('Status:', stored.status, '| body:', JSON.stringify(stored.body).slice(0, 200))

  console.log('\n=== 5. GET /api/llm-memory/steward/search?q=Benders ===')
  const search = await req('GET', '/api/llm-memory/steward/search?q=Benders')
  console.log('Status:', search.status, '| results:', Array.isArray(search.body?.results) ? search.body.results.length : 'N/A')
  if (search.body?.results?.length) console.log('  first:', JSON.stringify(search.body.results[0]).slice(0, 150))

  console.log('\n=== 6. GET /api/kb/search?q=Benders ===')
  const kbSearch = await req('GET', '/api/kb/search?q=Benders')
  console.log('Status:', kbSearch.status, '| results:', Array.isArray(kbSearch.body?.results) ? kbSearch.body.results.length : 'N/A')
  if (kbSearch.body?.results?.length) console.log('  first:', JSON.stringify(kbSearch.body.results[0]).slice(0, 150))

  console.log('\n=== 7. GET /api/kb/stats ===')
  const kbStats = await req('GET', '/api/kb/stats')
  console.log('Status:', kbStats.status, '| body:', JSON.stringify(kbStats.body).slice(0, 300))

  console.log('\n=== 8. GET /api/kb/documents ===')
  const kbDocs = await req('GET', '/api/kb/documents?page=1&per_page=5')
  console.log('Status:', kbDocs.status, '| total:', kbDocs.body?.total, '| returned:', Array.isArray(kbDocs.body?.documents) ? kbDocs.body.documents.length : 'N/A')

  console.log('\n=== 9. GET /api/kb/graph ===')
  const graph = await req('GET', '/api/kb/graph')
  console.log('Status:', graph.status, '| nodes:', Array.isArray(graph.body?.nodes) ? graph.body.nodes.length : 'N/A', '| edges:', Array.isArray(graph.body?.edges) ? graph.body.edges.length : 'N/A')

  console.log('\n=== 10. DELETE /api/llm-memory/:id (cleanup test memory) ===')
  if (stored.body?.id) {
    const del = await req('DELETE', '/api/llm-memory/' + stored.body.id)
    console.log('Status:', del.status, '| body:', JSON.stringify(del.body).slice(0, 150))
  } else {
    console.log('No ID to delete (store may have failed)')
  }

  console.log('\n=== 11. POST /api/db/migrate (idempotent re-run) ===')
  const migrate = await req('POST', '/api/db/migrate')
  console.log('Status:', migrate.status, '| body:', JSON.stringify(migrate.body).slice(0, 300))

  console.log('\n=== TEST COMPLETE ===')
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
