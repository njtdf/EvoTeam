import { readFileSync, writeFileSync } from 'fs'
const js = readFileSync('public/js/api.js', 'utf8')
const updated = js.replace(/APP_VERSION\s*=\s*['"][^'"]+['"]/, "APP_VERSION = '0.7.9'")
writeFileSync('public/js/api.js', updated)
console.log('OK api.js version')
