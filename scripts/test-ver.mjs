const r = await fetch('http://localhost:3001/api/version')
const d = await r.json()
console.log('Server version:', d.version)
