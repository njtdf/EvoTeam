import { readFileSync, writeFileSync } from 'fs'
const s = readFileSync('lib/lab-state.js', 'utf8')
const fixed = s.replace('const { loadStudents } = await import', 'const { loadUsers } = await import').replace('const users = await loadStudents()', 'const users = loadUsers()')
writeFileSync('lib/lab-state.js', fixed)
console.log('OK')
