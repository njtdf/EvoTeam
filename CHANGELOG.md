# Changelog

## 版本编号规则

| 改动类型 | 改第几位 | 示例 |
|---|---|---|
| 大版本 / 发布 | 第二位 | 0.7.3 -> 0.8.0 |
| 大改（新功能/模块） | 第三位 | 0.7.3 -> 0.7.4 |
| 小改（bugfix/微调） | 第四位 | 0.7.3 -> 0.7.3.1 |

**同步要求**：每次改版本号必须同时改 `VERSION` 文件 + `api.js APP_VERSION` + HTML 缓存版本号（`?v=0XX`），否则触发无限重载。

---

## v0.7.5 — 2026-08-20

### 新增（Wave 8: SQLite 数据库 + LLM 记忆 + 课题组知识库）

- **`lib/db.js`**（新建）— SQLite 15 张表 schema（students/reports/summaries/tasks/meetings/chat_messages/agent_chat_messages/value_cycles/trajectories/kb_documents/kb_keywords/llm_memory/calendar_events/submissions/schema_version），WAL 模式 + 外键 + busy_timeout，幂等 initDb()
- **`lib/llm-memory.js`**（新建）— LLM 跨会话记忆系统：storeMemory / retrieveMemories / searchMemories / deleteMemory / buildMemoryContext / extractMemoriesFromChat（每 5 条聊天消息自动调 DeepSeek 抽取关键信息 → SQLite 持久化）
- **`lib/knowledge.js`**（新建）— 课题组知识库 TF-IDF 语义搜索：indexAll（29 文档 / 5622 关键词）/ searchKnowledge / getDocumentStats / getKnowledgeGraph（76 节点 / 58 边）
- **`scripts/migrate-to-sqlite.mjs`**（新建）— 一次性全量迁移：students.yaml / reports / summaries / tasks / meetings / chat / agent-chat / valuecycles / trajectories → SQLite，幂等可重复运行
- **`lib/ai.js`** 扩展 — 新增 `extractMemories(messages)` 调 DeepSeek JSON 模式抽取记忆，无 API key 降级返回空数组
- **`lib/ai-context.js`** 扩展 — buildStudentContext 末尾追加 LLM 记忆段落，AI 对话自动注入跨会话历史决策/反馈/偏好
- **`lib/chat.js`** 扩展 — saveMessage 末尾每 5 条消息异步触发 extractMemoriesFromChat，不阻塞聊天响应
- **`server.js`** 新增 11 条路由 + initDb() 启动初始化：db/stats, db/migrate, llm-memory CRUD+search, kb search+documents+stats+graph+index

### 修复
- **`memory.js` 命名冲突** — 前序 session 覆盖了旧 memory.js（JSON 学生记忆）导致 server.js / ai-context.js 导入崩溃。拆分：旧 → `lib/memory.js`（恢复 loadMemory/updateMemory/accumulateFromReport/getContextString），新 → `lib/llm-memory.js`（SQLite LLM 记忆）

### 验证
- 11 条路由全部 200 PASS
- 回归 6 条现有路由全部 200 PASS
- 迁移数据：students=19, reports=13, summaries=12, tasks=40, meetings=4, chat_messages=18, agent_chat=22, value_cycles=14, trajectories=1

---

 — 2026-08-20

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
