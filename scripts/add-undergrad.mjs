import fs from 'fs';
let c = fs.readFileSync('labos/students.yaml', 'utf8');
if (!c.endsWith('\n')) c += '\n';
c += `
# 本科生测试账号
- id: u01
  name: 本科生张三
  project: 本科创新训练
  report_path: labos/reports/u01
  role: undergrad
  password: "changeme"
  active: true
- id: u02
  name: 本科生李四
  project: 毕业设计
  report_path: labos/reports/u02
  role: undergrad
  password: "changeme"
  active: true
- id: u03
  name: 本科生王五
  project: 本科课程设计
  report_path: labos/reports/u03
  role: undergrad
  password: "changeme"
  active: true
`;
fs.writeFileSync('labos/students.yaml', c);
console.log('Added 3 undergrad accounts');
