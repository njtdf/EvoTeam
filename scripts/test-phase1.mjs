import { readFileSync, writeFileSync } from 'fs'

// Test student weekly report flow
const BASE = 'http://localhost:3001'

async function test() {
  // Login as s01
  const loginResp = await fetch(BASE + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'student', student_id: 's01', password: 'changeme' })
  })
  const cookie = loginResp.headers.get('set-cookie')
  const cookieStr = cookie ? cookie.split(';')[0] : ''
  console.log('1. Login:', loginResp.status, cookieStr ? 'OK' : 'NO COOKIE')

  // Get user info
  const me = await fetch(BASE + '/api/me', { headers: { Cookie: cookieStr } })
  const meData = await me.json()
  console.log('2. /api/me:', me.status, meData.id, meData.name, meData.role)

  // Get report-context
  const ctx = await fetch(BASE + '/api/report-context/s01', { headers: { Cookie: cookieStr } })
  const ctxData = await ctx.json()
  console.log('3. report-context:', ctx.status, 'open_tasks:', ctxData.open_tasks?.length, 'done_tasks:', ctxData.done_tasks?.length, 'meeting_actions:', ctxData.meeting_actions?.length)

  // Get reports list
  const reps = await fetch(BASE + '/api/reports/s01', { headers: { Cookie: cookieStr } })
  const repsData = await reps.json()
  console.log('4. reports list:', reps.status, 'count:', repsData.reports?.length)

  // Get latest report
  const rep = await fetch(BASE + '/api/report/s01', { headers: { Cookie: cookieStr } })
  const repData = await rep.json()
  console.log('5. latest report:', rep.status, repData.report ? 'HAS REPORT' : 'NO REPORT')

  // Get summary
  const sum = await fetch(BASE + '/api/summary/s01', { headers: { Cookie: cookieStr } })
  const sumData = await sum.json()
  console.log('6. summary:', sum.status, sumData.summary ? sumData.summary.summary?.substring(0, 60) : 'NO SUMMARY')

  // Get chat history
  const chat = await fetch(BASE + '/api/chat/s01', { headers: { Cookie: cookieStr } })
  const chatData = await chat.json()
  console.log('7. chat history:', chat.status, 'messages:', chatData.messages?.length)

  // Get draft (progress)
  const draft = await fetch(BASE + '/api/progress/s01/draft', { headers: { Cookie: cookieStr } })
  const draftData = await draft.json()
  console.log('8. draft:', draft.status, 'source:', draftData.source, 'excerpts:', draftData.excerpts_found, 'draft_len:', draftData.draft?.length)
}

test().catch(e => console.error('ERROR:', e.message))
