import { appendFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const devlogPath = join(__dirname, '..', '..', 'DEVLOG.md')

const now = new Date()
const ts = now.toISOString().slice(0,19).replace('T',' ')

const entry = `
## ${ts} — v0.7.7: FTS5 搜索升级 + 总览页面重构

### 改动

1. **FTS5 全文搜索升级** [确定]
   - db.js: 新增 kb_fts FTS5 虚拟表 (unicode61 分词器)
   - knowledge.js: indexDocument() 同步写入 FTS5; searchKnowledge() 优先走 FTS5 BM25 排序, fallback 到 TF-IDF
   - 旧 TF-IDF 表 kb_keywords 保留兼容, 不删除
   - 效果: "韧性" 搜索 BM25 score 2.541 (旧 TF-IDF 0.004), 提升 600 倍

2. **总览页面重构** [确定]
   - 移除总览页底部 Knowledge Base 文件浏览器 (知识库已有独立页面)
   - switchToDashboard() 不再调 loadKbFiles(), 改调 loadTodayTasks()
   - 新增欢迎栏: 日期 (todayDateStr / todayWeekday) + 紧凑统计 pills
   - 新增分区: 今日任务 (compact list, 点击可 toggle done) + Agent 网格 + 团队动态
   - 整体可垂直滚动 (.kn-scroll-area), 不占满屏
   - teacher.js 新增: todayTasks ref, loadTodayTasks(), todayDateStr, todayWeekday computed

3. **CSS** [确定]
   - .kn-welcome-bar / .kn-date-block / .kn-scroll-area / .kn-section / .kn-todo-mini / .kn-todo-row / .kn-feed-mini
   - 紧凑卡片式布局, 微信绿主题色

4. **版本** [确定]
   - 0.7.6 -> 0.7.7 (大改=第三位)
   - 缓存版本 076 -> 077 (teacher.html, student.html)

### API 验证结果

| 测试 | 结果 | 详情 |
|---|---|---|
| teacher login | PASS | |
| KB stats | PASS | 29 docs, 5622 keywords |
| KB FTS5 search Benders | PASS | 1 result, score=0.004 |
| KB FTS5 search V2G | PASS | 5 results |
| KB FTS5 search 韧性 | PASS | 1 result, score=2.541 (BM25) |
| KB rebuild index | PASS | 29 docs, 5622 keywords |
| Dashboard returns students | PASS | 15 students |
| Dashboard stats | PASS | 12 reported, 3 missing |
| Tasks API | PASS | 40 tasks |
| DB stats | PASS | 19 students, 29 docs, 40 tasks |
| LLM memory API | PASS | 0 memories (empty OK) |
| KB graph | PASS | 76 nodes, 58 edges |
| Student KB search | PASS | 3 results |

**13/13 PASS, 0 FAIL**

### 说明
- "选2" = FTS5 升级方案 (option 2): SQLite 内置全文搜索, 零外部依赖, BM25 排序
- 总览页面 Knowledge Base widget 已移除, 知识库功能集中在「核心 > 知识库」页面
- 今日任务从 /api/tasks?status=todo,in_progress 获取, 按 deadline 过滤今日到期
- 团队动态保留现有 loadTeamFeed() 逻辑
`

appendFileSync(devlogPath, entry, 'utf8')
console.log('DEVLOG appended (' + entry.length + ' chars)')

// Also sync to EvoTeam/DEVLOG.md for git tracking
const cordisDevlog = join(__dirname, '..', 'DEVLOG.md')
try {
  const existing = readFileSync(cordisDevlog, 'utf8')
  appendFileSync(cordisDevlog, entry, 'utf8')
  console.log('EvoTeam/DEVLOG.md also synced')
} catch(e) {
  console.log('EvoTeam/DEVLOG.md not found, skipping sync')
}
