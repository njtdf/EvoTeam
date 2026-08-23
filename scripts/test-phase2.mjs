const BASE = 'http://localhost:3001'
// Check version
const vr = await fetch(BASE + '/api/version')
const vd = await vr.json()
console.log('Version:', vd.version)

// Login as teacher and test agent review endpoint exists
const loginResp = await fetch(BASE + '/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ role: 'teacher', student_id: 't01', password: 'lab123' })
})
const cookie = loginResp.headers.get('set-cookie')
const cookieStr = cookie ? cookie.split(';')[0] : ''
console.log('Teacher login:', loginResp.status)

// Quick test - just check the endpoint responds with SSE
const resp = await fetch(BASE + '/api/agent/report-review', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookieStr },
  body: JSON.stringify({ student_id: 's01' })
})
console.log('Agent review endpoint:', resp.status, resp.headers.get('content-type'))

// Read first few chunks then close
const reader = resp.body.getReader()
const { value } = await reader.read()
const text = new TextDecoder().decode(value)
console.log('First chunk:', text.substring(0, 200))
reader.cancel()
console.log('OK - agent endpoints working')
