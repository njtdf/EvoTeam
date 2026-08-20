import fs from 'fs';

const html = fs.readFileSync('public/teacher.html', 'utf8');
const js = fs.readFileSync('public/js/teacher.js', 'utf8');

// Extract return object from teacher.js
const retIdx = js.lastIndexOf('return {');
const retBlock = js.slice(retIdx, js.indexOf('\n  },', retIdx + 10));
const returnedVars = new Set();
const varMatches = retBlock.matchAll(/(\w+)/g);
for (const m of varMatches) {
  const w = m[1];
  // Skip keywords
  if (!['return', 'true', 'false', 'null', 'undefined'].includes(w)) {
    returnedVars.add(w);
  }
}
console.log('Returned vars count:', returnedVars.size);

// Extract identifiers from HTML template
// v-if, v-else-if, v-show, v-model, @click, :class, {{ }}
const refs = new Set();
const patterns = [
  /v-if="([^"]+)"/g,
  /v-else-if="([^"]+)"/g,
  /v-show="([^"]+)"/g,
  /v-model="([^"]+)"/g,
  /@click="([^"]+)"/g,
  /:class="([^"]+)"/g,
  /:disabled="([^"]+)"/g,
  /:style="([^"]+)"/g,
  /v-html="([^"]+)"/g,
  /v-for="([^"]+)"/g,
];
const allRefs = new Set();
for (const p of patterns) {
  for (const m of html.matchAll(p)) {
    const expr = m[1];
    // Extract identifiers (not methods, not operators)
    const ids = expr.matchAll(/\b([a-zA-Z_]\w*)\b/g);
    for (const id of ids) {
      const w = id[1];
      if (!['true', 'false', 'null', 'undefined', 'item', 'index', 's', 'c', 'e', 'i', 't', 'n', 'd', 'r', 'm', 'ev', 'cap', 'proj', 'task', 'student'].includes(w)) {
        allRefs.add(w);
      }
    }
  }
}
// Also check {{ }} interpolation
for (const m of html.matchAll(/\{\{([^}]+)\}\}/g)) {
  const ids = m[1].matchAll(/\b([a-zA-Z_]\w*)\b/g);
  for (const id of ids) {
    const w = id[1];
    if (!['true', 'false', 'null', 'undefined'].includes(w)) {
      allRefs.add(w);
    }
  }
}

console.log('\nTemplate refs count:', allRefs.size);
const missing = [];
for (const ref of allRefs) {
  if (!returnedVars.has(ref)) {
    missing.push(ref);
  }
}
console.log('\n=== Missing from return (potential blank page causes) ===');
missing.forEach(m => console.log('  ❌', m));
if (missing.length === 0) console.log('  ✅ All template refs found in return!');
