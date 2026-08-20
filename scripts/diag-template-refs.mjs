import fs from 'fs';

const html = fs.readFileSync('public/teacher.html', 'utf8');
const js = fs.readFileSync('public/js/teacher.js', 'utf8');

const retIdx = js.indexOf('return {');
const retEnd = js.indexOf('\n    }', retIdx);
const retBlock = js.slice(retIdx, retEnd);
const returned = new Set(retBlock.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g));

const directives = [];
const re = /(?:v-model|v-if|v-else-if|v-for|v-show|v-bind|:[a-zA-Z-]+|@[a-zA-Z.-]+)="([^"]*)"/g;
let m;
while ((m = re.exec(html)) !== null) directives.push(m[1]);
const mus = /{{([^}]+)}}/g;
while ((m = mus.exec(html)) !== null) directives.push(m[1]);

const idSet = new Set();
for (const expr of directives) {
  const ids = expr.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g) || [];
  for (const id of ids) idSet.add(id);
}

const builtins = new Set(['in','of','true','false','null','undefined','item','index','key','val','obj','arr','t','f','i','j','n','len','s','c','e','event','$event','$el','$refs','$emit','Math','Date','JSON','Object','Array','String','Number','parseInt','parseFloat','isNaN','console','window','document','length','push','slice','map','filter','forEach','includes','indexOf','split','join','trim','toLowerCase','toUpperCase','toFixed','replace','match','test','some','every','find','reduce','concat','sort','reverse','pop','shift','unshift','keys','values','entries','assign','freeze','from','isArray','now','random','floor','ceil','round','max','min','abs','pow','sqrt','PI','new','typeof','instanceof','return','if','else','for','while','this','class','style','ref','as','use','to','mm','dd','yyyy']);
const candidates = [...idSet].filter(id => !builtins.has(id) && !/^\d/.test(id));

const missing = [];
for (const id of candidates) {
  const returnedFlag = returned.has(id);
  const definedFlag = new RegExp('\\b' + id.replace(/[$]/g,'\\$') + '\\b').test(js);
  if (!returnedFlag && !definedFlag) missing.push(id);
}

console.log('=== Template refs NOT returned AND NOT defined ===');
console.log('Missing:', missing.length);
missing.forEach(id => console.log('  -', id));

const refNotReturned = candidates.filter(id => !returned.has(id) && new RegExp('\\b' + id.replace(/[$]/g,'\\$') + '\\b').test(js));
console.log('\n=== Defined in JS but NOT returned (template cannot access) ===');
console.log('Count:', refNotReturned.length);
refNotReturned.forEach(id => console.log('  -', id));
