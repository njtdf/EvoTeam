import fs from 'fs';
const js = fs.readFileSync('public/js/teacher.js', 'utf8');
// Extract the return { ... } block
const retMatch = js.match(/return\s*\{([\s\S]*?)\n\s*\};?\s*\n\s*\}\s*\)?;?\s*$/);
if (!retMatch) {
  // Try alternate: find return { near end of file
  const idx = js.lastIndexOf('return {');
  if (idx >= 0) {
    const chunk = js.slice(idx);
    console.log('Return block found at char', idx);
    // Extract variable names
    const vars = [...chunk.matchAll(/(\w+)[,\s]/g)].map(m => m[1]);
    console.log('Returned vars (first 80):', vars.slice(0, 80).join(', '));
  } else {
    console.log('No return block found');
  }
} else {
  const vars = [...retMatch[1].matchAll(/(\w+)[,\s]/g)].map(m => m[1]);
  console.log('Returned vars:', vars.join(', '));
}
// Check for declared refs/computed not in return
const setupMatch = js.match(/setup\s*\(\)\s*\{([\s\S]*?)return\s*\{/);
if (setupMatch) {
  const setupBody = setupMatch[1];
  const declared = [...setupBody.matchAll(/const\s+(\w+)\s*=/g)].map(m => m[1]);
  console.log('\nDeclared in setup:', declared.length, 'vars');
  console.log(declared.join(', '));
}
