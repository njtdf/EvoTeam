import fs from 'fs';
const h = fs.readFileSync('public/teacher.html','utf8');
const lines = h.split('\n');
let depth = 0;
const ranges = [];
lines.forEach((l, i) => {
  const opens = (l.match(/<div/g) || []).length;
  const closes = (l.match(/<\/div>/g) || []).length;
  const before = depth;
  depth += opens - closes;
  if (l.includes('v-if="activeTab')) {
    const tab = l.match(/activeTab==='([^']+)'/)?.[1] || '?';
    ranges.push({line: i+1, tab, depthBefore: before, depthAfter: depth});
  }
});
ranges.forEach(r => console.log(`Line ${r.line} tab=${r.tab} depthBefore=${r.depthBefore} after=${r.depthAfter}`));
console.log('Final depth:', depth);
