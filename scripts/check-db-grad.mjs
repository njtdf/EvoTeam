import { initDb, getDb } from '../lib/db.js'
initDb()
const db = getDb()
const vc = db.prepare('SELECT * FROM value_cycles LIMIT 3').all()
console.log('VC rows:', vc.length)
if (vc.length > 0) console.log('Sample:', JSON.stringify(vc[0]).slice(0, 300))
const kb = db.prepare("SELECT * FROM kb_documents WHERE category = 'graduation' LIMIT 5").all()
console.log('KB graduation docs:', kb.length)
if (kb.length > 0) console.log('Sample KB:', JSON.stringify(kb[0]).slice(0, 200))
