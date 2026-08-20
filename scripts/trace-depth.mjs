import fs from 'fs';
const h = fs.readFileSync('public/teacher.html','utf8');
const lines = h.split('\n');
let depth = 0;
// Track every line where depth changes and note structural elements
lines.forEach((l, i) => {
  const opens = (l.match(/<div/g) || []).length;
  const closes = (l.match(/<\/div>/g) || []).length;
  if (opens === 0 && closes === 0) return;
  const before = depth;
  depth += opens - closes;
  // Only show structural lines: v-if tabs, main content wrappers, depth drops to <=1
  const isTab = l.includes('v-if="activeTab');
  const isWrapper = l.includes('id="app"') || l.includes('class="layout"') || l.includes('class="main-content"') || l.includes('<main');
  if (isTab || isWrapper || depth <= 1 || depth < before) {
    console.log(`L${i+1}: ${before}->${depth} ${l.trim().slice(0,90)}`);
  }
});
console.log('Final:', depth);
