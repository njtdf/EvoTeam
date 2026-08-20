import fs from 'fs';

const html = fs.readFileSync('public/teacher.html', 'utf8');
const js = fs.readFileSync('public/js/teacher.js', 'utf8');

// Extract return object
const retIdx = js.lastIndexOf('return {');
const retEnd = js.indexOf('\n    }', retIdx + 10);
const retBlock = js.slice(retIdx, retEnd);
const returned = new Set();
for (const m of retBlock.matchAll(/\b([a-zA-Z_]\w*)\b/g)) {
  returned.add(m[1]);
}

// Only check @click handlers - extract the function name being called
const clickRefs = new Set();
for (const m of html.matchAll(/@click="([^"]+)"/g)) {
  const expr = m[1];
  // Extract function name (first identifier before any parenthesis or dot)
  const idMatch = expr.match(/^([a-zA-Z_]\w*)/);
  if (idMatch) clickRefs.add(idMatch[1]);
  // Also check for inline expressions with other function calls
  for (const id of expr.matchAll(/\.([a-zA-Z_]\w*)\s*\(/g)) {
    // These are method calls on objects, skip
  }
}

// Check v-if top-level identifiers (not property access, not string literals)
const vifRefs = new Set();
for (const m of html.matchAll(/v-if="([^"]+)"/g)) {
  const expr = m[1];
  // Skip activeTab=== comparisons (string literal checks)
  if (expr.includes('activeTab===') || expr.includes('activeTab===')) continue;
  // Extract top-level identifiers that aren't properties
  for (const id of expr.matchAll(/\b([a-zA-Z_]\w*)\b/g)) {
    const w = id[1];
    if (!['true','false','null','undefined','length','includes','indexOf','some','every','find','filter','map','forEach','push','slice','trim','replace','match','test','toString','toFixed','round','floor','ceil','max','min','abs','String','Number','Boolean','Array','Object','Math','JSON','Date','parseInt','parseFloat','isNaN','item','index','s','c','e','i','t','n','d','r','m','st','col','row'].includes(w)) {
      vifRefs.add(w);
    }
  }
}

console.log('=== @click function refs ===');
const missingClicks = [];
for (const ref of clickRefs) {
  if (!returned.has(ref)) missingClicks.push(ref);
}
if (missingClicks.length === 0) console.log('  ✅ All @click functions found in return!');
else { console.log('  ❌ Missing:'); missingClicks.forEach(m => console.log('    ', m)); }

console.log('\n=== v-if refs (excluding activeTab) ===');
const missingVifs = [];
for (const ref of vifRefs) {
  if (!returned.has(ref)) missingVifs.push(ref);
}
if (missingVifs.length === 0) console.log('  ✅ All v-if refs found in return!');
else { console.log('  ❌ Missing:'); missingVifs.forEach(m => console.log('    ', m)); }
