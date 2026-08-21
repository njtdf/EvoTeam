import { readFileSync, writeFileSync } from 'fs'
const html = readFileSync('public/teacher.html', 'utf8')
const old = `<div class="vc-detail-section" v-if="selectedVcStudent.decision_log">
        <div class="vc-label">决策记录 ({{ selectedVcStudent.decision_log.length }}条)</div>`
const replacement = `<div class="vc-detail-section" v-if="selectedVcStudent">
        <div class="vc-label">决策记录 ({{ decisionsList.length }}条)</div>`
if (!html.includes(old)) { console.error('NOT FOUND'); process.exit(1) }
writeFileSync('public/teacher.html', html.replace(old, replacement))
console.log('OK')
