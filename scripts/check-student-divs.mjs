import fs from 'fs';
const h = fs.readFileSync('public/student.html','utf8');
const lines = h.split('\n');
let depth = 0;
lines.forEach((l, i) => {
  const opens = (l.match(/<div/g) || []).length;
  const closes = (l.match(/<\/div>/g) || []).length;
  depth += opens - closes;
  if (l.includes('v-if="activeTab')) {
    const tab = l.match(/activeTab==='([^']+)'/)?.[1] || '?';
    console.log(`L${i+1} tab=${tab} depthBefore=${depth-(opens-closes)} after=${depth}`);
  }
});
console.log('Final depth:', depth);
