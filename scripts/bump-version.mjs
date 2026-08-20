import { readFileSync, writeFileSync } from 'fs'

// Usage: node scripts/bump-version.mjs 0.7.4
// Updates: VERSION file, api.js APP_VERSION, all HTML cache bust params
const version = process.argv[2] || '0.7.4'
const cacheTag = version.replace(/\./g, '').slice(0, 3) // "0.7.4" -> "074"

// 1. VERSION file
writeFileSync('D:/OneDrive/7-SideWork/AutoProf/VERSION', version)
console.log(`VERSION -> ${version}`)

// 2. api.js APP_VERSION
const apiPath = 'public/js/api.js'
let apiSrc = readFileSync(apiPath, 'utf8')
apiSrc = apiSrc.replace(/APP_VERSION\s*=\s*'[^']+'/, `APP_VERSION = '${version}'`)
writeFileSync(apiPath, apiSrc)
console.log(`api.js APP_VERSION -> ${version}`)

// 3. HTML cache bust: ?v=0XX -> ?v=0{cacheTag}
const oldCachePattern = /\?v=\d+/g
const files = ['public/teacher.html', 'public/student.html', 'public/index.html']
for (const f of files) {
  let src = readFileSync(f, 'utf8')
  const before = src.match(oldCachePattern)
  src = src.replace(oldCachePattern, `?v=${cacheTag}`)
  writeFileSync(f, src)
  console.log(`${f}: ${JSON.stringify(before)} -> ?v=${cacheTag}`)
}

console.log(`\nDone. Version ${version}, cache tag ${cacheTag}`)
