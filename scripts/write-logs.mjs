import { readFileSync, writeFileSync, appendFileSync } from 'fs'

const PARENT = 'D:/OneDrive/7-SideWork/AutoProf'

// === DEVLOG (append) ===
const devlog = `

## 2026-08-22 v0.7.20 — 周报端到端打磨

### 目标
只打磨周报功能，不加新功能，不加依赖。让学生3秒知道干什么，30秒开始写，1分钟提交。导师选学生5秒看到周报+AI总结。

### 学生端改动
1. **模板中文化**: "Bi-Weekly Report" → "双周报"，所有6个section标题英文→中文(本周进展/问题与困难/本周活动/下两周计划/服务工作/附件)
2. **Toast中文化**: "Report is empty"→"周报内容不能为空"，"Report submitted!"→"提交成功！AI正在生成总结..."等全部改中文
3. **工具栏重构**: 新增醒目"✏️ 写周报"主按钮(替换小"模板"按钮)，新增"📋 历史周报"入口，按钮分组(左侧功能/右侧提交)
4. **周报历史列表**: 新增 \`GET /api/reports/:id\` 端点返回全部历史周报列表(文件名+周期+状态+摘要)，前端可点击查看任意历史周报
5. **历史周报查看**: \`GET /api/report/:id?file=filename\` 支持按文件名加载特定周报，前端 \`formatHistoryReport()\` 渲染
6. **AI总结卡片修复**: 从 \`position:fixed; z-index:200\` (覆盖内容) 改为正常内联卡片 \`margin:0 12px 12px\`
7. **编辑器分屏**: textarea左 + preview右 (已有，验证正常)

### 导师端改动
1. **重复AI总结标题修复**: 删除多余的英文 "AI Summary" 标题行 (teacher.html line 278)
2. **学生下拉框可见性修复**: \`.student-select\` 从 \`var(--card)\` (可能在白色背景上不可见) 改为显式 \`background:#fff; color:#1f2937; border:1px solid #d1d5db; font-weight:500\` + focus高亮
3. **布局验证**: chat LEFT / report RIGHT (pane-left/pane-right) 布局已正确，无需调整
4. **onStudentChange验证**: API调用链 \`/api/report/:id\` + \`/api/summary/:id\` + \`/api/chat/:id\` + \`/api/report-context/:id\` 全部返回200

### 后端新增
- \`GET /api/reports/:id\` — 列出学生全部历史周报(文件名+周期+状态+摘要)
- \`GET /api/report/:id?file=filename\` — 按文件名加载特定周报

### 验证结果
- Login (teacher t01): 200 ✓
- Login (student s01): 200 ✓
- Version: 0.7.20 ✓
- /api/students: 200, 12+ students ✓
- /api/report/s01: 200 ✓
- /api/summary/s01: 200 ✓
- /api/report-context/s01: 200 ✓
- /api/reports/s01: 200, 2 reports (W33, W34) ✓
- /api/report/s01?file=2026-W34.md: 200 ✓
- student.html div平衡: 207/207 ✓
- teacher.html div平衡: 595/595 ✓
- 所有9个新导出在return block: ✓

### 未做(本轮)
- 不加新功能
- 不动其他Tab(任务/会议/看板/课程等)
- 不加新依赖
- 浏览器UI验证留给用户
`
appendFileSync(`${PARENT}/DEVLOG.md`, devlog, 'utf-8')
console.log('DEVLOG appended')

// === CHANGELOG (prepend) ===
const changelog = `# Changelog

## v0.7.20 (2026-08-22) — 周报端到端打磨

### 学生端
- 模板/Toast 全中文化（双周报/本周进展/问题与困难等）
- 新增醒目"✏️ 写周报"主按钮 + "📋 历史周报"入口
- 新增周报历史列表：点击查看任意历史周报
- AI总结卡片从 position:fixed 改为内联显示（不再覆盖内容）

### 导师端
- 修复学生下拉框不可见问题（显式白底黑字+边框）
- 删除重复的英文 AI Summary 标题
- 验证 chat左/report右 布局 + SSE + report-context 全链路 200

### 后端
- \`GET /api/reports/:id\` — 学生全部历史周报列表
- \`GET /api/report/:id?file=filename\` — 按文件名加载特定周报

`
const oldCL = readFileSync(`${PARENT}/CHANGELOG.md`, 'utf-8')
// Remove the first "# Changelog" header from old content to avoid duplication
const oldCLBody = oldCL.replace(/^# Changelog\s*\n/, '')
writeFileSync(`${PARENT}/CHANGELOG.md`, changelog + oldCLBody, 'utf-8')
console.log('CHANGELOG prepended')
console.log('Done.')
