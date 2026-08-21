import { readFileSync, writeFileSync } from 'fs'

const js = readFileSync('public/js/teacher.js', 'utf8')

const oldAddDecision = `    async function addDecision() {
      if (!selectedVcStudent.value || !newDecision.value.text) return
      try {
        const id = selectedVcStudent.value.student_id
        const r = await fetch(\`/api/valuecycle/\${id}/decision\`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision: newDecision.value.text, rationale: newDecision.value.rationale })
        })
        if (r.ok) {
          selectedVcStudent.value = (await r.json()).valuecycle
          newDecision.value = { text: '', rationale: '' }
        }
      } catch (e) { console.error('addDecision:', e.message) }
    }`

const newCode = `    async function addDecision() {
      if (!selectedVcStudent.value || !newDecision.value.text) return
      try {
        const id = selectedVcStudent.value.student_id
        const r = await fetch(\`/api/decisions/\${id}\`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision: newDecision.value.text, rationale: newDecision.value.rationale })
        })
        if (r.ok) {
          const data = await r.json()
          if (data.valuecycle?.decision_log) selectedVcStudent.value.decision_log = data.valuecycle.decision_log
          await loadDecisions(id)
          newDecision.value = { text: '', rationale: '' }
        }
      } catch (e) { console.error('addDecision:', e.message) }
    }

    const decisionsList = ref([])
    const decisionsStats = ref(null)

    async function loadDecisions(studentId) {
      try {
        const r = await fetch(\`/api/decisions/\${studentId}\`)
        if (r.ok) {
          const data = await r.json()
          decisionsList.value = data.decisions || []
          decisionsStats.value = data.stats || null
        }
      } catch (e) { console.error('loadDecisions:', e.message) }
    }

    async function deleteDecision(decisionId) {
      if (!selectedVcStudent.value) return
      const id = selectedVcStudent.value.student_id
      try {
        const r = await fetch(\`/api/decisions/\${id}/\${decisionId}\`, { method: 'DELETE' })
        if (r.ok) { await loadDecisions(id) }
      } catch (e) { console.error('deleteDecision:', e.message) }
    }

    async function updateDecisionOutcome(decisionId, outcome) {
      if (!selectedVcStudent.value) return
      const id = selectedVcStudent.value.student_id
      try {
        const r = await fetch(\`/api/decisions/\${id}/\${decisionId}\`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outcome })
        })
        if (r.ok) { await loadDecisions(id) }
      } catch (e) { console.error('updateDecisionOutcome:', e.message) }
    }`

if (!js.includes(oldAddDecision)) {
  console.error('FATAL: oldAddDecision block not found')
  process.exit(1)
}

let updated = js.replace(oldAddDecision, newCode)

const oldReturn = '      newDecision, saveGraduation, saveCapability, addDecision,'
const newReturn = '      newDecision, saveGraduation, saveCapability, addDecision,\n      decisionsList, decisionsStats, loadDecisions, deleteDecision, updateDecisionOutcome,'

if (!updated.includes(oldReturn)) {
  console.error('FATAL: return line not found')
  process.exit(1)
}
updated = updated.replace(oldReturn, newReturn)

writeFileSync('public/js/teacher.js', updated)
console.log('OK: teacher.js patched')
