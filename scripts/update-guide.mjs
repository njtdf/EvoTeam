import { readFileSync, writeFileSync } from 'fs'

const P = 'D:/OneDrive/7-SideWork/AutoProf'
let g = readFileSync(`${P}/MANUAL-VERIFICATION-GUIDE.md`, 'utf-8')

const section = `
---

## v0.7.20 周报端到端验证 (2026-08-22)

### 前置
- 服务器运行: \`http://localhost:3001\`
- 版本: 0.7.20 (检查页面右下角)

### A. 学生端周报 (s01 / changeme)

1. 打开 \`http://localhost:3001/login\`
2. 用 s01 / changeme 登录
3. **预期**: 直接进入周报页，编辑器已有中文模板:
   - 标题 "双周报"
   - "## 1. 本周进展" "## 2. 问题与困难" 等 6 个中文 section
4. 工具栏左侧: 醒目绿色 "✏️ 写周报" 按钮
5. 工具栏左侧: "📋 历史周报 (2)" 按钮 (s01 已有 2 份历史周报)
6. 点击 "📋 历史周报" → 展开历史列表
   - 显示 2026-W34.md 和 2026-W33.md
   - 每条显示: 文件名 + 周期 + 状态标签 + 摘要预览
7. 点击任意历史周报 → 展开 Markdown 渲染的完整报告
   - 点击 "返回" 按钮回到编辑器
8. 点击 "✏️ 写周报" → 重新加载模板到编辑器
9. 左侧编辑器输入内容 → 右侧实时预览 (分屏)
10. 点击 "📤 提交" → Toast: "提交成功！AI 正在生成总结..."
11. 等待几秒 → AI 总结卡片出现在编辑器下方 (不再覆盖全屏)
    - 显示: 总结 / 风险 / 给导师的建议
12. 点击 "关闭" 关闭总结卡片

### B. 导师端周报 (t01 / lab123)

1. 打开 \`http://localhost:3001/login\`
2. 用 t01 / lab123 登录
3. 左侧导航 → 点击 "周报"
4. **预期**: 顶部工具栏 + 学生网格卡片 (12 个学生)
5. 右上角学生下拉框 → **白底黑字，清晰可见** (之前是同色不可见)
6. 下拉选择 "s01 - 宋禧"
7. **预期**: 分屏布局:
   - 左侧: AI 聊天框 (可输入消息)
   - 右侧: 周报渲染 (Markdown→HTML) + AI 总结卡片
8. 在左侧聊天框输入: "这个学生本周进度怎么样?"
9. 按 Enter 或点击 "发送"
10. **预期**: AI 回复逐字流式出现 (SSE), 引用学生周报内容
11. 或点击学生网格中任意学生卡片 → 同样进入分屏

### 已验证 (后端 API)
| 端点 | 状态 | 说明 |
|---|---|---|
| POST /api/login (t01) | 200 | 导师登录 |
| POST /api/login (s01) | 200 | 学生登录 |
| GET /api/students | 200 | 12+ 学生 |
| GET /api/report/s01 | 200 | 最新周报 |
| GET /api/summary/s01 | 200 | AI 总结 |
| GET /api/report-context/s01 | 200 | 飞轮上下文 |
| GET /api/reports/s01 | 200 | 2 份历史周报 (新) |
| GET /api/report/s01?file=2026-W34.md | 200 | 按文件名加载 (新) |
| POST /api/chat/s01 (SSE) | 200 | 流式文本逐字返回 |
| student.html div 平衡 | 207/207 | 无结构错误 |
| teacher.html div 平衡 | 595/595 | 无结构错误 |
| student.js 语法检查 | pass | 无语法错误 |
| 所有 @click / {{ }} 引用 | pass | 全部在 return 块 |
`

g += section
writeFileSync(`${P}/MANUAL-VERIFICATION-GUIDE.md`, g, 'utf-8')
console.log('Guide updated')
