## v0.7.31 (2026-08-23) — Roadmap 2.3 Written

  * Docs: roadmap2.3.md — 功能精细化打磨 + Agent Loop 引入计划
  * Analysis: 当前周报架构完整路由时序图 + 6 个核心问题诊断
  * Decision: Waku 单智能体 Agent Loop（~60行 JS），非多智能体
  * Plan: 5 Phase（周报打磨 -> Agent Loop -> 任务 -> 会议 -> 本科课堂）

## v0.7.30 (2026-08-23) — Repository renamed to EvoTeam

  * Rename: GitHub repo AutoProf-LabOS to EvoTeam
  * Rename: local folder cordis-main to EvoTeam
  * Refactor: 24 hardcoded path references updated
  * Package: name changed from @root/cordis to evoteam
  * Git: remote updated to https://github.com/njtdf/EvoTeam.git

## v0.7.30 (2026-08-22) — Sidebar Collapse Toggle

  * Feature: ◀ collapse button in sidebar header; ☰ floating restore button
  * Fix: student.js line 843 syntax error (broken const declaration)
  * CSS: smooth sidebar width transition
  * Maintenance: cache-bust v07.30

# CHANGELOG

## v0.7.30 (2026-08-22) - Wave 8b: Meeting->Task Flywheel + Task Refinement + Report Risk->Task

### Backend
- GET /api/tasks: Added is_overdue field
- POST /api/meeting/upload: Auto-chained autoExtractFromMeeting for promise ledger
- POST /api/tasks/from-meeting: already_promoted check + default deadline
- POST /api/tasks/from-meeting/bulk (NEW): Batch promote meeting actions
- POST /api/tasks/from-risk (NEW): Create task from weekly report risk
- POST /api/tasks/batch-deadline (NEW): Set default deadlines
- GET /api/report-context: Added done_tasks

### Frontend (Teacher)
- Meeting: Promote All button + Promoted badge
- Kanban: View toggle + Set Deadlines button + overdue highlight
- Report: Risk Track button

### Frontend (Student)
- Feedback panel: Shows done_tasks alongside open_tasks

### CSS
- .task-card.overdue: red left border + red background
- tr.unmatched: yellow background

### Data Flywheel
- Report risk -> Track button -> Kanban task
- Meeting -> AI extract -> Promote All -> Kanban + Promise ledger
- Task deadline -> Calendar event
- Task completion -> flywheel -> report Done Tasks

---
## v0.7.29 (2026-08-22) — 修复全局聊天框打字时自动收起

### Fixes
- 底部 AI AGENT 聊天栏打字时自动最小化：新增 onChatMouseLeave() 检查输入框焦点，焦点在输入框时不收起
- 影响: teacher.html + student.html + teacher.js + student.js

---

## v0.7.28 (2026-08-22) — 删旧 Agent + C-Level 英文名 + sub-tab CSS + 文件夹精简

### Breaking
- **删除旧任务级 Agent 系统**: agents=ref([])，sendAgentChat/activeAgentId 等全部移除。自定义 Agent 仍可创建但不再有预设任务级 Agent
- **删除 9 个 cordis packages**: core/create/group/hmr/include/loader/logger-console/timer/utils，仅保留 lab-brief

### Fixes
- C-Level 卡片名称改为英文在前: "CEO 首席执行官" 格式
- sub-tab 绿字绿底不可见 → 浅绿底+深绿字
- 删除嵌套空目录 cordis-main/cordis-main
- 删除无用 TS 配置文件

### Verified
- Login / 版本 / Teacher 页面 / CEO SSE chat / 7 C-Level agents / DIV 平衡 620-620

---

## v0.7.27 (2026-08-22)

### Fixed
- 修复 teacher.html DIV 不平衡 (636/637→636/636)：坏行 `</div> — 点击"创建 Agent"添加</div>` 改为正确闭合
- Agent 实时状态页从旧任务级 Agent 替换为 7 位 C-Level 智能体 (CEO/CFO/CTO/CMO/CAIO/CBO/CHO)
- 旧任务级 Agent 保留在 C-Level 下方 (opacity 0.7) 作为过渡

### Verified
- 登录 / 页面加载 / 版本匹配 / SSE 流式聊天 全部 200
- `selectCLevelAgent()` 点击 → 全局聊天栏展开 + 自动选中该智能体

## v0.7.26 (2026-08-22) C-Level Agents + Context-Aware Global Chat

### Added
  * 7 C-Level Agents: CEO CFO CTO CMO CAIO CBO CHO each with dedicated system prompt
  * Agent dropdown in global chat bar (teacher side)
  * Context-aware auto-switching: bottom bar auto-selects agent based on current tab
  * Agent tab grid confirmed working

