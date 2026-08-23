import { readFileSync } from 'fs'

const R = 'D:/OneDrive/7-SideWork/AutoProf/EvoTeam'
const th = readFileSync(`${R}/public/teacher.html`, 'utf-8').split('\n')
const sj = readFileSync(`${R}/public/js/student.js`, 'utf-8')
const tj = readFileSync(`${R}/public/js/teacher.js`, 'utf-8')
const sv = readFileSync(`${R}/server.js`, 'utf-8')

// Find teacher kanban section
console.log('=== teacher.html kanban section ===')
for (let i = 0; i < th.length; i++) {
  if (th[i].includes("activeTab==='kanban'") && th[i].includes('v-if')) {
    for (let j = i; j < Math.min(i + 60, th.length); j++) {
      console.log(`${j+1}: ${th[j].trim().slice(0,110)}`)
    }
    break
  }
}

// student.js kanban functions
console.log('\n=== student.js kanban functions ===')
const sjLines = sj.split('\n')
sjLines.forEach((l, i) => {
  if (l.includes('kanban') || l.includes('Kanban') || l.includes('loadTasks') || l.includes('updateTask') || l.includes('myTasks') || l.includes('isOverdue') || l.includes('switchToKanban')) {
    console.log(`${i+1}: ${l.trim().slice(0,110)}`)
  }
})

// teacher.js kanban functions
console.log('\n=== teacher.js kanban functions ===')
const tjLines = tj.split('\n')
tjLines.forEach((l, i) => {
  if (l.includes('kanban') || l.includes('Kanban') || l.includes('loadTasks') || l.includes('updateTask') || l.includes('createTask') || l.includes('deleteTask') || l.includes('switchToKanban') || l.includes('boardStats') || l.includes('from-meeting') || l.includes('promoteMeeting')) {
    console.log(`${i+1}: ${l.trim().slice(0,110)}`)
  }
})

// server.js task endpoints
console.log('\n=== server.js task endpoints ===')
const svLines = sv.split('\n')
svLines.forEach((l, i) => {
  if ((l.includes('/api/tasks') || l.includes('/api/board') || l.includes('from-meeting')) && (l.includes('app.') )) {
    console.log(`${i+1}: ${l.trim().slice(0,110)}`)
  }
})
svLines.forEach((l, i) => {
  if (l.includes('/api/tasks') && l.includes('app.')) {
    console.log(`${i+1}: ${l.trim().slice(0,120)}`)
  }
})
