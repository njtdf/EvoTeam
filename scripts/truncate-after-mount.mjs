import fs from 'fs';

let s = fs.readFileSync('public/js/teacher.js', 'utf8');
const marker = "}).mount('#app')";
const idx = s.indexOf(marker);
if (idx < 0) { console.error('marker not found'); process.exit(1); }
const cut = idx + marker.length;
const before = s.length;
s = s.slice(0, cut) + '\n';
fs.writeFileSync('public/js/teacher.js', s);
console.log('truncated:', before, '->', s.length, '(removed', before - s.length, 'chars after mount)');
