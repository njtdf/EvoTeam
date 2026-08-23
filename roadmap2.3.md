# EvoTeam Roadmap 2.3 — 功能精细化打磨 + Agent Loop 引入

> 对应 Roadmap 1.0 / 2.0 / 2.1 / 2.2 的后续。核心策略：**不加新功能，不加新依赖，只打磨已有功能到端到端可用**。
> 版本：v0.7.30 -> v0.8.0

---

## 0. 当前周报架构分析（大白话）

### 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 前端 | Vue 3 (CDN) + marked.js | 无构建步骤，浏览器直接加载 |
| 后端 | Express 5 (Node.js) | 单文件 server.js，约 2300 行 |
| AI | DeepSeek API (chat-completions) | SSE 流式输出 |
| 存储 | 文件系统 (JSON + YAML + MD) | 无数据库（SQLite 在 Wave 8 已建但未接入周报） |
| 上下文 | ai-context.js (7 层) | 价值链 + 能力画像 + 毕业状态 + 记忆 |

### 周报路由时序

```
学生端：
  打开周报 Tab
    -> GET /api/report-context/:id     ← 上次反馈（总结+任务+会议行动项+飞轮事件）
    -> GET /api/reports/:id            ← 历史周报列表
    -> GET /api/report/:id             ← 最新周报全文
    -> GET /api/summary/:id            ← AI 总结卡片
    -> GET /api/chat/:id               ← 聊天历史

  写周报
    -> 点击 "加载模板"                  ← 前端 generateTemplate()
    -> 点击 "AI 辅助草稿"
       -> GET /api/progress/:id/draft  ← lib/progress.js
          -> readCodexHistory()        ← 读 ~/.codex/memories/rollout_summaries/
          -> 如果有历史 → chatStream() 生成草稿
          -> 如果没有历史 → 返回空模板
    -> 编辑 Markdown
    -> POST /api/submit                ← 保存 .md 文件
       -> generateAndSaveSummary()     ← 异步调 AI 生成总结
       -> flywheelTrigger()            ← 触发数据飞轮

导师端：
  选学生 -> onStudentChange()
    -> Promise.allSettled([
         /api/report/:id,              ← 周报全文
         /api/summary/:id,             ← AI 总结
         /api/chat/:id,                ← 聊天历史
         /api/report-context/:id       ← 上下文
       ])
  聊天 -> POST /api/chat/:id (SSE)
    -> buildStudentContext()           ← 7 层上下文
    -> injectContext()                 ← 注入记忆
    -> chatStream()                    ← DeepSeek SSE 流式
```

### 核心问题诊断

| 问题 | 根因 | 影响 |
|---|---|---|
| AI 草稿依赖 Codex 历史 | progress.js 只读老师的 Codex rollout | 12 学生中仅 1-2 人有历史，其余返回空模板 |
| 周报上下文没用于草稿 | report-context 已有任务+会议+上次总结，但草稿生成不用它 | 学生不知道上次该做什么 |
| 提交后无即时反馈 | submit 返回 ok 但 UI 无 toast | 学生不确定是否提交成功 |
| 历史列表粗糙 | 只有文件名+摘要，不可点查看 | 无法回顾上周报告 |
| 导师聊天与周报混在右栏 | 布局未分屏 | 汤老师要求：聊天左、周报右 |
| Agent 是空壳 | 只有 system prompt，无工具调用循环 | AI 无法查任务/读周报/创建任务 |

---

## 1. Agent 架构决策：为什么选 Waku 单智能体

### 四个参考仓库对比

| 仓库 | 核心模式 | 适配 EvoTeam？ | 理由 |
|---|---|---|---|
| **Waku** | while 循环 + 工具调用，95 行 Python | **选这个** | 最薄，一个函数搞定，JS 移植约 60 行 |
| Pi | Agent 类 + 事件流 + 队列 | 不选 | 过度工程化，单课题组不需要状态机 |
| QM | Scope 隔离 + 插件沙箱 | 不选 | 场景不匹配，EvoTeam 是单实验室非多租户 |
| Multica | daemon + MCP + 技能市场 | 不选 | 需要 Go daemon 常驻进程，运维复杂 |

### 决策：单智能体，非多智能体

理由：
1. 周报场景只有 2 个角色（学生写、导师审），不需要多 Agent 协商
2. 多 Agent 协作的收益在于"跨域任务分解"，周报不跨域
3. 单 Agent + 工具调用足够：AI 自己决定查什么、读什么、建议什么
4. Waku 的循环本质就是 `while not done: LLM(messages, tools) -> if tool_calls: execute -> observe -> repeat`

### Agent Loop 设计（lib/agent-loop.js，约 60 行）

