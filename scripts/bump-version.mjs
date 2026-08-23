import { readFileSync, writeFileSync } from 'fs'

const base = 'D:/OneDrive/7-SideWork/AutoProf/EvoTeam'
const oldV = '0.7.30'
const newV = '0.7.31'
const oldQ = '07.30'
const newQ = '07.31'

// 1. VERSION file (in parent dir)
writeFileSync('D:/OneDrive/7-SideWork/AutoProf/VERSION', newV + '\n', 'utf8')
console.log('1. VERSION file updated')

// 2. api.js APP_VERSION
const apiJs = readFileSync(base + '/public/js/api.js', 'utf8')
writeFileSync(base + '/public/js/api.js', apiJs.replace(`const APP_VERSION = '${oldV}'`, `const APP_VERSION = '${newV}'`), 'utf8')
console.log('2. api.js APP_VERSION updated')

// 3. teacher.html cache-bust
const th = readFileSync(base + '/public/teacher.html', 'utf8')
writeFileSync(base + '/public/teacher.html', th.replaceAll(`?v=${oldQ}`, `?v=${newQ}`), 'utf8')
console.log('3. teacher.html cache-bust updated')

// 4. student.html cache-bust
const sh = readFileSync(base + '/public/student.html', 'utf8')
writeFileSync(base + '/public/student.html', sh.replaceAll(`?v=${oldQ}`, `?v=${newQ}`), 'utf8')
console.log('4. student.html cache-bust updated')

// 5. server.js VERSION constant
const srv = readFileSync(base + '/server.js', 'utf8')
const updated = srv.replace(/const VERSION = ['"]0\.7\.30['"]/, `const VERSION = '${newV}'`)
if (updated !== srv) {
  writeFileSync(base + '/server.js', updated, 'utf8')
  console.log('5. server.js VERSION updated')
} else {
  console.log('5. server.js VERSION pattern not found - checking...')
  const idx = srv.indexOf('VERSION')
  console.log('   context:', srv.substring(idx, idx + 80))
}

console.log('Version bump complete: ' + oldV + ' -> ' + newV)
