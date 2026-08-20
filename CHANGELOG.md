# Changelog

## 版本编号规则

| 改动类型 | 改第几位 | 示例 |
|---|---|---|
| 大版本 / 发布 | 第二位 | 0.7.3 -> 0.8.0 |
| 大改（新功能/模块） | 第三位 | 0.7.3 -> 0.7.4 |
| 小改（bugfix/微调） | 第四位 | 0.7.3 -> 0.7.3.1 |

**同步要求**：每次改版本号必须同时改 `VERSION` 文件 + `api.js APP_VERSION` + HTML 缓存版本号（`?v=0XX`），否则触发无限重载。

---

## v0.7.4 — 2026-08-20

### 新增
- 学生端 `student.js` 新增 4 大模块：brandName 品牌切换、日历（复用 teacher 逻辑）、AI 助手（SSE 聊天 + 历史加载 + 周报上下文注入）、知识库（文件列表 + 搜索 + 查看）
- `teacher.html` sidebar 品牌从 `EvoTeam` 改为 `AutoProf`
- `student.html` 缓存版本号 073 -> 074
 - `scripts/rebuild-student-js.mjs` 构建脚本（字符串替换方式，避免 PowerShell 转义）

### 修复（前 session 遗留，本次提交包含）
- 全局空白页根因：VERSION 文件 0.7.0 与 api.js APP_VERSION 0.7.3 不同步，触发 `checkVersion()` 无限 `window.location.reload()`
- `/api/agents/custom` 500：server.js 用命名导入 `{ readFileSync }` 但 agents 路由用了 `fs.existsSync`
- chat 路由权限：`requireRole('teacher')` -> `requireAuth`，学生可访问自己的聊天端点

### 验证

| 角色 | 账号 | 品牌 | console error |
|---|---|---|---|
| 研究生 s01 | changeme | AutoGrad | 0 |
| 本科生 u01 | changeme | AutoUngrad | 0 |
| 导师 t01 | lab123 | AutoProf | 0 |

---

## v0.7.3 — 2026-08-20（前 session）

### 修复
- VERSION 文件同步修复（0.7.0 -> 0.7.3），加 localStorage 10s 重载防护
- `/api/agents/custom` 500 修复（`fs.` 前缀 -> 命名导入）
- chat 路由 requireAuth 放开

### 已有功能（截至 v0.7.3）
- Feature 1: 周报管理（MD 编辑 + AI 总结 + 风险/建议）
- Feature 2: 会议纪要 -> 行动指令（文本模式）
- Feature 3: 任务看板（4 列 + 统计 + RSS）
- Feature 5: 周报草稿辅助（读 Codex 历史）
- Feature 6: 科研工具箱（7 个 skill SSE）
- Feature 9: RSS 每日新闻（arXiv）
- Feature 18: 邮箱 -> 看板（IMAP）
- Feature 19: 审稿辅助
- Feature 20: AI 面试/答辩模拟
- Feature 22: 价值链对齐 + 能力画像 + 毕业进度
- Knowledge Navigator 总览（9 Agent 网格 + 对话）
- EvoTeam 欢迎页（3 入口卡片）
 - 5 段导航重构（核心/学生管理/Agent/科研工具/教学管理）