### Fixed
  * Teacher branch in /api/global-chat was overriding agent_id with hardcoded prompt
  * SyntaxError from AGENT_PROMPTS inserted mid-statement

### Changed
  * Student global chat defaults to CAIO agent
  * Global chat bar: static text to interactive dropdown


## v0.7.25 (2026-08-22)

### Changed
- Moved Agent team grid + chat panel from dashboard to Agent tab
- Renamed "AI 助手" to "AI AGENT" across all pages
- Global AI bar: auto-collapse on mouseleave (click to expand, move away to close)

## v0.7.24 (2026-08-22)

### New
- Global AI chat bar on all pages (50vh expand on click)

### Improved
- Teacher weekly report: stat bar + student cards, no brief button
- Todo: filtered by current user only
- Ideas: kept RSS, removed daily brief

### Fixed
- streamChat: chunk/content compat + [DONE] handling
- global-chat SSE: callback mode instead of for-await
- APP_VERSION syntax fix (= not :)

### Removed
- Daily Brief tab from teacher and student

## v0.7.23 (2026-08-22)
- 灵感工厂: RSS研究动态从任务看板移入，去掉"每日信息"文案
- 学生端灵感工厂新增RSS加载

## [0.7.22] - 2026-08-22

### New
- **Task stats bar** (student kanban): total/todo/in_progress/done/overdue + progress %
- **Default deadline** (teacher create task): auto-fills today+7 days
- **Ideas sharing MVP**: students can save AI spark results and share to group; shared ideas wall with like/react buttons; cross-user visibility

### API
- `GET /api/ideas?shared=true` — all shared ideas from all users
- `POST /api/ideas/:id/like` — toggle like (liked_by array)
- `POST /api/ideas` now accepts `shared` field

## [0.7.21] - 2026-08-22

### 新增
- **价值目标树** (`lib/goal-tree.js`): 课题组组织地图 — 研究方向→学生课题→任务三级树, 含进度条+依赖链路
- **每日信息** (`/api/daily-brief`): 今日待办+逾期+进行中+外部动态+目标树概览, 教师看全局学生看自己
- **灵感工厂** (`lib/ideas.js` + SSE): AGENT读取每日信息+目标树, 结合用户输入, DeepSeek流式生成研究想法
- 教师端: 价值链Tab展示目标树, 核心段每日信息, Agent段灵感工厂
- 学生端: 核心段每日信息(只看自己), Agent段灵感工厂(只看自己)

### 修复
- 价值目标树进度条 NaN 文本残留 → 替换为 CSS progress-fill div
- student.js hash 路由 await 语法错误 → 改为 fire-and-forget 调用

### API
- `GET /api/goal-tree` — 价值目标树 (8方向/18学生/40任务)
- `GET /api/goal-tree/dependencies` — 依赖映射 (18节点/75链接)
- `GET /api/daily-brief` — 每日信息聚合 (教师全局/学生个人)
- `GET /api/ideas` / `POST /api/ideas` / `DELETE /api/ideas/:id` / `PUT /api/ideas/:id/status`
- `POST /api/ideas/spark` — SSE 流式灵感生成

# Changelog

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
- `GET /api/reports/:id` — 学生全部历史周报列表
- `GET /api/report/:id?file=filename` — 按文件名加载特定周报

## v0.7.19 (2026-08-22)

### Fixed
- **Student kanban white screen**: misplaced gradSummary.template_note in kanban section caused null.template_note TypeError. Removed.
- Scanned all ref(null) vars for unguarded template access, confirmed no other crash points.

## v0.7.18 (2026-08-22) — Critical Bug Fix

### Fixed
- **导师端黑屏乱码**: `teacher.js` 中 `courseData` 等5个变量被误放在 return 块外部,导致 `ReferenceError` → Vue 不 mount → 黑屏。已移入 return 块内。
- **研究生端日历全白**: `student.html` 缺少日历内容模板 (`v-if="activeTab==='calendar'"`),点击日历 Tab 无内容渲染。已添加完整的日历模板。
- **index.html 版本号严重滞后**: `v=075` 从未随版本链更新,导致浏览器加载缓存旧文件 → `checkVersion()` 无限重载 → 黑屏。已更新为 `v=0718`。
- **meeting-live.html 版本号滞后**: `v=070`/`v=060` 同步更新为 `v=0718`。
- 全部HTML文件版本号统一为 `v=0718`,VERSION 和 api.js APP_VERSION 同步为 `0.7.18`。

# Changelog

## v0.7.17 (2026-08-22)