```javascript
// 核心：observe -> reason -> act -> repeat
export async function runAgentLoop({ system, messages, tools, maxIter = 5 }) {
  for (let i = 0; i < maxIter; i++) {
    // 1. Reason: 调 LLM，附带工具定义
    const response = await callLLM(system, messages, tools)
    // 2. 如果没有工具调用 -> 直接返回
    if (!response.tool_calls) return response.content
    // 3. Act: 执行工具
    messages.push({ role: "assistant", content: response.content })
    for (const call of response.tool_calls) {
      const result = await tools[call.name](call.arguments)
      messages.push({ role: "tool", name: call.name, content: result })
    }
    // 4. Observe: 结果已加入 messages，下一轮 LLM 能看到
  }
  return "迭代次数耗尽"
}
```

### 周报 Agent 的 5 个工具

| 工具 | 输入 | 输出 | 用途 |
|---|---|---|---|
| `read_last_report` | student_id | 上周周报全文 | 学生写新周报时参考上周 |
| `read_report_context` | student_id | 任务+会议行动项+上次总结 | 帮学生回顾"上周该做什么" |
| `read_summary` | student_id | AI 总结(风险+建议) | 导师审稿时看 AI 分析 |
| `read_student_tasks` | student_id | 未完成任务列表 | 了解学生当前负担 |
| `create_task` | {title, owner, deadline} | 新任务 ID | 导师一键从风险创建跟踪任务 |

### 两个 Agent 端点

| 端点 | 角色 | 功能 |
|---|---|---|
| `POST /api/agent/report-draft` | 学生 | Agent 读上周周报+任务+会议行动项，生成结构化草稿 |
| `POST /api/agent/report-review` | 导师 | Agent 读学生周报+总结+价值链，给出审阅意见+风险标注 |

---

## 2. 五阶段实施计划

### Phase 1: 周报端到端打磨 (~3h)

**学生端 (student.js + student.html)**

| 改动 | 现状 | 目标 |
|---|---|---|
| 进入周报 Tab 自动加载模板 | 需手动点"加载模板" | onMounted 自动调 generateTemplate() |
| AI 草稿改用 report-context | 依赖 Codex 历史(多数失败) | 调 /api/agent/report-draft，用上周周报+任务生成草稿 |
| 提交反馈 | 无 toast | 提交成功 -> toast "提交成功，AI 正在生成总结" |
| AI 总结轮询 | 有 startPollingSummary | 验证：提交后 3 秒开始轮询，总结出现即停止 |
| 历史周报列表 | 只有文件名 | 列表 -> 点击 -> 渲染全文 + AI 总结 + 导师评语 |
| "上次反馈"面板 | 已有 reportContext | 验证显示：未完成任务 / 已完成任务 / 会议行动项 |

**导师端 (teacher.js + teacher.html)**

| 改动 | 现状 | 目标 |
|---|---|---|
| 学生下拉框可见性 | CSS 已修 | 验证：白底黑字，hover 高亮 |
| 选学生并行加载 | onStudentChange 已用 allSettled | 验证：4 个请求并行，任一失败不影响其他 |
| 布局：聊天左 / 周报右 | 之前混在右栏 | 左 40% 聊天框 + 右 60% 周报渲染 |
| AI 总结卡片 | 有时不显示 | 每个学生稳定展示总结卡片(风险+建议) |
| 风险->任务按钮 | Wave 8b 已建后端 | 每个 risk 旁加按钮，点击创建跟踪任务 |

**验收标准**
- 学生登录 -> 3 秒看到"上次反馈"面板 + 空编辑器(已加载模板)
- 点"AI 辅助草稿" -> 30 秒内生成基于上周内容的草稿(非空模板)
- 提交 -> toast 出现 + 3 秒后 AI 总结卡片出现
- 导师选学生 -> 5 秒内周报+总结+聊天全部加载完毕

---

### Phase 2: Agent Loop 引入 (~2h)

**新建 lib/agent-loop.js**
- `runAgentLoop({ system, messages, tools, maxIter })` — Waku 风格循环
- `callLLM()` — 封装 DeepSeek API 调用，附带 tools 参数
- 5 个工具函数：read_last_report / read_report_context / read_summary / read_student_tasks / create_task
- SSE 流式：Agent 思考过程逐字推送

**server.js 新增 2 路由**
- `POST /api/agent/report-draft` (student) — Agent 读上下文 -> 生成草稿 -> SSE 推送
- `POST /api/agent/report-review` (teacher) — Agent 读周报+总结 -> 审阅意见 -> SSE 推送

**前端集成**
- 学生端 generateDraft() 改为调 /api/agent/report-draft
- 导师端周报 Tab 新增"AI 审阅"按钮 -> 调 /api/agent/report-review

