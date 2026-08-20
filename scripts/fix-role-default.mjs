import fs from 'fs';

let s = fs.readFileSync('public/js/teacher.js', 'utf8');
const before = (s.match(/\|\| '2'/g) || []).length;
s = s.replaceAll(`existing.role = a.role || '2'`, `existing.role = a.role || '自定义'`);
s = s.replaceAll(`role: a.role || '2'`, `role: a.role || '自定义'`);
const after = (s.match(/\|\| '2'/g) || []).length;
fs.writeFileSync('public/js/teacher.js', s);
console.log('role default fixed:', before, '->', after);
console.log('syntax check via node -c separately');
