import { appendFileSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
const parentDir = join(process.cwd(), '..')
const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })

const devlog = `

## 2026-08-21 ${now} — v0.7.10 W9/W10/W12/W14/W15 (Roadmap 2.1 剩余波次)

### [确定] W9: writeBackFromSummary 状态转移升级
- ai-context.js writeBackFromSummary 从简单 misalignment 更新升级为完整状态转移:
  1. 更新 last_report_date
  2. 更新 misalignments (保留)
  3. 更新 memory blockers (保留)
  4. AI-assisted capability assessment (heuristic: 无写作风险→写作+0.1, 有实验风险→实验-0.1)
  5. 触发奖励信号 (weekly_report_submitted, consecutive_report_streak, low_risk_report)
  6. 更新 recent_rewards 到 valuecycle
  7. 检查毕业要求进度 (summary 提及发表/论文/答辩/开题 → 自动标记 in_progress)

### [确定] W10: external-events.js 新建
- external_events 统一存储: RSS news + email + 任意外部信号
- recordEvent / recordFromNews / recordFromEmails
- getUnprocessed / markProcessed / getRecentEvents
- buildExternalContext: 注入 AI prompt 的"外部环境信号"段落
- getEventStats: 按来源/类型统计
- server.js 6 路由: GET/POST events, sync-news, sync-email, unprocessed, mark-processed
- 验证: sync-news 成功导入 20 条 RSS 新闻

### [确定] W12: skill-extractor.js 新建
- 从人-AI 交互轨迹中半自动提取可复用技能
- extractSkillsFromTrajectory: 启发式识别 how_to + code_snippet 模式
- extractFromAllTrajectories: 批量提取 + 去重
- listExtractedSkills / searchSkills / getSkillStats
- server.js 4 路由: GET extracted, GET search, POST extract, GET stats
- 验证: 从现有轨迹提取 1 个 skill

### [确定] W14: LabOS Cockpit 全局聚合
- GET /api/cockpit: 一次性返回 labState + boardStats + alignments + riskRadar + growth + graduation + events + rewards
- 风险雷达: 所有学生 risks 聚合
- 成长轨迹: rewards 按学生分组
- 毕业概览: 15 个学生 graduation summaries
- 验证: 15 students / 40 tasks / 25 risks / 15 grad / 20 events / 1 reward

### [确定] W15: Value Cycle Dashboard 价值链对齐仪表盘
- GET /api/value-cycle-dashboard: 15 学生的对齐评分 (0-100)
- 评分公式: graduation_progress*40% + task_completion*30% + report_rate*20% + risk_inverse*10%
- team_score=27 (团队平均), avg_alignment=27, high_risk=15, decisions=3, rewards=1
- 每个学生: alignment_score / graduation_progress / risk_level / decision_count / reward_count

### [确定] Roadmap 2.1 完成状态
- W6a ✅ valuecycle 4 fields
- W6b ✅ decisions.js + frontend
- W6c ⏳ 导师手填 graduation_state (只有导师能做)
- W7a ✅ trajectory.js
- W7b ✅ kanban state machine
- W8 ✅ lab-state.js + rewards
- W9 ✅ writeBackFromSummary 状态转移
- W10 ✅ external-events.js 外部感知
- W11 ⏳ AG-UI 协议 (需前端框架重构,defer)
- W12 ✅ skill-extractor.js
- W13 ⏳ A2A 协议 (需 cordis runtime,defer)
- W14 ✅ LabOS Cockpit
- W15 ✅ Value Cycle Dashboard
`
appendFileSync(join(parentDir, 'DEVLOG.md'), devlog, 'utf-8')
console.log('OK DEVLOG')

// CHANGELOG
const clPath = join(parentDir, 'CHANGELOG.md')
const cl = readFileSync(clPath, 'utf-8')
const entry = `## [0.7.10] - 2026-08-21

### Added
- **W9 writeBackFromSummary**: real state transition — auto-update capability, trigger rewards, detect graduation progress from report content
- **W10 external-events.js**: external perception layer (RSS news + email → unified events → LabState injection), 6 API routes
- **W12 skill-extractor.js**: semi-auto skill extraction from trajectories (how_to + code_snippet patterns), 4 API routes
- **W14 LabOS Cockpit**: `/api/cockpit` global aggregation endpoint (labState + boardStats + riskRadar + growth + graduation + events + rewards)
- **W15 Value Cycle Dashboard**: `/api/value-cycle-dashboard` alignment scoring (graduation 40% + tasks 30% + reports 20% + risk-inverse 10%), team_score + per-student breakdown
- 16 new API routes total across W9/W10/W12/W14/W15

### Changed
- ai-context.js writeBackFromSummary fully rewritten (7-step state transfer)
- HTML cache params bumped to ?v=0710
- APP_VERSION → 0.7.10

### Roadmap 2.1 Status
- W6a-W10, W12, W14-W15: ✅ Complete
- W6c: deferred (requires manual data entry by PI)
- W11 (AG-UI), W13 (A2A): deferred (require frontend framework rebuild + cordis runtime)

`
const lines = cl.split('\n')
const idx = lines.findIndex(l => l.startsWith('## [0.7.9'))
if (idx >= 0) {
  lines.splice(idx, 0, ...entry.trim().split('\n'), '')
  writeFileSync(clPath, lines.join('\n'), 'utf-8')
  console.log('OK CHANGELOG')
} else {
  writeFileSync(clPath, entry + cl, 'utf-8')
  console.log('OK CHANGELOG prepended')
}