### Added
- Course page MVP: Power System Fundamentals (电力系统基础)
- lib/course.js: course data management (load/list/detail/update week)
- labos/courses/电力系统基础.json: full course data from syllabus + OBE plan docx files
- 4 API routes: GET /api/courses, GET /api/course/:name, PUT /api/course/:name/week, GET /api/course/:name/progress
- Teacher: Course tab (5 subtabs: schedule/objectives/chapters/assessment/resources) + week editor
- Student: Course tab (same view, read-only, no week editing)
- Course progress bar: overall (week/total * 100%) + week-level current/past/future colors
- 9 chapters, 17 weeks, 4 objectives (grad req 1-3/2-2/4-4/11-3), 6 assessment items

### Changed
- Version 0.7.16 to 0.7.17

## v0.7.16 (2026-08-22)

### Added
- Student profile page (teacher): card grid + detail modal with graduation/tasks/capability/consistency
- Student-side profile tab: graduation progress + task progress + capability radar + consistency index
- Task progress bars on kanban cards
- Lab graduation progress on dashboard overview
- 3 API routes: GET /api/student-profiles, GET /api/student-profile/:id, GET /api/lab-progress
- lib/student-profile.js: aggregates all student data

### Fixed
- Student dropdown invisible: CSS white-on-white to var(--card)+var(--text)
- Removed consistency index from dashboard (moved to student profile)

### Changed
- Version 0.7.15 to 0.7.16
- Undergrad accounts exist: u01/u02/u03 (changeme)

## v0.7.15 — Phase 4: 李开复执行闭环引擎 (2026-08-21)

### 新增: 承诺账本 (Promise Ledger)
- `lib/promise-ledger.js`: 4 大组件 — 承诺账本 CRUD / 目标树 / 逾期预警 / 言行一致指数
- 会议纪要 → AI 自动抽取承诺 (谁承诺了什么, 给谁, 何时交付)
- 姓名→ID 权威匹配, 防幻觉 ID
- 180 天滚动窗口计算言行一致指数 (A/B/C/D 评级)
- deadline 前 7 天主动预警, 3 天紧急预警
- 目标树: 课题组目标 → 项目 → 学生任务, 计算分支偏差

### 新增: AI 承诺抽取
- `lib/ai.js` `extractPromises()`: DeepSeek JSON 抽取, temp 0.1

### 新增: 飞轮集成
- `lib/flywheel.js` meeting_ended 管道: 上传会议自动抽取承诺

### 新增: 8 条 API 路由
- GET/POST /api/promises, /api/promises/stats, /overdue, /upcoming, /consistency, /goal-tree, /extract/:date, PUT /:id/fulfill

### 前端
- 总览: 逾期预警栏 + 承诺账本面板 + 言行一致指数网格
- 任务: 任务详情 modal + 增强卡片样式
- CSS: Phase 4 + 承诺/一致性/逾期/目标树 全套样式

### 验证
- API 全部 200, AI 抽取 3 条承诺全部匹配, 一致性指数/目标树/逾期预警 数据正确

## v0.7.14 (2026-08-21)

### Phase 3: 周报精打磨 — 飞轮双向回流
- **新增 API**: `GET /api/report-context/:id` — 返回结构化上下文(上次AI总结风险/建议 + 会议行动项 + 未完成任务 + 飞轮最近事件 + 本体关联)
- **修改 API**: `POST /api/submit` — response 增加 `flywheel: true` 确认字段
- **学生端**: 周报编辑器上方新增"上次反馈"折叠面板(风险标签/建议/会议行动/未完成任务/飞轮状态)
- **导师端**: cockpit 右侧新增"飞轮上下文"卡片(任务列表/会议行动/飞轮事件/本体关联)
- **修复**: v-if/v-else-if 链断裂 bug (飞轮卡片独立 v-if,不干扰 report 条件链)
- **数据流**: 周报→飞轮→下次周报反馈 双向闭环

## [0.7.13] - 2026-08-21

### Added
- **lib/flywheel.js**: 飞轮回流引擎——4条事件管道 (report_submitted/meeting_ended/task_done/paper_indexed)，异步执行，单步失败不中断
  - trigger(event, payload) fire-and-forget，不阻塞 HTTP
  - buildFlywheelContext(studentId) 聚合最近总结/任务/会议/轨迹/关联/事件
  - 日志: labos/flywheel-log.json (ring buffer 200条)
- **server.js**: 3处事件源挂载飞轮 trigger (周报提交/会议抽取/任务完成)
- **server.js**: 2条 flywheel API (stats/log)
- **lib/ai-context.js**: AI对话上下文注入飞轮——AI有了导航系统

### Changed
- 版本 0.7.12 -> 0.7.13
- teacher.html / student.html cache-bust v=0713

