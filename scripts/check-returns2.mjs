import fs from 'fs';

const js = fs.readFileSync('public/js/teacher.js', 'utf8');

// Extract the return block
const retIdx = js.indexOf('return {');
const retEnd = js.indexOf('\n    }', retIdx);
const retBlock = js.slice(retIdx, retEnd);
const returned = new Set(retBlock.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g));

// Find all declarations: const X = ref( / const X = computed( / const X = reactive( / function X( / async function X(
const declRe = /(?:const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:ref|computed|reactive|shallowRef|shallowReactive)\s*\(|function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
const declared = new Set();
let m;
while ((m = declRe.exec(js)) !== null) {
  if (m[1]) declared.add(m[1]);
  if (m[2]) declared.add(m[2]);
}

// Find which declared identifiers are NOT returned
const missing = [...declared].filter(d => !returned.has(d));

console.log('=== Declared (ref/computed/reactive/function) but NOT in return block ===');
console.log('Count:', missing.length);
missing.forEach(d => console.log('  -', d));

// Also: returned but not declared (typos / phantom)
const phantom = [...returned].filter(r => !declared.has(r) && !['return','object'].includes(r));
console.log('\n=== Returned but not declared (checking for typos) ===');
console.log('Count:', phantom.length);
phantom.forEach(d => console.log('  -', d));
