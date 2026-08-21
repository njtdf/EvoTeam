import { readFileSync, writeFileSync } from 'fs'
const js = readFileSync('public/js/api.js', 'utf8')
const updated = js.replace(/APP_VERSION\s*=\s*['"][^'"]+['"]/, "APP_VERSION = '0.7.10'")
writeFileSync('public/js/api.js', updated, 'utf-8')
for (const f of ['public/teacher.html', 'public/student.html', 'public/index.html', 'public/meeting-live.html']) {
  try {
    let html = readFileSync(f, 'utf8')
    html = html.replace(/\?v=079/g, '?v=0710')
    writeFileSync(f, html, 'utf-8')
    console.log('OK ' + f)
  } catch {}
}
console.log('OK version bumped to 0.7.10')
