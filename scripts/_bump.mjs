import { readFileSync, writeFileSync, readdirSync } from 'fs'

const NEW_VER = '0.7.16'
const OLD_VER = '0.7.15'
const OLD_TAG = '0715'
const NEW_TAG = '0716'

// VERSION file
writeFileSync('../VERSION', NEW_VER, 'utf8')
console.log('VERSION ->', NEW_VER)

// api.js
let api = readFileSync('public/js/api.js', 'utf8')
api = api.replace(`APP_VERSION = '${OLD_VER}'`, `APP_VERSION = '${NEW_VER}'`)
writeFileSync('public/js/api.js', api, 'utf8')
console.log('api.js APP_VERSION ->', NEW_VER)

// HTML files
const htmlFiles = readdirSync('public').filter(f => f.endsWith('.html'))
for (const f of htmlFiles) {
  let c = readFileSync('public/' + f, 'utf8')
  c = c.split('v=' + OLD_TAG).join('v=' + NEW_TAG)
  writeFileSync('public/' + f, c, 'utf8')
  console.log(f, 'v=' + OLD_TAG, '->', 'v=' + NEW_TAG)
}
console.log('Done')