**验收标准**
- 学生点"AI 辅助草稿" -> Agent 调用 read_report_context -> 基于任务+会议生成草稿(非空模板)
- 导师点"AI 审阅" -> Agent 调用 read_summary -> 输出审阅意见
- Agent 工具调用可见(前端显示"正在读取上周周报..."等状态)

---

### Phase 3: 任务精细化 (~2h)

| 改动 | 说明 |
|---|---|
| 补全截止日期 | /api/tasks/batch-deadline 给无 deadline 任务设 today+7 |
| 逾期高亮 | 任务卡片红色左边框 + 逾期徽章 |
| 日历集成 | /api/calendar/events 取任务 deadline 作为日历事件 |
| 按项目分组 | 看板视图切换：按状态(4列) / 按项目 |
| 任务详情 modal | 点击卡片 -> 详情(含 transitions 历史) |
| 会议->任务 promote | 验证一键提升端到端跑通 |

**验收标准**
- 所有任务有截止日期，逾期任务红色高亮
- 日历页面显示任务 deadline 事件
- 看板可切换"按项目"视图

---

### Phase 4: 会议精细化 (~2h)

| 改动 | 说明 |
|---|---|
| 一键全部提升 | 行动项表格上方按钮，批量 promote |
| 未匹配 owner 高亮 | 行高亮黄色 + 提示"请先指派负责人" |
| 已提升徽章 | 检查 source_ref，显示"已提升"标记 |
| STT->纪要串联 | sttSummarize 成功后填入 meetingContent，提示上传 |
| 会议议程模板 | 上传纪要时可选加载标准模板 |

**验收标准**
- 上传纪要 -> AI 抽取 -> 一键提升 -> 看板任务增加
- 未匹配 owner 的行动项黄色高亮
- STT 转写 -> 总结 -> 上传为纪要 -> 走抽取流程

---

### Phase 5: 本科课堂 MVP (~2h)

| 改动 | 说明 |
|---|---|
| 课程页面 | lib/course.js MVP，课程列表+详情 |
| 进度条 | 从入学到毕业的进度条(基于 valuecycle) |
| OBE 矩阵 | 从已提供的教学大纲 docx 提取 OBE 矩阵 |
| 课件管理 | 复用知识库 KB 索引课件文档 |

**验收标准**
- 教师端可见课程列表，点击进入课程详情
- 课程详情显示 OBE 矩阵 + 课件列表
- 进度条显示课程完成度

---

## 3. 数据飞轮闭环

```
周报提交
  -> AI 总结 (风险+建议)
     -> 导师一键从风险创建跟踪任务 (Phase 1)
        -> 任务看板 (Phase 3)
           -> 学生执行 -> 改状态
              -> 任务完成 -> 飞轮触发
                 -> 下周周报 "上次反馈" 引用已完成任务
                    -> 新的周报提交 (循环)

会议纪要
  -> AI 抽取行动项
     -> 一键提升为任务+承诺 (Phase 4)
        -> 任务看板
           -> 承诺账本跟踪兑现
              -> 言行一致指数
```

---

## 4. 约束与原则

- **不加新功能**：只打磨已有功能的端到端体验
- **不加新依赖**：用现有 lib/ 模块 + DeepSeek API
- **不碰后端逻辑**：只加路由 + 接入已有函数
- **Agent 是增强不是替代**：Agent 辅助生成草稿，学生必须审核编辑后才能提交
- **版本号**：0.7.30 -> 0.8.0 (Phase 2 Agent Loop 是架构性改动，值得 minor bump)
- **Git**：推送到 https://github.com/njtdf/EvoTeam.git，master 分支
- **工作目录**：D:\OneDrive\7-SideWork\AutoProf\EvoTeam
- **服务器**：Port 3001

---

## 5. 实施顺序

1. Phase 1: 周报端到端打磨 -> DEVLOG -> 验证
2. Phase 2: lib/agent-loop.js + 2 路由 + 前端集成 -> DEVLOG -> 验证
3. Phase 3: 任务精细化 -> DEVLOG -> 验证
4. Phase 4: 会议精细化 -> DEVLOG -> 验证
5. Phase 5: 本科课堂 MVP -> DEVLOG -> 验证
6. bump 0.8.0 + CHANGELOG + git push

---

## 6. 本学期目标

周报、任务、会议三个核心循环端到端可用，学生和导师每天/每周愿意用。
本科课堂 MVP 可用：课程页面 + OBE 矩阵 + 课件管理。
数据飞轮转起来：周报->任务->执行->反馈->下周周报。

> 不追求功能数量，追求每个功能真正可用。
