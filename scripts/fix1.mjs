import { readFileSync, writeFileSync } from 'fs'
const s = readFileSync('server.js', 'utf8')

// Fix: remove dynamic import, use already-imported loadTasks
const old = `app.get('/api/tasks/:id/transitions', requireAuth, (req, res) => {
  const { loadTasks } = await import('./lib/kanban.js')
  const data = loadTasks()`

const fixed = `app.get('/api/tasks/:id/transitions', requireAuth, (req, res) => {
  const data = loadTasks()`

if (!s.includes(old)) { console.error('NOT FOUND'); process.exit(1) }
writeFileSync('server.js', s.replace(old, fixed))
console.log('OK fixed')
