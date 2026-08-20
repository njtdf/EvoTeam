import fs from 'fs';

const s = fs.readFileSync('public/js/teacher.js', 'utf8');
const lines = s.split('\n');

const [, , start, end] = process.argv;
const a = parseInt(start, 10);
const b = parseInt(end, 10);
for (let i = a - 1; i < b && i < lines.length; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
