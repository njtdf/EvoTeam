const BASE = 'http://localhost:3001'
async function test() {
  // Login as student s01
  const loginResp = await fetch(BASE + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'student', student_id: 's01', password: 'changeme' })
  })
  const cookie = loginResp.headers.get('set-cookie')
  const cookieStr = cookie ? cookie.split(';')[0] : ''
  console.log('Login:', loginResp.status)

  // Call agent report-draft (SSE)
  console.log('Calling /api/agent/report-draft...')
  const resp = await fetch(BASE + '/api/agent/report-draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieStr },
    body: JSON.stringify({})
  })
  console.log('Response status:', resp.status)
  console.log('Content-Type:', resp.headers.get('content-type'))

  // Read SSE stream
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
        if (data.chunk) {
          fullText += data.chunk
          process.stdout.write(data.chunk)
        }
        if (data.tool) {
          toolCalls.push(data.tool)
          console.log('\n[TOOL CALL]:', data.tool, data.args ? JSON.stringify(data.args) : '')
        }
        if (data.done) {
          console.log('\n[DONE]')
        }
        if (data.error) {
          console.log('\n[ERROR]:', data.error)
        }
      } catch {}
    }
  }
  console.log('\n=== RESULT ===')
  console.log('Tool calls made:', toolCalls.length, toolCalls)
  console.log('Draft length:', fullText.length, 'chars')
  console.log('First 200 chars:', fullText.substring(0, 200))
}
test().catch(e => console.error('ERROR:', e.message))
