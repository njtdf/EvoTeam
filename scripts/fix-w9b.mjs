import { readFileSync, writeFileSync } from 'fs'
const lines = readFileSync('lib/ai-context.js', 'utf-8').split('\n')

// Find the line with "patch.graduation_state.progress_pct = calculateProgress(reqs);"
// and the line with "// Convenience:"
let endOfTryIdx = -1
let convIdx = -1
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('} catch {}') && i > 300) endOfTryIdx = i
  if (lines[i].includes('// Convenience:')) convIdx = i
}
console.log('endOfTryIdx=', endOfTryIdx, 'convIdx=', convIdx)

if (endOfTryIdx === -1 || convIdx === -1) { console.error('FATAL'); process.exit(1) }

// Insert missing closing code after the "} catch {}" line
// We need: } (close if), updateValueCycle, console.log, } catch, } (close function)
const missing = [
  '    }',
  '',
  '    updateValueCycle(studentId, patch);',
  '    console.log(\'[ai-context.js] writeBack complete for\', studentId);',
  '  } catch (e) {',
  '    console.error(\'[ai-context.js] writeBack error:\', e.message);',
  '  }',
  '}',
  '',
]

// Remove the "// Convenience:" line from its position and insert the missing + it back
lines.splice(endOfTryIdx + 1, convIdx - endOfTryIdx, ...missing, '// Convenience: inject context into a system prompt')
writeFileSync('lib/ai-context.js', lines.join('\n'), 'utf-8')
console.log('OK: fixed')
