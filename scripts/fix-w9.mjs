import { readFileSync, writeFileSync } from 'fs'
const lines = readFileSync('lib/ai-context.js', 'utf-8').split('\n')

// Find the new function's closing brace (the standalone } after writeBack complete)
let newFuncEnd = -1
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === '}' && i > 300 && i < 325) {
    newFuncEnd = i
    break
  }
}
// Find the Convenience comment
let convStart = -1
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// Convenience:')) {
    convStart = i
    break
  }
}

console.log('newFuncEnd=', newFuncEnd, 'convStart=', convStart)

if (newFuncEnd === -1 || convStart === -1) {
  console.error('FATAL: could not find boundaries')
  process.exit(1)
}

// Remove leftover old code between newFuncEnd+1 and convStart-1
const removed = lines.splice(newFuncEnd + 1, convStart - newFuncEnd - 1)
console.log('Removed', removed.length, 'leftover lines')
writeFileSync('lib/ai-context.js', lines.join('\n'), 'utf-8')
console.log('OK: cleaned up')
