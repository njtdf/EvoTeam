const BASE = 'http://localhost:3001'
const loginResp = await fetch(BASE + '/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ role: 'student', student_id: 's01', password: 'changeme' })
})
const cookie = loginResp.headers.get('set-cookie')
const cookieStr = cookie ? cookie.split(';')[0] : ''
console.log('Cookie:', cookieStr)
const me = await fetch(BASE + '/api/me', { headers: { Cookie: cookieStr } })
const meText = await me.text()
console.log('me status:', me.status)
console.log('me body:', meText.substring(0, 300))
