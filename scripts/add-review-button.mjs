import { readFileSync, writeFileSync } from 'fs'

const tf = 'D:/OneDrive/7-SideWork/AutoProf/EvoTeam/public/teacher.html'
let c = readFileSync(tf, 'utf8')

// Find the AI summary card title line and add AI review button + display after the card
const marker = '<div class="card-title">📊 AI 总结</div>'
if (c.includes('agentReviewText')) {
  console.log('teacher.html already has agent review elements')
} else if (c.includes(marker)) {
  // Insert AI review button right after the card title
  const buttonHtml = '<button class="btn btn-sm btn-primary" @click="runAgentReview" :disabled="agentReviewLoading" style="float:right;font-size:11px;padding:2px 8px">{{ agentReviewLoading ? "AI 审阅中..." : "🤖 AI 审阅" }}</button>'
  c = c.replace(marker, marker + '\n          ' + buttonHtml)
  
  // Insert review display area after the summary card (before the report card)
  const reportCardMarker = '<div v-if="report" class="card">'
  const reviewHtml = [
    '<div v-if="agentReviewText" class="card" style="border-left:3px solid var(--primary)">',
    '          <div class="card-title">🤖 AI 审阅意见</div>',
    '          <div class="md-preview" v-html="formatMessage(agentReviewText)" style="border:none;padding:0"></div>',
    '        </div>',
    '        '
  ].join('\n        ')
  
  if (c.includes(reportCardMarker)) {
    c = c.replace(reportCardMarker, reviewHtml + reportCardMarker)
    console.log('teacher.html: AI review button + display added')
  } else {
    console.log('teacher.html: report card marker NOT FOUND')
  }
  
  writeFileSync(tf, c, 'utf8')
} else {
  console.log('teacher.html: AI summary marker NOT FOUND')
}
