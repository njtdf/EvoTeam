import { readFileSync, writeFileSync } from 'fs'
for (const f of ['public/teacher.html', 'public/student.html', 'public/index.html', 'public/meeting-live.html']) {
  try {
    let html = readFileSync(f, 'utf8')
    html = html.replace(/\?v=078/g, '?v=079')
    writeFileSync(f, html)
    console.log('OK ' + f)
  } catch { console.log('SKIP ' + f) }
}
