import { readFileSync, writeFileSync } from 'fs'
const s = readFileSync('server.js', 'utf8')
const old = `import {
  createTask, updateTask, deleteTask, getAllTasks, getTasksByStudent,
  getBoardStats, promoteMeetingAction,
} from './lib/kanban.js'`
const fixed = `import {
  loadTasks, createTask, updateTask, deleteTask, getAllTasks, getTasksByStudent,
  getBoardStats, promoteMeetingAction,
} from './lib/kanban.js'`
if (!s.includes(old)) { console.error('NOT FOUND'); process.exit(1) }
writeFileSync('server.js', s.replace(old, fixed))
console.log('OK loadTasks added to import')
