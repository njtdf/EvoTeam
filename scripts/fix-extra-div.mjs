import fs from 'fs';
const f = 'public/teacher.html';
let content = fs.readFileSync(f, 'utf8');
const lines = content.split('\n');
// Find </main> line
const mainIdx = lines.findIndex(l => l.trim() === '</main>');
if (mainIdx < 0) { console.log('No </main> found'); process.exit(1); }
// Collect closing divs after </main> until scripts
const closingDivs = [];
for (let i = mainIdx + 1; i < lines.length; i++) {
  if (lines[i].trim() === '</div>') closingDivs.push(i);
  else if (lines[i].includes('<script') || lines[i].includes('</body')) break;
}
console.log('Closing divs after </main>:', closingDivs.length, 'at lines', closingDivs.map(i => i+1).join(', '));
if (closingDivs.length > 2) {
  // Remove the last extra one
  const removeIdx = closingDivs[closingDivs.length - 1];
  lines.splice(removeIdx, 1);
  fs.writeFileSync(f, lines.join('\n'), 'utf8');
  console.log('Removed extra div at line', removeIdx + 1);
} else {
  console.log('No extra div to remove');
}
// Verify depth
let depth = 0;
lines.forEach(l => { depth += (l.match(/<div/g) || []).length - (l.match(/<\/div>/g) || []).length; });
console.log('Final depth:', depth);
