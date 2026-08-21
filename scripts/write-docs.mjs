import { appendFileSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const parentDir = join(process.cwd(), '..')
const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })

const devlog = `

## 2026-08-21 ${now} — v0.7.9 W6b decisions frontend + W7b kanban state machine + W8 lab-state.js

### [确定] Decisions 前端 API 集成 (W6b)
- teacher.js: addDecision 升级为调用 /api/decisions/:studentId (替代旧 /api/valuecycle/:id/decision)
- 新增 loadDecisions / deleteDecision / updateDecisionOutcome
- teacher.html: 决策列表从 decisionsList 渲染，支持 outcome 下拉 + 删除
- selectVcStudent() 加载学生时自动调 loadDecisions

### [确定] W7b: kanban.js 状态机
- VALID_TRANSITIONS: todo/in_progress/blocked/done 转换图
- canTransition / getValidTransitions / transitionTask (含 evidence trail)
- transition_history: [{from, to, evidence, timestamp, actor}]
- server.js 新增 2 路由

### [确定] W8: lab-state.js 新建
- LabState 聚合: 15 students / 40 tasks / 12 reports / 25 risks
- 奖励信号 CRUD: recordReward / getRewards / getLabRewardSummary
- server.js 新增 5 路由

### [确定] 验证通过
- LabState: 15/15 students, 12/15 reports, 40 tasks, 25 risks
- 奖励: POST 存入 rewards.json, GET 查询正常
- Kanban: T-001 done->in_progress 成功, transition_history 记录证据
`
appendFileSync(join(parentDir, 'DEVLOG.md'), devlog, 'utf-8')
console.log('OK DEVLOG')

// CHANGELOG
const clPath = join(parentDir, 'CHANGELOG.md')
const cl = readFileSync(clPath, 'utf8')
const entry = `## [0.7.9] - 2026-08-21

### Added
- **W6b Decisions Frontend**: decisions list with outcome selector + delete, integrated with /api/decisions API
- **W7b Kanban State Machine**: transition guards (canTransition), valid transitions query, transitionTask with evidence trail (transition_history)
- **W8 lab-state.js**: LabState aggregator (students/tasks/reports/rewards/risks) + reward signal CRUD
- 7 new API routes: /api/tasks/:id/transitions, /api/tasks/:id/transition, /api/lab-state, /api/rewards[/:studentId], /api/rewards/:rewardId

### Changed
- addDecision() upgraded to /api/decisions/:studentId
- HTML cache params bumped to ?v=079
- APP_VERSION to 0.7.9

`
const lines = cl.split('\n')
const idx = lines.findIndex(l => l.startsWith('## [0.7.8'))
if (idx >= 0) {
  lines.splice(idx, 0, ...entry.trim().split('\n'), '')
  writeFileSync(clPath, lines.join('\n'), 'utf-8')
  console.log('OK CHANGELOG')
} else {
  writeFileSync(clPath, entry + cl, 'utf-8')
  console.log('OK CHANGELOG prepended')
}
