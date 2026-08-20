import fs from 'fs';
let c = fs.readFileSync('server.js', 'utf8');

// 1. GET chat: requireRole('teacher') -> requireAuth + student own ID
c = c.replace(
  "app.get('/api/chat/:id', requireRole('teacher'), (req, res) => {\n  const history = loadChat(req.params.id)",
  "app.get('/api/chat/:id', requireAuth, (req, res) => {\n  const chatId = req.user.role === 'teacher' ? req.params.id : req.user.id\n  const history = loadChat(chatId)"
);

// 2. POST chat: requireRole('teacher') -> requireAuth + student own ID
c = c.replace(
  "app.post('/api/chat/:id', requireRole('teacher'), (req, res) => {\n  const studentId = req.params.id",
  "app.post('/api/chat/:id', requireAuth, (req, res) => {\n  const studentId = req.user.role === 'teacher' ? req.params.id : req.user.id"
);

fs.writeFileSync('server.js', c);
console.log('Chat routes opened for students');
