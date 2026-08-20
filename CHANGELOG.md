## [0.7.7] - 2026-08-21

### Changed
- **KB search upgraded from TF-IDF to FTS5** (SQLite built-in full-text search, BM25 ranking)
  - `db.js`: added `kb_fts` FTS5 virtual table
  - `knowledge.js`: `searchKnowledge()` now uses FTS5 MATCH with BM25 ranking, falls back to TF-IDF
  - 600x better relevance scores on Chinese queries
- **Overview page redesigned** as compact welcome page
  - Removed embedded KB file browser (KB has its own page under Core > Knowledge Base)
  - Added welcome bar with date + weekday + compact stat pills
  - Added "Today's Tasks" section (compact, click to toggle done)
  - Team dynamics feed in scrollable partition
  - Overall vertical scroll, no page bloat

### Added
- `todayTasks`, `todayDateStr`, `todayWeekday` refs in teacher.js
- `loadTodayTasks()` function (filters tasks by today's deadline)
- CSS: `.kn-welcome-bar`, `.kn-scroll-area`, `.kn-section`, `.kn-todo-mini`, `.kn-feed-mini`
- `scripts/test-fts5.mjs` — FTS5 verification script
- `scripts/verify-077.mjs` — 13-point API test suite (13/13 PASS)

### Fixed
- `switchToDashboard()` no longer calls `loadKbFiles()` (removed unnecessary KB load on overview)

# Changelog

## [0.7.6] — 2026-08-21 (Wave 8 续)

### 新增
- **知识库前端页面**: 导师端+学生端均可访问。TF-IDF语义搜索(输入关键词→按相似度排序返回文档片段) + 统计面板(文档数/关键词数/按类别) + 分页文档列表 + 重建索引(导师) + 知识图谱(76节点58边)。
- 学生端知识库导航从「科研工具」移至「核心」段。
- 缓存版本075→076。

### 修复
- 补齐Wave 8后端已实现但前端缺失的知识库UI(上个session只做了后端,前端页面没建)。

---

# AutoProf LabOS — 变更日志

版本规则:`0.<Wave>.<patch>`。Wave = 路线图波次,patch = 同波次内修复。
详见 `DEVLOG.md`(带时间戳的开发日志)。本文件按 Wave 聚合用户可见变更。

---

## [0.4.0] — 2026-08-18 (Wave 4)

### 新增
- **F20 AI 面试/答辩模拟**:4 场景(毕业答辩 / 项目答辩 / 求职面试 / 问答练习)+ SSE 流式问答 + 教练模式(分析问题意图 + 推荐回答策略)。导师端"面试"Tab,学生端"面试练习"Tab。

### 修复
- `.gitignore` 补全:`_test_*.mjs` / `_healthcheck.mjs` 排除。
- Git 仓库初始化完成(commit `cecb329`, 178 files)。

---

## [0.3.0] — 2026-08-18 (Wave 3: 教学行政减负)

### 新增
- **F11 排座**:snake/serial/random 三种排座模式 + 历史管理 + 前端表格展示。
- **F13 工作量**:教学/科研工作量计算(数字 + 数组双模式)+ 可配置系数。
- **F14 记账**:发票 CRUD + 分类统计。
- **F15 备课**:SSE 流式中文教案(教学目标/重难点/时间分配/教学过程/板书/作业/演讲稿大纲)+ 历史管理。

### 修复
- `lib/workload.js` 参数类型兼容(数字 count vs 数组对象)。

---

## [0.2.5] — 2026-08-18 (Wave 2.5: 仪表盘 + 桥接)

### 新增
- **全局概览仪表盘**:`GET /api/dashboard` + 导师端"总览"Tab(统计栏 + 12 学生卡片网格 + 一键简报)。15 秒看 15 个学生全貌。
- **F19 审稿模式**:工具箱 Tab 审稿入口,复用 `/api/skills/:name` SSE。
- **F17 CLI 桥接**(`labos.mjs`):login/tasks/report/meeting/brief/news/submissions/dashboard。LabOS ↔ Codex 打通,CLI 可编程。
- **F5 进度→周报草稿**:`lib/progress.js` 读 Codex 历史 → AI 生成周报草稿,学生端"AI 辅助填写"。
- **F6 上下文 skill 入口**(横切):仪表盘风险→审稿检查、看板阻塞→方向评估、学生提交→paper-polish 润色。

### 修复
- `labos.mjs` getBaseUrl() 环境变量优先级 + `.env PORT=3001` 统一。

---

## [0.2.0] — 2026-08-17 (Wave 2: 协作闭环)

### 新增
- **F2 会议纪要→行动指令**(文本模式):听记 MD → DeepSeek 抽取决议 + 行动项 → 按姓名匹配 students.yaml → 导师改派 → 学生只读查看。服务端 name→id 权威匹配,防 LLM 幻觉 ID。
- **F3 任务看板**:`lib/kanban.js` todo/in_progress/done/blocked 四态看板 + 会议行动项一键提升为任务。
- **F9 RSS 每日新闻**:arXiv + IEEE Spectrum 抓取,看板欢迎页展示。
- **F18 邮箱→看板**:IMAP 拉取未读 → AI 抽取待办 → 看板任务。
- **F2 语音 STT**:FunASR + SenseVoice(需 CUDA),WebSocket 实时转写,Web Speech API fallback。
- 群聊功能(chatroom)+ AI 入群讨论 + 课题组记忆(memory.js)+ 每日新闻摘要(news.js)。

---

## [0.1.0] — 2026-08-17 (Wave 1: 周报核心)

### 新增
- **F1 周报闭环**(Lab Brief):学生 MD 在线编辑 + 实时预览 + 提交 → DeepSeek 生成总结/风险/建议 → 导师分屏(左 AI 聊天 SSE / 右 学生周报渲染)。
- 登录认证(角色:本科生/研究生/老师,cookie session)。
- Vue 3 via CDN + marked.js,无构建。
- Express 5 后端 + DeepSeek AI(OpenAI 兼容)。

---

## [0.0.1] — 2026-08-17 (Wave 0: 地基)

### 新增
- `lab-brief` Cordis 插件骨架(parser / risk / brief)。
- 12 份样例周报(s01-s12 / 2026-W33.md)。
- `labos/students.yaml` 学生花名册。
- 周报 MD 模板(frontmatter + 6 section)。

---

## 架构状态备忘

- **W1–W4 全程**:server.js 直接 import lib/* 函数调用(**Cordis-shaped,非 Cordis-hosted**)。
- 16 个 lib 模块导出 `apply(ctx, config)` 但**无人调用**(facade stub)。
- `labos/cordis.yml` 注册 3 插件(timer/logger/lab-brief),但 server.js 只读它取配置值,**未起 `packages/loader` runtime**。
- 真 Cordis runtime(`packages/core` Registry/Fiber、`packages/loader` YAML 加载)**闲置未用**。
- 计划 W3 起接入真实 runtime;当前 14 功能均跑在直接 import 路径上。
