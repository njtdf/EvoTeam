import http from 'node:http'

const BASE = process.env.LABOS_URL || 'http://localhost:3001'
const [pid, pw] = ['t01', 'lab123']

function req(method, path, body, cookie) {
  return new Promise((resolve) => {
    const u = new URL(BASE + path)
    const payload = body ? JSON.stringify(body) : null
    const headers = { 'Content-Type': 'application/json' }
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload)
    if (cookie) headers['Cookie'] = cookie
    const r = http.request({ method, hostname: u.hostname, port: u.port, path: u.pathname + u.search, headers }, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => {
        let json = null
        try { json = JSON.parse(data) } catch {}
        resolve({ status: res.statusCode, setCookie: res.headers['set-cookie'], body: data.slice(0, 400), json })
      })
    })
    r.on('error', (e) => resolve({ status: 0, error: e.message }))
    if (payload) r.write(payload)
    r.end()
  })
}

const out = []
const log = (k, v) => out.push(`${k}: ${v}`)

const login = await req('POST', '/api/login', { role: 'teacher', student_id: pid, password: pw })
const cookie = (login.setCookie && login.setCookie[0] || '').split(';')[0]
log('login', `status=${login.status} cookie=${cookie ? 'YES' : 'NO'}`)

if (!cookie) {
  console.log(out.join('\n'))
  console.log('\n[FAIL] 无法登录，服务器未运行或凭据错误')
  process.exit(1)
}

const st = await req('GET', '/api/students', null, cookie)
log('students', `status=${st.status} count=${st.json?.students?.length ?? '?'} first=${st.json?.students?.[0]?.id ?? '?'}`)

const rp = await req('GET', '/api/report/s01', null, cookie)
log('report/s01', `status=${rp.status} hasReport=${!!rp.json?.report} hasMeta=${!!rp.json?.report?.meta} contentLen=${rp.json?.report?.content?.length ?? 0}`)

const sm = await req('GET', '/api/summary/s01', null, cookie)
log('summary/s01', `status=${sm.status} hasSummary=${!!sm.json?.summary} risks=${sm.json?.summary?.risks?.length ?? '?'}`)

const ch = await req('GET', '/api/chat/s01', null, cookie)
log('chat/s01', `status=${ch.status} msgCount=${ch.json?.messages?.length ?? '?'}`)

const db = await req('GET', '/api/dashboard', null, cookie)
log('dashboard', `status=${db.status} students=${db.json?.students?.length ?? '?'} stats=${JSON.stringify(db.json?.stats ?? {})}`)

console.log('===== weekly report core loop backend verify =====')
console.log(out.join('\n'))

const allOk = login.status === 200 && st.status === 200 && rp.status === 200
console.log(`\nverdict: ${allOk ? 'PASS backend ok -> blank root cause is frontend template' : 'FAIL backend broken, see above'}`)
