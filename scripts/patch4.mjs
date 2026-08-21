import { readFileSync, writeFileSync } from 'fs'
const js = readFileSync('public/js/teacher.js', 'utf8')
const old = `        if (r.ok) selectedVcStudent.value = await r.json()
      } catch (e) { console.error('selectVcStudent:', e.message) }`
const replacement = `        if (r.ok) selectedVcStudent.value = await r.json()
        await loadDecisions(id)
      } catch (e) { console.error('selectVcStudent:', e.message) }`
if (!js.includes(old)) { console.error('NOT FOUND'); process.exit(1) }
writeFileSync('public/js/teacher.js', js.replace(old, replacement))
console.log('OK')
