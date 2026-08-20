import http from 'http';

const BASE = 'http://localhost:3001';
let cookie = '';

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const r = http.request(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(cookie ? { Cookie: cookie } : {})
      }
    }, (res) => {
      const sc = res.statusCode;
      const setCookie = res.headers['set-cookie'];
      if (setCookie) cookie = setCookie[0].split(';')[0];
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        resolve({ sc, text, len: text.length });
      });
    });
    r.on('error', reject);
    r.write(data);
    r.end();
  });
}

async function main() {
  console.log('=== 1. Login as teacher ===');
  let r = await req('POST', '/api/login', { role: 'teacher', student_id: 't01', password: 'lab123' });
  console.log('Login:', r.sc, r.text.slice(0, 100));

  console.log('\n=== 2. Test all API endpoints ===');
  const endpoints = [
    ['GET', '/api/me'],
    ['GET', '/api/students'],
    ['GET', '/api/dashboard'],
    ['GET', '/api/tasks'],
    ['GET', '/api/board/stats'],
    ['GET', '/api/news'],
    ['GET', '/api/submissions'],
    ['GET', '/api/kb/list'],
    ['GET', '/api/agent-chat/manager'],
    ['GET', '/api/trajectories/s01'],
    ['GET', '/api/trajectory-stats/s01'],
    ['GET', '/api/valuecycle/s01'],
    ['GET', '/api/email/unread'],
    ['GET', '/api/report/s01'],
    ['GET', '/api/summary/s01'],
    ['GET', '/api/chat/s01'],
    ['GET', '/api/meetings'],
  ];
  for (const [method, path] of endpoints) {
    r = await req(method, path);
    const ok = r.sc === 200;
    const preview = r.text.slice(0, 80).replace(/\n/g, ' ');
    console.log(`${ok ? '✅' : '❌'} ${method} ${path} → ${r.sc} (${r.len}b) ${preview}`);
  }

  console.log('\n=== 3. Test HTML pages ===');
  const pages = ['/login', '/teacher', '/student', '/'];
  for (const path of pages) {
    r = await req('GET', path);
    const hasApp = r.text.includes('id="app"') || r.text.includes('EvoTeam');
    console.log(`${r.sc === 200 && hasApp ? '✅' : '❌'} GET ${path} → ${r.sc} (${r.len}b) app=${hasApp}`);
  }

  console.log('\n=== 4. KB file read ===');
  r = await req('GET', '/api/kb/file?path=students.yaml');
  console.log('KB file:', r.sc, r.text.slice(0, 100));

  console.log('\nDone.');
}

main().catch(e => console.error('Error:', e.message));
