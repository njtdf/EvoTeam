import { readFileSync, writeFileSync, readdirSync } from 'fs'

const R = 'D:/OneDrive/7-SideWork/AutoProf/EvoTeam'
const PARENT = 'D:/OneDrive/7-SideWork/AutoProf'
const OLD = '0.7.19'
const NEW = '0.7.20'
const OLD_V = '0719'
const NEW_V = '0720'

// VERSION file
writeFileSync(`${PARENT}/VERSION`, NEW + '\n')
console.log('VERSION:', NEW)

// api.js APP_VERSION
let api = readFileSync(`${R}/public/js/api.js`, 'utf-8')
api = api.replace(`APP_VERSION = '${OLD}'`, `APP_VERSION = '${NEW}'`)
api = api.replace(`APP_VERSION = "${OLD}"`, `APP_VERSION = "${NEW}"`)
writeFileSync(`${R}/public/js/api.js`, api, 'utf-8')
console.log('api.js: APP_VERSION =', NEW)

// All HTML files: ?v=0719 -> ?v=0720
const htmlFiles = readdirSync(`${R}/public`).filter(f => f.endsWith('.html'))
for (const f of htmlFiles) {
  const p = `${R}/public/${f}`
  let t = readFileSync(p, 'utf-8')
  const before = (t.match(new RegExp(OLD_V, 'g')) || []).length
  t = t.split(OLD_V).join(NEW_V)
  writeFileSync(p, t, 'utf-8')
  console.log(`${f}: ${before} replacements`)
}

console.log('\nVersion bumped to', NEW)