## [0.7.12] - 2026-08-21

### Added
- **lib/ontology.js**: 组织地图 (Ontology 2.0) — 8类实体 + 9种关系，从现有数据源自动构建147条关系
  - getEntityGraph 一次查询展开学生完整关联图（项目/周报/任务/会议/总结）
  - 自然语言 CRUD: 导师用自然语言添加关系
  - apply(ctx, config) Cordis 形态
- **server.js**: 7条 ontology API 路由 (stats/entities/graph/search/relation CRUD/nl)
- **lib/ai-context.js**: AI 对话上下文自动注入本体图——AI 有了地图

### Changed
- 版本 0.7.11 -> 0.7.12
- teacher.html / student.html cache-bust v=0712

## [0.7.11] - 2026-08-21

### Fixed
- Graduation page student-select invisible on light background: global .student-select set color:#fff for dark headers. Added .graduation-view .student-select with !important override (white bg + dark text + border)
- Graduation bar class name mismatch: HTML used graduation-bar-container/graduation-bar-fill, CSS only had outer/inner. Added missing definitions

### Verified
- Playwright computed styles: background=rgb(255,255,255), color=rgb(51,51,51), border=1px solid
- 16 student options load correctly (s01-s12 + u01-u03)
- Selecting s01 shows correct graduation data (master, 15%, 1/10, high risk)
- Roadmap 2.1 audit: 10/13 waves complete, W6c=manual, W11/W13=deferred

## [0.7.10] - 2026-08-21

### Added
- **W9 writeBackFromSummary**: real state transition — auto-update capability, trigger rewards, detect graduation progress from report content
- **W10 external-events.js**: external perception layer (RSS news + email to unified events to LabState injection), 6 API routes
- **W12 skill-extractor.js**: semi-auto skill extraction from trajectories (how_to + code_snippet patterns), 4 API routes
- **W14 LabOS Cockpit**: /api/cockpit global aggregation endpoint (labState + boardStats + riskRadar + growth + graduation + events + rewards)
- **W15 Value Cycle Dashboard**: /api/value-cycle-dashboard alignment scoring (graduation 40% + tasks 30% + reports 20% + risk-inverse 10%), team_score + per-student breakdown
- 16 new API routes total across W9/W10/W12/W14/W15

### Changed
- ai-context.js writeBackFromSummary fully rewritten (7-step state transfer)
- HTML cache params bumped to ?v=0710
- APP_VERSION to 0.7.10

### Roadmap 2.1 Status
- W6a-W10, W12, W14-W15: Complete
- W6c: deferred (requires manual data entry by PI)
- W11 (AG-UI), W13 (A2A): deferred (require frontend framework rebuild + cordis runtime)


## [0.7.9] - 2026-08-21

### Added
- **W6b Decisions Frontend**: decisions list with outcome selector + delete, integrated with /api/decisions API
- **W7b Kanban State Machine**: transition guards (canTransition), valid transitions query, transitionTask with evidence trail (transition_history)
- **W8 lab-state.js**: LabState aggregator (students/tasks/reports/rewards/risks) + reward signal CRUD
- 7 new API routes: /api/tasks/:id/transitions, /api/tasks/:id/transition, /api/lab-state, /api/rewards[/:studentId], /api/rewards/:rewardId

### Changed
- addDecision() upgraded to /api/decisions/:studentId
- HTML cache params bumped to ?v=079
- APP_VERSION to 0.7.9

## [0.7.8] - 2026-08-21

### Added
- **lib/graduation.js**: 3 NNU standard graduation requirement templates (master 10/phd 8/bachelor 6) + weighted progress + risk auto-calc + DB/KB sync + Cordis apply
- **6 API routes**: GET /api/graduation/:id, /all, /categories, /template/:role; POST /seed; PUT /requirement/:reqId
- **Teacher graduation page**: progress bar + stats + requirement list grouped by category (editable) + reset template button
- **Student read-only graduation page**: progress bar + stats + requirement list (no edit)
- **scripts/verify-weekly-loop.mjs**: e2e weekly report core loop verification
- Seed data: 18 students graduation requirements filled, KB indexed 18 docs

### Fixed
- Handoff misdiagnosis: switchToCockpit already calls loadStudents (teacher.js:66)
- Audit script false positives: cockpit/meeting/kanban tagged PLACEHOLDER but have full code

### Changed
- Version: 0.7.7 -> 0.7.8 (major change = 3rd digit, new module + new feature)
- Cache params: teacher.html / student.html ?v=077 -> ?v=078
- api.js APP_VERSION: 0.7.6 -> 0.7.8
# AutoProf LabOS — Changelog

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

