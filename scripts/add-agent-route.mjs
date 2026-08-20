import fs from 'fs';

// 1. Add /api/agents/save route to server.js
let srv = fs.readFileSync('server.js', 'utf8');

// Check if route already exists
if (!srv.includes('/api/agents/save')) {
  // Insert before the KB list route
  const insertPoint = srv.indexOf("app.get('/api/kb/list'");
  if (insertPoint < 0) {
    console.log('ERROR: could not find KB list route');
    process.exit(1);
  }
  const newRoute = `// --- API: Agent Management --- //
app.post('/api/agents/save', requireRole('teacher'), (req, res) => {
  try {
    const agents = req.body;
    if (!Array.isArray(agents)) return res.status(400).json({ error: 'Expected array' });
    fs.writeFileSync(join(__dirname, 'labos', 'agents-custom.json'), JSON.stringify(agents, null, 2));
    res.json({ ok: true, count: agents.length });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/agents/custom', requireAuth, (req, res) => {
  try {
    const p = join(__dirname, 'labos', 'agents-custom.json');
    if (!fs.existsSync(p)) return res.json({ agents: [] });
    res.json({ agents: JSON.parse(fs.readFileSync(p, 'utf8')) });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

`;
  srv = srv.slice(0, insertPoint) + newRoute + srv.slice(insertPoint);
  fs.writeFileSync('server.js', srv, 'utf8');
  console.log('server.js: added agents save/load routes');
} else {
  console.log('server.js: agents save route already exists');
}

// 2. Update cache-busting version 071 -> 072
let html = fs.readFileSync('public/teacher.html', 'utf8');
html = html.replace(/\?v=071/g, '?v=072');
fs.writeFileSync('public/teacher.html', html, 'utf8');
console.log('teacher.html: version 071 -> 072');

html = fs.readFileSync('public/student.html', 'utf8');
html = html.replace(/\?v=071/g, '?v=072');
fs.writeFileSync('public/student.html', html, 'utf8');
console.log('student.html: version 071 -> 072');

html = fs.readFileSync('public/index.html', 'utf8');
html = html.replace(/\?v=071/g, '?v=072');
fs.writeFileSync('public/index.html', html, 'utf8');
console.log('index.html: version 071 -> 072');

// 3. Update api.js version
let apiJs = fs.readFileSync('public/js/api.js', 'utf8');
apiJs = apiJs.replace(/0\.7\.0/g, '0.7.2');
fs.writeFileSync('public/js/api.js', apiJs, 'utf8');
console.log('api.js: version 0.7.0 -> 0.7.2');

console.log('Done!');
