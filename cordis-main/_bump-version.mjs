import { readFileSync, writeFileSync } from 'fs';

// VERSION file
writeFileSync('D:/OneDrive/7-SideWork/AutoProf/VERSION', '0.6.0');

// api.js
let api = readFileSync('public/js/api.js', 'utf-8');
api = api.replace("const APP_VERSION = '0.5.3'", "const APP_VERSION = '0.6.0'");
writeFileSync('public/js/api.js', api);

// Cache-bust: find all ?v= patterns in HTML files
const htmlFiles = ['public/teacher.html', 'public/student.html', 'public/login.html', 'public/meeting-live.html'];
let totalReplaced = 0;
for (const f of htmlFiles) {
  try {
    let html = readFileSync(f, 'utf-8');
    // Replace ?v=XXX (any digits) with ?v=060
    const before = html;
    html = html.replace(/\?v=\d+/g, '?v=060');
    if (html !== before) {
      writeFileSync(f, html);
      const count = (before.match(/\?v=\d+/g) || []).length;
      totalReplaced += count;
      console.log(`${f}: ${count} cache-bust strings updated`);
    }
  } catch (e) {
    // file might not exist
  }
}
console.log(`Total cache-bust replacements: ${totalReplaced}`);
console.log('Version bump complete: 0.5.3 -> 0.6.0');
