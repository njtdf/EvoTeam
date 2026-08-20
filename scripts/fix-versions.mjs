import fs from 'fs';
let h = fs.readFileSync('public/teacher.html', 'utf8');
// Remove all existing css/js version links
h = h.replace(/<link rel="stylesheet" href="\/css\/app\.css\?v=\d+">/g, '');
h = h.replace(/<script src="\/js\/api\.js\?v=\d+"><\/script>/g, '');
h = h.replace(/<script src="\/js\/teacher\.js\?v=\d+"><\/script>/g, '');
// Insert clean versions in head (after vue script)
h = h.replace(
  '<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>',
  '<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>\n<link rel="stylesheet" href="/css/app.css?v=071">'
);
// Insert scripts before </body>
h = h.replace('</body>', '<script src="/js/api.js?v=071"></script>\n<script src="/js/teacher.js?v=071"></script>\n</body>');
fs.writeFileSync('public/teacher.html', h);
console.log('Fixed CSS/JS version links');
