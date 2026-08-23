import { readFileSync } from 'fs'

const R = 'D:/OneDrive/7-SideWork/AutoProf/EvoTeam'
const rd = p => readFileSync(`${R}/${p}`, 'utf-8')

// student.html
const sh = rd('public/student.html')
console.log('report-toolbar:', sh.includes('report-toolbar'))
console.log('history list:', sh.includes('report-history-list'))
console.log('history viewer:', sh.includes('historyViewReport'))
console.log('summary card NOT fixed:', !sh.includes('position:fixed; bottom:0'))
console.log('split-pane conditional:', sh.includes('historyViewReport') && sh.includes('showHistory'))

// server.js
const sv = rd('server.js')
console.log('reports endpoint:', sv.includes("/api/reports/:id"))
console.log('file query support:', sv.includes('req.query.file'))

// teacher.html
const th = rd('public/teacher.html')
console.log('no dup AI Summary:', !th.includes('>AI Summary<'))

// app.css
const cs = rd('public/css/app.css')
console.log('student-select #fff:', cs.includes('background: #fff'))
console.log('report-toolbar css:', cs.includes('.report-toolbar'))
console.log('report-history css:', cs.includes('.report-history-item'))
