import { readFileSync } from 'fs'

const js = readFileSync('public/js/teacher.js', 'utf8')
const html = readFileSync('public/teacher.html', 'utf8')

const retMatch = js.match(/return\s*\{([\s\S]*?)\n\s*\}/)
const exposed = new Set()
if (retMatch) {
  const props = retMatch[1].match(/(\w+)/g)
  props.forEach(p => exposed.add(p))
}

const dashMatch = html.match(/Welcome[\s\S]*?Cockpit/)
if (dashMatch) {
  const dash = dashMatch[0]
  const used = new Set()
  for (const m of dash.matchAll(/\{\{\s*(\w+)/g)) used.add(m[1])
  for (const m of dash.matchAll(/v-if="!?(\w+)/g)) used.add(m[1])
  for (const m of dash.matchAll(/v-for="\w+ in (\w+)/g)) used.add(m[1])
  for (const m of dash.matchAll(/v-model="(\w+)/g)) used.add(m[1])
  for (const m of dash.matchAll(/@click="(\w+)/g)) used.add(m[1])

  const known = new Set(['true','false','null','undefined','Math','status','priority','owner_name','title','name','icon','role','shortName','description','color','gradient','time','text','path','task_id','content'])
  const missing = [...used].filter(u => !exposed.has(u) && !known.has(u))
  if (missing.length === 0) {
    console.log('OK: All dashboard refs exposed')
  } else {
    console.log('MISSING:', missing.join(', '))
  }
  console.log('Used:', [...used].sort().join(', '))
}
