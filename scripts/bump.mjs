import { readFileSync, writeFileSync } from 'fs'
const base = 'D:/OneDrive/7-SideWork/AutoProf/EvoTeam'
const oldV = '0.7.31'
const newV = '0.7.32'
const oldQ = '07.31'
const newQ = '07.32'

writeFileSync('D:/OneDrive/7-SideWork/AutoProf/VERSION', newV + '\n', 'utf8')
const apiJs = readFileSync(base + '/public/js/api.js', 'utf8')
writeFileSync(base + '/public/js/api.js', apiJs.replace("const APP_VERSION = '" + oldV + "'", "const APP_VERSION = '" + newV + "'"), 'utf8')
const th = readFileSync(base + '/public/teacher.html', 'utf8')
writeFileSync(base + '/public/teacher.html', th.replaceAll('?v=' + oldQ, '?v=' + newQ), 'utf8')
const sh = readFileSync(base + '/public/student.html', 'utf8')
writeFileSync(base + '/public/student.html', sh.replaceAll('?v=' + oldQ, '?v=' + newQ), 'utf8')
console.log('Version bumped to ' + newV)
