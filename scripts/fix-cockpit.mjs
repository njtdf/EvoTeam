import { readFileSync, writeFileSync } from 'fs'
const f = 'D:/OneDrive/7-SideWork/AutoProf/EvoTeam/public/js/teacher.js'
let c = readFileSync(f, 'utf8')
const old = "async function switchToCockpit() { activeTab.value = 'cockpit'; window.location.hash = 'cockpit'; if (students.value.length === 0) await loadStudents() }"
const neu = `async function switchToCockpit() {
      activeTab.value = 'cockpit'
      window.location.hash = 'cockpit'
      if (students.value.length === 0) await loadStudents()
      if (!dashboardData.value) await loadDashboard()
    }`
if (c.includes(old)) {
  c = c.replace(old, neu)
  writeFileSync(f, c, 'utf8')
  console.log('FIXED switchToCockpit - now loads dashboardData')
} else {
  console.log('OLD NOT FOUND')
  const idx = c.indexOf('switchToCockpit')
  console.log('context:', c.substring(idx, idx + 300))
}
