import fs from 'fs';
const files = [
  { path: 'public/teacher.html', from: '?v=072', to: '?v=073' },
  { path: 'public/student.html', from: '?v=070', to: '?v=073' },
  { path: 'public/index.html',  from: '?v=070', to: '?v=073' },
];
for (const f of files) {
  let c = fs.readFileSync(f.path, 'utf8');
  c = c.split(f.from).join(f.to);
  fs.writeFileSync(f.path, c);
  console.log('Bumped ' + f.path);
}
let api = fs.readFileSync('public/js/api.js', 'utf8');
api = api.replace("'0.7.2'", "'0.7.3'");
fs.writeFileSync('public/js/api.js', api);
console.log('Bumped api.js');
