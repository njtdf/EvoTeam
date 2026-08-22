import { readFileSync, writeFileSync } from 'fs'

const fixes = []

// === FIX 1: teacher.js - move courseData inside return block ===
{
  let t = readFileSync('public/js/teacher.js', 'utf8')
  const idx = t.indexOf('courseData, courseLoading, courseSubTab, switchToCourse, updateCourseWeek')
  if (idx < 0) {
    fixes.push('1. teacher.js: courseData line not found (already fixed?)')
  } else {
    const before = t.slice(0, idx)
    const after = t.slice(idx)
    // Remove the courseData line from its current position
    const afterClean = after.replace(/      courseData, courseLoading, courseSubTab, switchToCourse, updateCourseWeek,\n/, '')
    // Find the last "    }" before the courseData position (this closes the return block)
    const closeBraceIdx = before.lastIndexOf('    }')
    if (closeBraceIdx >= 0) {
      const newContent = before.slice(0, closeBraceIdx) +
        '      // 课程\n      courseData, courseLoading, courseSubTab, switchToCourse, updateCourseWeek,\n' +
        before.slice(closeBraceIdx) + afterClean
      writeFileSync('public/js/teacher.js', newContent, 'utf8')
      fixes.push('1. teacher.js: moved courseData inside return block')
    } else {
      fixes.push('1. teacher.js: could not find closing brace')
    }
  }
}

// === FIX 2: student.html - add calendar content section ===
{
  let s = readFileSync('public/student.html', 'utf8')
  if (s.includes('calendarDays')) {
    fixes.push('2. student.html: calendar already exists')
  } else {
    const idx = s.indexOf('myTasksByStatus')
    if (idx >= 0) {
      // Find the start of the kanban div section
      const kanbanDiv = s.lastIndexOf('v-if="activeTab', idx)
      if (kanbanDiv >= 0) {
        const insertPoint = s.lastIndexOf('\n', kanbanDiv)
        const calendarSection = '  <!-- \u65e5\u5386 Tab -->\n' +
          '  <div v-if="activeTab===\'calendar\'" class="calendar-view">\n' +
          '    <div class="calendar-header">\n' +
          '      <button class="btn btn-secondary btn-sm" @click="prevMonth">\u2190</button>\n' +
          '      <span class="calendar-title">{{ calendarLabel }}</span>\n' +
          '      <button class="btn btn-secondary btn-sm" @click="nextMonth">\u2192</button>\n' +
          '    </div>\n' +
          '    <div class="calendar-grid">\n' +
          '      <div class="calendar-weekday" v-for="d in calendarWeekdays" :key="d">{{ d }}</div>\n' +
          '      <div class="calendar-day" v-for="(day, i) in calendarDays" :key="i" :class="{today: day.isToday, other: !day.inMonth}">\n' +
          '        <div class="calendar-day-num">{{ day.num }}</div>\n' +
          '        <div class="calendar-event" v-for="e in day.events" :key="e.id" :class="\'event-\' + e.type" :title="e.title">{{ e.title }}</div>\n' +
          '      </div>\n' +
          '    </div>\n' +
          '  </div>\n\n  '
        s = s.slice(0, insertPoint) + calendarSection + s.slice(insertPoint)
        writeFileSync('public/student.html', s, 'utf8')
        fixes.push('2. student.html: added calendar content section')
      } else {
        fixes.push('2. student.html: could not find kanban div start')
      }
    } else {
      fixes.push('2. student.html: myTasksByStatus not found')
    }
  }
}

// === FIX 3: Bump all versions to 0.7.18 ===
writeFileSync('../VERSION', '0.7.18\n', 'utf8')
fixes.push('3. VERSION -> 0.7.18')

let api = readFileSync('public/js/api.js', 'utf8')
api = api.replace(/APP_VERSION\s*=\s*'[^']+'/, "APP_VERSION = '0.7.18'")
writeFileSync('public/js/api.js', api, 'utf8')
fixes.push('4. api.js APP_VERSION -> 0.7.18')

const htmlFiles = ['public/index.html', 'public/teacher.html', 'public/student.html', 'public/meeting-live.html']
for (const f of htmlFiles) {
  try {
    let h = readFileSync(f, 'utf8')
    h = h.replace(/v=\d+/g, 'v=0718')
    writeFileSync(f, h, 'utf8')
    fixes.push('5. ' + f + ' -> v=0718')
  } catch(e) {
    fixes.push('5. ' + f + ': ' + e.message)
  }
}

console.log('=== FIX RESULTS ===')
fixes.forEach(f => console.log(f))
