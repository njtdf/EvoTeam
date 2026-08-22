import { appendFileSync, readFileSync, writeFileSync } from 'fs'

const now = new Date()
const ts = now.toISOString().replace('T', ' ').slice(0, 19)
const cnTime = new Date(now.getTime() + 8*3600*1000).toISOString().replace('T', ' ').slice(0, 19)

// DEVLOG (append)
const devlog = `\n## ${cnTime} — v0.7.18 Bug Fix: 3 Critical UI Crashes\n\n**问题报告**: 用户反馈导师端黑屏乱码、研究生端日历+任务全白、任务页无导航栏\n\n**根因分析**:\n\n1. **导师端黑屏 (ReferenceError)** [确定]\n   - \`teacher.js\` 的 \`courseData, courseLoading, courseSubTab, switchToCourse, updateCourseWeek\` 5个变量被放在了 \`return {}\` 块的 \`}\` 闭合之后、\`setup()\` 的 \`},\` 之后\n   - 这些变量是用 \`const\` 在 \`setup()\` 内部声明的,在 \`createApp()\` options 层级引用它们会抛出 \`ReferenceError: courseData is not defined\`\n   - \`createApp()\` 调用崩溃 → Vue 永远不 mount → 黑屏 + 白色竖条乱码\n   - **修复**: 将5个变量移入 \`return {}\` 块内部\n\n2. **研究生端日历全白 (模板缺失)** [确定]\n   - \`student.html\` 有日历导航链接 (\`switchToCalendar\`) 但没有 \`v-if="activeTab==='calendar'"\` 的内容区域\n   - 点击日历 → \`activeTab='calendar'\` → 无匹配模板 → 空白\n   - **修复**: 添加日历内容区域 (calendarDays + calendarLabel + prevMonth/nextMonth)\n\n3. **index.html 版本号严重滞后** [确定]\n   - \`index.html\` 的 \`?v=075\` 从未随版本链升级 (0.7.5→0.7.17 从未更新到它)\n   - 浏览器加载缓存的旧 api.js + app.css → \`checkVersion()\` 检测到版本不匹配 → \`window.location.reload()\` 无限循环 → 黑屏\n   - **修复**: \`v=075\` → \`v=0718\`\n\n4. **meeting-live.html 版本号滞后** [较可信]\n   - \`v=070\` 和 \`v=060\` 同步更新为 \`v=0718\`\n\n**验证结果**:\n- teacher.js courseData count: 1 (PASS)\n- student.html calendarDays: PRESENT (PASS)\n- VERSION: 0.7.18 (PASS)\n- api.js APP_VERSION: 0.7.18 (PASS)\n- 所有HTML v=0718 (PASS)\n- node --check 两个JS文件: 无语法错误 (PASS)\n- 服务器 /api/version: 0.7.18 (PASS)\n- 登录测试: t01/汤老师, s01/宋禧, u01/本科生张三 全部 200 OK\n- 学生API: calendar/events 17事件, tasks 27任务\n\n**教训**: 版本号 bump 脚本必须覆盖所有 HTML 文件,特别是 index.html。漏掉一个 = 无限重载 = 黑屏。\n`

appendFileSync('../DEVLOG.md', devlog, 'utf8')
console.log('DEVLOG appended')

// CHANGELOG (prepend)
const cl = readFileSync('../CHANGELOG.md', 'utf8')
const newEntry = `## v0.7.18 (2026-08-22) — Critical Bug Fix\n\n### Fixed\n- **导师端黑屏乱码**: \`teacher.js\` 中 \`courseData\` 等5个变量被误放在 return 块外部,导致 \`ReferenceError\` → Vue 不 mount → 黑屏。已移入 return 块内。\n- **研究生端日历全白**: \`student.html\` 缺少日历内容模板 (\`v-if="activeTab==='calendar'"\`),点击日历 Tab 无内容渲染。已添加完整的日历模板。\n- **index.html 版本号严重滞后**: \`v=075\` 从未随版本链更新,导致浏览器加载缓存旧文件 → \`checkVersion()\` 无限重载 → 黑屏。已更新为 \`v=0718\`。\n- **meeting-live.html 版本号滞后**: \`v=070\`/\`v=060\` 同步更新为 \`v=0718\`。\n- 全部HTML文件版本号统一为 \`v=0718\`,VERSION 和 api.js APP_VERSION 同步为 \`0.7.18\`。\n\n`
writeFileSync('../CHANGELOG.md', newEntry + cl, 'utf8')
console.log('CHANGELOG prepended')
