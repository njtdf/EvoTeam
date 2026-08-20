import fs from 'fs';
const h = fs.readFileSync('public/teacher.html','utf8');
const lines = h.split('\n');
lines.slice(0, 55).forEach((l, i) => {
  const opens = (l.match(/<div/g) || []).length;
  const closes = (l.match(/<\/div>/g) || []).length;
  console.log(`${i+1}: [o=${opens} c=${closes}] ${l}`);
});
