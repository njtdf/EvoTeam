import fs from 'fs';
const h = fs.readFileSync('public/teacher.html','utf8');
const lines = h.split('\n');
let depth = 0;
const events = [];
lines.forEach((l, i) => {
  const opens = (l.match(/<div/g) || []).length;
  const closes = (l.match(/<\/div>/g) || []).length;
  const before = depth;
  depth += opens - closes;
  if (depth < 0) events.push({line: i+1, before, after: depth, text: l.trim().slice(0,80)});
  if (depth === 1 && before > 1) events.push({line: i+1, before, after: depth, text: l.trim().slice(0,80), note: 'back to depth 1'});
});
console.log('=== Depth issues ===');
events.forEach(e => console.log(`Line ${e.line}: ${e.before}->${e.after} ${e.text} ${e.note||''}`));
console.log('Final:', depth);
console.log('\n=== Last 10 lines ===');
lines.slice(-10).forEach((l,i) => console.log((lines.length-10+i+1)+': '+l));
