import fs from 'fs';
const root = 'D:/OneDrive/7-SideWork/AutoProf/EvoTeam';

const serverJs = fs.readFileSync(root + '/server.js', 'utf8');

// Find all import lines
const importLines = serverJs.split('\n').filter(l => l.trim().startsWith('import') || l.trim().startsWith('const ') && l.includes('from'));
console.log('=== server.js imports (first 40 lines) ===');
console.log(serverJs.split('\n').slice(0, 40).join('\n'));

// Find memory/kb route context
const memIdx = serverJs.indexOf('/api/memory');
console.log('\n=== /api/memory context (chars ' + (memIdx-200) + ' to ' + (memIdx+800) + ') ===');
if (memIdx > -1) console.log(serverJs.substring(memIdx-200, memIdx+800));

const kbIdx = serverJs.indexOf('/api/kb');
console.log('\n=== /api/kb context ===');
if (kbIdx > -1) console.log(serverJs.substring(kbIdx-200, kbIdx+800));

const dbStatsIdx = serverJs.indexOf('/api/db');
console.log('\n=== /api/db context ===');
if (dbStatsIdx > -1) console.log(serverJs.substring(dbStatsIdx-200, dbStatsIdx+800));
else console.log('NOT FOUND');

// ai-context.js around memory
const aiCtx = fs.readFileSync(root + '/lib/ai-context.js', 'utf8');
const memImpIdx = aiCtx.indexOf('memory');
console.log('\n=== ai-context.js memory references ===');
if (memImpIdx > -1) {
  // find all occurrences
  let idx = 0;
  while (true) {
    const i = aiCtx.indexOf('memory', idx);
    if (i === -1) break;
    console.log('--- at char', i, '---');
    console.log(aiCtx.substring(Math.max(0,i-100), i+200));
    idx = i + 7;
  }
}
