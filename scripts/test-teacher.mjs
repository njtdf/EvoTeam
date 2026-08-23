const BASE = 'http://localhost:3001'
async function test() {
  // Login as teacher
  const loginResp = await fetch(BASE + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'teacher', student_id: 't01', password: 'lab123' })
  })
  const cookie = loginResp.headers.get('set-cookie')
  const cookieStr = cookie ? cookie.split(';')[0] : ''
  console.log('1. Teacher login:', loginResp.status)

  // Get dashboard
  const dash = await fetch(BASE + '/api/dashboard', { headers: { Cookie: cookieStr } })
  const dashData = await dash.json()
  console.log('2. dashboard:', dash.status, 'students:', dashData.students?.length, 'stats:', JSON.stringify(dashData.stats))
  if (dashData.students?.length > 0) {
    const s = dashData.students[0]
    console.log('   first student:', s.student_id || s.id, s.name, 'reported:', s.report_submitted, 'risk_tags:', s.risk_tags?.length, 'last_summary:', s.last_summary?.substring(0, 50))
  }

  // Get students list
  const studs = await fetch(BASE + '/api/students', { headers: { Cookie: cookieStr } })
  const studsData = await studs.json()
  console.log('3. students list:', studs.status, 'count:', studsData.students?.length)

  // Get report for s01
  const rep = await fetch(BASE + '/api/report/s01', { headers: { Cookie: cookieStr } })
  const repData = await rep.json()
  console.log('4. report s01:', rep.status, repData.report ? 'HAS REPORT' : 'NO REPORT')

  // Get summary for s01
  const sum = await fetch(BASE + '/api/summary/s01', { headers: { Cookie: cookieStr } })
  const sumData = await sum.json()
  console.log('5. summary s01:', sum.status, sumData.summary?.summary?.substring(0, 60))

  // Get chat for s01
  const chat = await fetch(BASE + '/api/chat/s01', { headers: { Cookie: cookieStr } })
  const chatData = await chat.json()
  console.log('6. chat s01:', chat.status, 'messages:', chatData.messages?.length)

  // Get report-context for s01
  const ctx = await fetch(BASE + '/api/report-context/s01', { headers: { Cookie: cookieStr } })
  const ctxData = await ctx.json()
  console.log('7. report-context s01:', ctx.status, 'tasks:', ctxData.open_tasks?.length, 'actions:', ctxData.meeting_actions?.length)
}
test().catch(e => console.error('ERROR:', e.message))
