import fs from 'fs';
import path from 'path';
const root = 'D:/OneDrive/7-SideWork/AutoProf/EvoTeam';

const files = [
  'lib/db.js', 'lib/memory.js', 'lib/knowledge.js',
  'lib/ai.js', 'lib/chat.js', 'lib/ai-context.js',
  'scripts/migrate-to-sqlite.mjs', 'labos/autoprof.db',
  'server.js', 'package.json', 'CHANGELOG.md', 'AGENTS.md'
];

console.log('=== File existence + line counts ===');
for (const f of files) {
  const p = path.join(root, f);
  try {
    const stat = fs.statSync(p);
    const content = fs.readFileSync(p, 'utf8');
    const lines = content.split('\n').length;
    console.log(`OK  ${f} (${lines} lines, ${stat.size} bytes)`);
  } catch(e) {
    console.log(`MISSING  ${f}`);
  }
}

const aiJs = fs.readFileSync(path.join(root, 'lib/ai.js'), 'utf8');
console.log('\n=== ai.js extractMemories ===');
console.log('Has extractMemories:', aiJs.includes('extractMemories'));

const serverJs = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
console.log('\n=== server.js state ===');
console.log('Total lines:', serverJs.split('\n').length);
console.log('Has db.js import:', serverJs.includes('lib/db'));
console.log('Has memory.js import:', serverJs.includes('lib/memory'));
console.log('Has knowledge.js import:', serverJs.includes('lib/knowledge'));
console.log('Has /api/db/stats route:', serverJs.includes('/api/db/stats'));
console.log('Has /api/memory route:', serverJs.includes('/api/memory'));
console.log('Has /api/kb route:', serverJs.includes('/api/kb'));
const startIdx = serverJs.indexOf('// --- Start ---');
console.log('// --- Start --- at char:', startIdx);
const listenIdx = serverJs.indexOf('app.listen');
console.log('app.listen at char:', listenIdx);

const chatJs = fs.readFileSync(path.join(root, 'lib/chat.js'), 'utf8');
console.log('\n=== chat.js state ===');
console.log('Has saveMessage:', chatJs.includes('saveMessage'));
console.log('Has memory import:', chatJs.includes('memory'));
console.log('Has extractMemoriesFromChat:', chatJs.includes('extractMemoriesFromChat'));

const aiCtxJs = fs.readFileSync(path.join(root, 'lib/ai-context.js'), 'utf8');
console.log('\n=== ai-context.js state ===');
console.log('Has buildStudentContext:', aiCtxJs.includes('buildStudentContext'));
console.log('Has memory import:', aiCtxJs.includes('memory'));
console.log('Has buildMemoryContext:', aiCtxJs.includes('buildMemoryContext'));

const versionPath = 'D:/OneDrive/7-SideWork/AutoProf/VERSION';
try {
  const v = fs.readFileSync(versionPath, 'utf8').trim();
  console.log('\n=== VERSION ===', v);
} catch(e) {
  console.log('\n=== VERSION === MISSING');
}

const dbJs = fs.readFileSync(path.join(root, 'lib/db.js'), 'utf8');
console.log('\n=== db.js exports ===');
console.log('Has getDb:', dbJs.includes('getDb'));
console.log('Has initDb:', dbJs.includes('initDb'));
console.log('Has getStats:', dbJs.includes('getStats'));
console.log('Has apply:', dbJs.includes('apply'));

const memJs = fs.readFileSync(path.join(root, 'lib/memory.js'), 'utf8');
console.log('\n=== memory.js exports ===');
console.log('Has storeMemory:', memJs.includes('storeMemory'));
console.log('Has retrieveMemories:', memJs.includes('retrieveMemories'));
console.log('Has searchMemories:', memJs.includes('searchMemories'));
console.log('Has buildMemoryContext:', memJs.includes('buildMemoryContext'));
console.log('Has extractMemoriesFromChat:', memJs.includes('extractMemoriesFromChat'));

const knowJs = fs.readFileSync(path.join(root, 'lib/knowledge.js'), 'utf8');
console.log('\n=== knowledge.js exports ===');
console.log('Has indexAll:', knowJs.includes('indexAll'));
console.log('Has searchKnowledge:', knowJs.includes('searchKnowledge'));
console.log('Has getKnowledgeGraph:', knowJs.includes('getKnowledgeGraph'));
console.log('Has getDocumentStats:', knowJs.includes('getDocumentStats'));
