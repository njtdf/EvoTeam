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
  console.log('Login:', loginResp.status)

  // Call agent report-review (SSE)
  console.log('Calling /api/agent/report-review...')
  const resp = await fetch(BASE + '/api/agent/report-review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieStr },
    body: JSON.stringify({ student_id: 's01' })
  })
  console.log('Response status:', resp.status)

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let fullText = ''
  let toolCalls = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      try {
        const data = JSON.parse(line.slice(5).trim())
        if (data.chunk) { fullText += data.chunk; process.stdout.write(data.chunk) }
        if (data.tool) { toolCalls.push(data.tool); console.log('\n[TOOL]:', data.tool) }
        if (data.done) console.log('\n[DONE]')
        if (data.error) console.log('\n[ERROR]:', data.error)
      } catch {}
    }
  }
  console.log('\n=== RESULT ===')
  console.log('Tools:', toolCalls.length, toolCalls)
  console.log('Review length:', fullText.length)
}
test().catch(e => console.error('ERROR:', e.message))
