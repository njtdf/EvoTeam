// Cross-reference teacher.html template bindings against teacher.js return statement
import { readFileSync } from 'fs'

const html = readFileSync('public/teacher.html', 'utf-8')
const js = readFileSync('public/js/teacher.js', 'utf-8')

// Extract return block
const returnMatch = js.match(/return\s*\{([\s\S]*?)\n\s*\},?\s*\n/)?.[0] || ''

// Collect all identifiers from return (split by comma/whitespace, strip comments)
const returned = new Set()
for (const line of returnMatch.split('\n')) {
  const cleaned = line.replace(/\/\/.*$/, '').trim()
  for (const part of cleaned.split(/[,\s]+/)) {
    if (part && !part.startsWith('//') && part !== 'return' && part !== '{' && part !== '}' && !part.includes('(')) {
      returned.add(part)
    }
  }
}

// Extract all identifiers used in v-model, @click, v-if, v-for, :prop, {{ }} from HTML
const used = new Set()
const patterns = [
  /v-model(?:\.\w+)?="(\w+)/g,
  /v-model="(\w+)/g,
  /@click="(\w+)/g,
  /@change="(\w+)/g,
  /@keydown[^=]*="(\w+)/g,
  /v-if="(\w+)/g,
  /v-else-if="(\w+)/g,
  /v-for="(?:\w+|[\w,\s]+)\s+in\s+(\w+)/g,
  /:disabled="(\w+)/g,
  /:class="(\w+)/g,
  /:style="(\w+)/g,
  /:checked="(\w+)/g,
  /:key="(\w+)/g,
  /\{\{\s*(\w+)/g,
  /ref="(\w+)/g,
]

for (const pattern of patterns) {
  let m
  while ((m = pattern.exec(html)) !== null) {
    used.add(m[1])
  }
}

// Find used but not returned
const missing = []
for (const name of used) {
  // Skip JS builtins and literals
  if (['true','false','null','undefined','window','String'].includes(name)) continue
  // Check if declared as ref/const/function in js (not just returned)
  const declared = new RegExp(`\\b(const|let|function)\\s+${name}\\b`).test(js)
  if (!returned.has(name) && !declared) {
    missing.push(name)
  }
}

if (missing.length === 0) {
  console.log('All template references found in return/declarations')
} else {
  console.log('MISSING references (used in template but not in return or declared):')
  for (const name of missing) {
    // Find line numbers in HTML
    const lines = html.split('\n')
    const hits = []
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(name)) hits.push(i + 1)
    }
    console.log(`  ${name}  (HTML lines: ${hits.join(', ')})`)
  }
}

// Also check: declared but NOT returned (would be invisible to template)
const declaredNotReturned = []
const declPattern = /(?:const|let)\s+(\w+)\s*=\s*(?:ref|computed|reactive)/g
let dm
while ((dm = declPattern.exec(js)) !== null) {
  const name = dm[1]
  if (!returned.has(name)) {
    // Check if it's used in HTML
    if (used.has(name)) {
      declaredNotReturned.push(name)
    }
  }
}

if (declaredNotReturned.length > 0) {
  console.log('\nDECLARED but NOT RETURNED (used in template, will be undefined):')
  for (const name of declaredNotReturned) {
    console.log(`  ${name}`)
  }
}
