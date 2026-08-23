// Verify the updated teacher.js is being served
const r = await fetch('http://localhost:3001/js/teacher.js?v=07.31')
const text = await r.text()
const hasFix = text.includes('if (!dashboardData.value) await loadDashboard()')
console.log('teacher.js served:', r.status, 'has fix:', hasFix)
