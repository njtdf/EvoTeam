import fs from 'fs';
const h = fs.readFileSync('public/teacher.html','utf8');
const lines = h.split('\n');
lines.slice(-20).forEach((l, i) => {
  const lineNum = lines.length - 20 + i + 1;
  const opens = (l.match(/<div/g) || []).length;
  const closes = (l.match(/<\/div>/g) || []).length;
  console.log(`${lineNum}: [o=${opens} c=${closes}] ${l}`);
});
