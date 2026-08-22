import { readFileSync } from 'fs'

const R = 'D:/OneDrive/7-SideWork/AutoProf/cordis-main'
const html = readFileSync(`${R}/public/student.html`, 'utf-8')
const js = readFileSync(`${R}/public/js/student.js`, 'utf-8')

// Extract all @click="xxx" and v-model="xxx" references from student.html
const clickRefs = [...html.matchAll(/@click="(\w+)/g)].map(m => m[1])
const uniqueClick = [...new Set(clickRefs)]

console.log('=== @click refs in student.html ===')
for (const ref of uniqueClick) {
  // Check if it's in the return block (roughly: appears as `ref,` or `ref}` near other exports)
  const inReturn = js.includes(`${ref},`) || js.includes(`${ref}}`) || js.includes(`${ref} `)
  console.log(`${inReturn ? 'OK' : 'MISSING'}: ${ref}`)
}

// Extract {{ xxx }} references
const interpRefs = [...html.matchAll(/\{\{\s*(\w+)/g)].map(m => m[1])
const uniqueInterp = [...new Set(interpRefs)]
console.log('\n=== {{ }} refs in student.html ===')
for (const ref of uniqueInterp) {
  if (ref === 'true' || ref === 'false') continue
  const inReturn = js.includes(`${ref},`) || js.includes(`${ref}}`) || js.includes(`${ref} `)
  console.log(`${inReturn ? 'OK' : 'MISSING'}: ${ref}`)
}
