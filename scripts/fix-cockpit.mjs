import { readFileSync, writeFileSync } from 'fs'
const s = readFileSync('server.js', 'utf8')
const fixed = s
  .replace("const { getBoardStats } = await import('kanban.js')", "const { getBoardStats } = await import('./lib/kanban.js')")
  .replace("const { getAllAlignments } = await import('./lib/valuecycle.js')", "const { getAllAlignments } = await import('./lib/valuecycle.js')") // already correct
writeFileSync('server.js', fixed, 'utf-8')
console.log('OK fixed cockpit import')
