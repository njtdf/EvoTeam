import { readFileSync, writeFileSync } from 'fs'

// === 1. Update student.js generateDraft() ===
const sf = 'D:/OneDrive/7-SideWork/AutoProf/EvoTeam/public/js/student.js'
let sc = readFileSync(sf, 'utf8')

// Find the old generateDraft function by its start and end markers
const startMarker = 'async function generateDraft() {'
const endMarker = "finally { draftLoading.value = false }\n    }"
const startIdx = sc.indexOf(startMarker)
if (startIdx === -1) {
  console.log('1. student.js generateDraft NOT FOUND')
} else {
  const endIdx = sc.indexOf(endMarker, startIdx)
  if (endIdx === -1) {
    console.log('1. student.js generateDraft end NOT FOUND')
  } else {
    const oldFn = sc.substring(startIdx, endIdx + endMarker.length)
    console.log('1. Old generateDraft found, length:', oldFn.length)
    
    const newFn = [
      'async function generateDraft() {',
      '      draftLoading.value = true',
      '      let draftText = ""',
      '      try {',
      "        await streamChat('/api/agent/report-draft', {},",
      '          (chunk) => { draftText += chunk },',
      '          () => {',
      '            // Extract markdown content from response',
      '            const mdMatch = draftText.match(/```markdown\\n([\\s\\S]*?)```/)',
      '            if (mdMatch) draftText = mdMatch[1].trim()',
      '            else {',
      '              const fmMatch = draftText.match(/---[\\s\\S]*?---[\\s\\S]*/)',
      '              if (fmMatch) draftText = fmMatch[0].trim()',
      '            }',
      '            markdown.value = draftText',
      '            updatePreview()',
      "            showToast('AI Agent draft generated (using tasks+meetings+summary context)')",
      '          },',
      "          (err) => { showToast('AI draft failed: ' + err) }",
      '        )',
      "      } catch (e) { showToast('Draft generation failed: ' + e.message) }",
      '      finally { draftLoading.value = false }',
      '    }'
    ].join('\n    ')
    
    sc = sc.substring(0, startIdx) + newFn + sc.substring(endIdx + endMarker.length)
    writeFileSync(sf, sc, 'utf8')
    console.log('1. student.js generateDraft() updated to use agent endpoint')
  }
}

// === 2. Update teacher.js ===
const tf = 'D:/OneDrive/7-SideWork/AutoProf/EvoTeam/public/js/teacher.js'
let tc = readFileSync(tf, 'utf8')

// 2a. Add refs after chatStreaming
const refMarker = "const chatStreaming = ref(false)"
const refNew = "const chatStreaming = ref(false)\n   const agentReviewText = ref('')\n   const agentReviewLoading = ref(false)"
if (tc.includes('agentReviewText')) {
  console.log('2a. teacher.js refs already exist')
} else if (tc.includes(refMarker)) {
  tc = tc.replace(refMarker, refNew)
  console.log('2a. teacher.js refs added')
} else {
  console.log('2a. teacher.js ref marker NOT FOUND')
}

// 2b. Add runAgentReview function before sendChat
if (tc.includes('runAgentReview')) {
  console.log('2b. teacher.js runAgentReview already exists')
} else {
  const fnMarker = 'async function sendChat() {'
  const fnCode = [
    'async function runAgentReview() {',
    "      if (!selectedStudentId.value) { showToast('Please select a student first'); return }",
    '      agentReviewLoading.value = true',
    "      agentReviewText.value = ''",
    "      let reviewText = ''",
    '      try {',
    "        await streamChat('/api/agent/report-review', { student_id: selectedStudentId.value },",
    '          (chunk) => { reviewText += chunk; agentReviewText.value = reviewText },',
    '          () => { agentReviewLoading.value = false },',
    "          (err) => { showToast('AI review failed: ' + err); agentReviewLoading.value = false },",
    '        )',
    "      } catch (e) { showToast('Review failed: ' + e.message); agentReviewLoading.value = false }",
    '    }',
    '',
    '    '
  ].join('\n    ')
  
  const fnIdx = tc.indexOf(fnMarker)
  if (fnIdx === -1) {
    console.log('2b. teacher.js sendChat NOT FOUND')
  } else {
    tc = tc.substring(0, fnIdx) + fnCode + tc.substring(fnIdx)
    console.log('2b. teacher.js runAgentReview added')
  }
}

// 2c. Add to return statement
if (tc.includes('agentReviewText')) {
  const retMarker = 'switchToDashboard, loadDashboard, goToStudent, generateBrief,'
  if (tc.includes('runAgentReview,') && !tc.includes('agentReviewText, agentReviewLoading, runAgentReview,')) {
    // Already has runAgentReview in return? Check
    console.log('2c. teacher.js return check - runAgentReview present')
  }
  const checkRet = 'agentReviewText, agentReviewLoading, runAgentReview,'
  if (tc.includes(checkRet)) {
    console.log('2c. teacher.js return already has agent refs')
  } else if (tc.includes(retMarker)) {
    tc = tc.replace(retMarker, checkRet + '\n      ' + retMarker)
    console.log('2c. teacher.js return updated')
  } else {
    console.log('2c. teacher.js return marker NOT FOUND')
  }
} else {
  console.log('2c. teacher.js refs not yet added, skipping return')
}

writeFileSync(tf, tc, 'utf8')
console.log('teacher.js updated')
