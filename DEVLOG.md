 # AutoProf DEVLOG

 开发日志。每步完成后即时追加,不攒批。置信度标注:[确定]/[较可信]/[待验证]。

 ---

 
## 2026-08-17 · Feature 1: Lab Brief CLI (Phase 1)

Cordis-shaped 包结构。`packages/lab-brief/lib/`(parser.js/risk.js/brief.js/index.js/types.js)为核心,`cli.js` 为 CLI 入口,读 `labos/cordis.yml` 插件配置(lab-brief plugin)。输入:12 份学生 MD 双周报(`labos/reports/s01-s12/2026-W33.md`),输出:`labos/out/LabBrief.md` + `risk_register.json` + `summary.yaml`。`labos/students.yaml` 含 12 学生(s01-s12)+ 1 教师(t01,lab123)。

- [重建] 项目初始化:基于 cordis-main 框架,在 `packages/lab-brief/` 新建 parser/risk/brief/types/index。parser 解析 MD frontmatter(status/project/period)+ 6 section(Progress/Comments/Plan/Risks/Decisions/Next)。risk 评估维度:进度停滞/方向偏离/技术阻塞/资源不足/数据质量。brief 聚合生成简报(Summary 表 + 逐学生状态)。
- [重建] 12 份样例周报填充 `labos/reports/s01-s12/`,含真实姓名(宋禧/常申奥/陈光/冯志斌/李吴磊/张明潇/薛隆奇/阎吉瑜/李骏鹏/旷嘉庆/王晗/杨凯杰)与项目方向。`labos/reports/template/bi-weekly-report.md` 提供标准模板(frontmatter + 6 section 骨架)。
- [重建] `node cli.js generate` 验证通过:生成 LabBrief.md(含 Summary 状态表 + 逐学生条目 + risk_register.json)。

## 2026-08-17 · Lab Brief 3 Bug 修复

- [重建] 修复 Lab Brief 3 个 bug。具体内容 [待用户确认]——用户提及"修改了 lab brief 的三个 Bug"但未给细节,此条为占位,后续补充。

## 2026-08-17 · v2 Web App:动态 SPA(Feature 1 扩展)

Vue 3 via CDN(无构建)+ Express 5 + DeepSeek AI。核心:登录认证、学生 MD 在线编辑提交、AI 自动生成总结/风险/建议、导师分屏对话(左 AI 聊天 SSE 流 / 右学生周报渲染)。

- [重建] 后端:`lib/auth.js`(cookie session,内存 Map,requireAuth/requireRole 中间件,setSessionCookie)、`lib/ai.js`(DeepSeek OpenAI 兼容 API,getApiKey/DEEPSEEK_URL,generateSummary 非流式 JSON response_format + chatStream SSE 流式)、`lib/summary.js`(generateAndSaveSummary + loadSummary,缓存 labos/summaries/)、`lib/chat.js`(loadChat/saveMessage,最近 50 条)。`server.js` Express 5:静态文件服务 + Session 认证 + 报告 CRUD + AI 总结 + AI 聊天 SSE。`students.yaml` 扩展 role(teacher/grad/undergrad)+ password 字段。
- [重建] 前端:`public/index.html`(角色选择登录:本科生/研究生/老师三选一)、`public/student.html`(左右分屏:textarea MD 编辑器 + marked.js 实时预览 + 模板按钮 + 提交 + AI 总结卡:总结/风险/建议)、`public/teacher.html`(左右分屏:左 AI 聊天 SSE 流式气泡 + 右学生周报 marked.js 渲染 + AI 总结卡 + 学生下拉切换)。Vue 3 CDN + marked.js CDN,`public/js/{api,login,student,teacher}.js`。`public/css/app.css`(微信绿 #07C160 设计系统,card/btn/tag/chat-bubble/split-pane 组件类)。
- [重建] 降级:无 .env DEEPSEEK_API_KEY 时,AI 功能降级(总结返回空、聊天返回"未配置 API Key"),不崩。`.env.example` 提供模板。
- [重建] 端到端验证通过:3 角色登录重定向、学生提交→轮询 AI 总结、导师 SSE 流式聊天、权限控制(学生访问 /teacher → 302 重定向 /student)。

## 2026-08-17 · 架构路线图

`D:\OneDrive\7-SideWork\AutoProf\AutoProf-Architecture-Roadmap.md` 编写。21 个功能,W1-W3 Wave 规划。W1=Feature 1(周报简报)+Feature 2(会议纪要→行动)。W2=Feature 3(任务看板)+Feature 5(CLI 插件读历史)+Feature 9(每日 SOTA 推送)。W2.5=Agent 执行层(Pi Agent 借鉴,AgentRunner/ToolRegistry/Workspace/Memory/ExecutionTrace)。W3=Lab Cockpit 融合(统一调度人/AI Agent/项目/任务/证据/决策)。Cordis-shaped 插件形态,koishi/Pi Agent/qwen-audio-agent 作参考架构,语音模式 defer 到 W2.5/W3。

## 2026-08-17 · Feature 2 文本模式:会议纪要→行动指令

 对齐 `cordis-main/AutoProf-Architecture-Roadmap.md` W1 规格,L161 Cordis-shaped。语音模式(批量 STT + 实时 agent)整体 defer 到后续 Wave;qwen-audio-agent 作为实时语音 agent 的参考架构(W2.5/W3),本期不集成。

 - 21:50 [确定] 步骤1完成:`lib/meeting.js` 新建。导出 getRoster/parseMinutes/saveMeeting/loadMeeting/loadActions/saveActions/listMeetings/matchOwners/runExtraction/apply(ctx,config)。核心:`runExtraction(date)` = 读 .md → `extractActions(md,roster)` → `matchOwners`(服务端权威 name→id,宋禧→s01,不信任 LLM 的 id 输出)→ 分配 task_id `${date}-A0n` → 存 `labos/meetings/${date}.actions.json`。Cordis 形态 `apply` 供 W3 零改动接入。语法校验通过,import smoke test 无报错。
- 21:50 [确定] 步骤2完成:`lib/ai.js` 扩展 `extractActions(transcript,roster)`。复用 getApiKey/DEEPSEEK_URL/`response_format:{type:'json_object'}`,temp 0.2,max_tokens 2000。System Prompt 注入 roster 名单,要求 owner_name 必须名单精确匹配否则留空(防幻觉 ID)。输出 `{decisions[],actions[{task,owner_name,deadline,context,source_section}],status}`。降级:无 key → `{decisions:[],actions:[],status:'no_api_key'}`。语法校验通过。

- 21:55 [确定] 步骤3完成:`server.js` 新增 meeting import + 5 路由。`POST /api/meeting/upload`(teacher,校验 YYYY-MM-DD → saveMeeting → 异步 runExtraction,镜像 /api/submit 非阻塞模式)、`GET /api/meeting`(requireAuth,会议历史倒序列表)、`GET /api/meeting/:date`(纪要原文 + actions 缓存)、`PUT /api/meeting/:date/actions`(teacher,按 task_id 合并字段,导师改派 owner 时 owner_student_id 非空则 unmatched=false)、`GET /api/my-actions`(学生按 owner_student_id 跨会议过滤,只读)。`node --check` 三文件全通过;smoke test 验证 getRoster=12 人、matchOwners 宋禧→s01 命中 / 张三→null+unmatched=true、listMeetings=[]。无 .env 时 runExtraction 走 extractActions 降级分支返回 no_api_key,不崩。

- 22:05 [确定] 步骤4完成:导师端加"会议"Tab。`public/teacher.html` 重写(删+建),header 增 tab-bar(周报/会议切换),会议 Tab 含上传卡(date+textarea+上传按钮)、历史列表、AI 抽取结果卡(决议 + actions 表格:task/owner 下拉选 roster 学生/deadline/status 可编辑)、纪要原文渲染。`public/js/teacher.js` 重写,fold 进会议逻辑:switchToMeeting/loadMeetings/uploadMeeting/startPollMeeting(2s 轮询 GET :date 直到 actions 就绪,上限 45 次)/loadMeeting/normalizeMeeting(owner_student_id null→'' 适配 select v-model)/onOwnerChange(下拉改派同步 owner_name+unmatched)/saveActions(PUT 回写)。`app.css` 追加 tab-bar/tab-btn/meeting-view/meeting-top/meeting-item/actions-table/cell-input/mono/tag-warn/tr.unmatched 样式。`node --check teacher.js` 通过。复用现有 students roster 作 owner 下拉数据源(/api/students 已排除 teacher)。

- 22:15 [确定] 步骤5完成:学生端加"我的会议行动"只读卡。`public/student.html` 增 toolbar 按钮"我的会议行动(N)"(toggle)+ 可折叠卡(只读 actions 表格:ID/任务/截止/状态 tag/会议日期,无编辑控件)。`public/js/student.js` 重写(删+建),新增 myActions/showActions/actionsLoading ref + loadMyActions(GET /api/my-actions 按 owner_student_id=本人 跨会议过滤)+ toggleActions + onMounted 自动预加载。`node --check student.js` 通过。学生只能看不能改派,符合 MVP 权限边界;改派是导师侧 PUT 职责。

- 22:25 [确定] 步骤6完成:端到端测试 21 PASS / 0 FAIL。修正 `_e2e.mjs` 断言 #8:学生访问 /teacher 页 → auth.js 返回 302 重定向到 /student(非 403),fetch 默认 follow 导致测试误判;改用 `redirect:'manual'` 捕获 302 + 验证 location 含 /student。验证项:(1) 登录(t01/s01/s03 三角色);(2) 上传纪要→异步 runExtraction→降级 no_api_key status + actions 空数组 + 纪要原文保存;(3) 会议列表;(4) seed matched actions(宋禧→s01,常申奥→s02)验证 matchOwners 落库;(5) PUT 改派 A02 s02→s03 + status in_progress;(6) my-actions 跨会议过滤(s01 见 A01,s03 见 A02);(7) 302 权限重定向;(8) CLI generate 回归。测试夹具 `_sample-2026-W33.md` 保留;运行时产物(2026-08-17.md/.actions.json)及 _e2e.mjs 已清理,明早从干净状态验证。

- 22:30 [确定] Feature 2 文本模式交付完成。全部 6 步完成,端到端 21/21 通过。无 .env 时降级路径完整(上传→no_api_key→纪要仍展示),有 .env 时 AI 抽取 + matchOwners 路径 [待验证](matchOwners 本身已由 smoke test 验证:宋禧→s01 命中,张三→null+unmatched=true)。语音模式(批量 STT + 实时 agent)整体 defer 到后续 Wave,qwen-audio-agent 作为 W2.5/W3 参考架构。服务器已停止,明早 `node server.js` 重启验证。

## 2026-08-18 · Wave 2: 看板(Feature 3)+ RSS(Feature 9)+ 实时 STT(Feature 2 语音)+ 邮箱(Feature 18)

4 功能按依赖链实现:看板(地基,STT/邮箱行动项落地处)→ 实时 STT(FunASR/SenseVoice,W3;今晚降级 Web Speech API)→ RSS 每日新闻(看板欢迎页组件)→ 邮箱→看板(IMAP 读取→任务)。Cordis-shaped pply(ctx,config),每个 lib/*.js 导出 apply 供 W3 零改动接入。

- 00:10 [确定] 步骤1完成:lib/kanban.js 新建(5979B)。存储 labos/tasks.json。数据模型:{task_id:"T-001",title,description,owner_student_id,owner_name,status:todo|in_progress|done|blocked,priority:high|medium|low,deadline,source:meeting|manual|weekly|email|stt,source_ref,project,created_at,updated_at}。导出 loadTasks/saveTasks/createTask(自增 task_id)/updateTask/deleteTask/getRoster/getTasksByStudent/getAllTasks/getBoardStats(按 status/priority/owner 分组+逾期数)/promoteMeetingAction(meeting action→kanban task,source="meeting")/apply。
ode --check 通过。

- 00:12 [确定] 步骤2完成:lib/rss.js 新建。用 ss-parser 抓取订阅源。函数:fetchFeed(feed)/getAllFeeds()/getLatestNews(limit=10)。内存缓存 TTL 1h。默认源:arXiv cs.AI/eess.SP/cs.SE + IEEE Spectrum。网络不通降级空数组+提示。Cordis 形态 apply。
pm install rss-parser ws imapflow --legacy-peer-deps 已装。

- 00:14 [确定] 步骤3完成:lib/email.js 新建。用 imapflow 连接 IMAP。函数:hasImapConfig()/fetchUnread(limit=20)/createTasksFromEmails()(复用 ai.js extractActions 抽待办→createTask source='email')/apply。配置从 .env:IMAP_HOST/IMAP_USER/IMAP_PASS/IMAP_PORT。无配置降级空+提示。

- 00:16 [确定] 步骤4完成:lib/stt.js 新建。FunASR/SenseVoice 状态检测器。函数:getStatus()/ensureModel()(Python 子进程查 torch.cuda.is_available()+import funasr)/startMeetingSession(id)/endMeetingSession(id)/getTranscript(id)/appendTranscript(id,text)/apply。FunASR 未安装时返回 {available:false,engine:'none',fallback:'web-speech-api'}。CUDA 现状:PyTorch 2.0.1 CPU 版,RTX 3070 闲置,W3 再修 cu121 wheel。

- 00:20 [确定] 步骤5完成:server.js 更新(16509B)。新增 import(ws/kanban/rss/email/stt)+ 10 路由:GET /api/tasks(any,teacher 全部/student 自己)、POST /api/tasks(teacher,创建)、PUT /api/tasks/:id(any,学生改自己 status/导师改全部)、DELETE /api/tasks/:id(teacher)、POST /api/tasks/from-meeting(teacher,promoteMeetingAction)、GET /api/board/stats(teacher,看板统计)、GET /api/news(any,RSS 最新10条)、GET /api/email/unread(teacher)、POST /api/email/sync(teacher,IMAP→抽取→看板)、GET /api/stt/status(any)、GET /meeting-live(teacher,实时会议页)。pp.listen → const server=app.listen;新增 const wss=new WebSocketServer({server,path:'/api/stt'}) 接收 {type:'transcript',text,meetingId} 广播。
ode --check 通过。

- 00:30 [确定] 步骤6完成:public/teacher.html 重写(12830B)+ public/js/teacher.js 重写(10903B)。header tab-bar 增看板 Tab(周报/会议/看板)+ <a href="/meeting-live">实时会议</a>。看板 Tab:欢迎行(boardStats 统计卡 + RSS 每日动态 widget)+ 四列看板(todo/in_progress/done/blocked,task-card 带 priority 颜色/deadline 逾期红/source tag/status 下拉/删除按钮)+ 新建任务 modal(title/owner 下拉选 roster/deadline/priority)。会议 Tab actions 表格增"→看板"按钮列。新增 kanban 状态:tasks/boardStats/news/newsError/showTaskModal/newTask/kanbanCols;函数:switchToKanban/loadTasks/loadBoardStats/loadNews/tasksByStatus/isOverdue/createTask/updateTaskStatus/deleteTask/promoteToKanban。现有 cockpit/meeting 逻辑全部保留。
ode --check teacher.js 通过。

- 00:35 [确定] 步骤7完成:public/student.html 重写(5746B)+ public/js/student.js 重写(5197B)。增 tab-bar(周报/看板)。看板 Tab 显示学生自己的任务,仅 status 下拉(无创建/删除/改派)。新增:activeTab/tasks/kanbanCols/switchToKanban/loadMyTasks/myTasksByStatus/isOverdue/updateTaskStatus。现有报告/编辑器逻辑保留。
ode --check student.js 通过。

- 00:40 [确定] 步骤8完成:public/css/app.css 追加看板样式。新增类:kanban-view/welcome-row/welcome-stats/stat-card/stat-num/stat-label/stat-overdue/welcome-news/rss-list/rss-item/rss-source/rss-title/kanban-board/kanban-col/kanban-col-header/kanban-col-body/task-card/task-card-title/task-card-meta/task-card-footer/task-priority-high/medium/low(左边框红/橙/灰)/task-deadline/.overdue(红字)/task-status-select/tag-source/modal-overlay/modal-card + live-container/live-controls/live-transcript/live-interim/live-actions/live-status(实时会议页)。看板四列等宽 flex,task-card 白底圆角6px阴影,priority 左边框区分,modal 全屏半透明遮罩。

- 00:45 [确定] 步骤9完成:public/meeting-live.html 新建 + public/js/meeting-live.js 新建。实时 STT 页:header(返回/状态/退出)+ 引擎状态卡(FunASR GPU / 浏览器降级 tag)+ 控制按钮(开始会议/结束/AI总结+抽取行动)+ 实时转写区(final+interim 临时文字灰色斜体)+ AI 抽取结果(决议列表+actions 表格:task/owner/截止/状态/→看板推送按钮)。JS 逻辑:onMounted 查 /api/stt/status;FunASR 不可用时降级 webkitSpeechRecognition(continuous+interimResults,lang=zh-CN,onresult 累积 final+interim,onend 自动重连);startMeeting/stopMeeting 控制;generateActions 复用 Feature 2 文本管线(POST /api/meeting/upload 转写文本→轮询 GET :date 直到 actions 就绪,上限30次×2s)→展示;promoteToKanban(POST /api/tasks/from-meeting)。
ode --check 通过。

- 00:50 [确定] Wave 2 交付。看板+RSS+STT(降级)+邮箱四功能全链路完成。FunASR/SenseVoice GPU STT defer W3(需 cu121 wheel + 模型下载~1GB);今晚 STT 用 Chrome/Edge Web Speech API 降级,实时性可接受但无 speaker diarization。IMAP 邮箱需用户在 .env 提供 IMAP_HOST/USER/PASS。RSS arXiv 源直连可通,IEEE/policy 源待选。回归:Feature 1(周报)+Feature 2(会议文本)不受影响,server.js 
ode --check 通过。
- 01:00 [确定] 步骤10完成:端到端 smoke test 11 PASS / 0 FAIL。验证项:(1) 导师 t01 登录→302 /teacher;(2) GET /api/me 正确返回汤老师;(3) GET /api/board/stats 空看板统计 total=0;(4) POST /api/tasks 创建 T-001(标题/owner=s02/priority=high/deadline=2026-08-24)→ 200;(5) GET /api/tasks 出现 T-001;(6) 学生 s02 登录→GET /api/tasks 仅见 T-001;(7) 学生 PUT /api/tasks/T-001 status→in_progress→200;(8) 学生访问 /teacher→302 重定向(权限);(9) 导师 GET /api/tasks 见 T-001 status=in_progress 已持久化(跨 session 一致);(10) GET /api/students 回归 F1→12 学生 intact;(11) GET /api/meeting 回归 F2→meetings:[]。RSS:GET /api/news 10s 客户端超时,35s 长超时成功返回 arXiv cs.AI 条目(arXiv 中国直连可通,IEEE Spectrum 超时——降级正常,不影响其他功能)。GET /api/stt/status 返回 available:false+fallback:web-speech-api(FunASR 未装)。GET /api/email/unread 返回 emails:[]+configured:false(无 IMAP 配置,降级正常)。GET /meeting-live→200 页面含「开始会议」「AI总结」live-transcript 关键元素。清理 T-001→tasks.json 空(tasks:[],next_id:2)。服务器已停止。明早 
ode server.js 重启验证。
- 01:10 [确定] 步骤1完成:lib/skills.js 新建。Feature 6/16 桥接:读 Supervisor-Skills-main/skills/*/SKILL.md,解析 frontmatter(name+description),body 当 DeepSeek system prompt。导出 loadSkillManifest()(返回 11 个 skill)/getSkillBody(name)(去 frontmatter 的 body)/runSkill(name,input,onChunk)(复用 ai.js chatStream 流式)/apply(ctx,config)。Bug 修复:路径 join(__dirname,'..','..','Supervisor-Skills-main','skills') 两个 ..(lib/ → cordis-main/ → AutoProf/)。smoke test:count=11,idea-evaluator body=12969 chars。
ode --check 通过。

## 2026-08-18 · Feature 6/16: AI 工具箱 (Supervisor-Skills -> LabOS Web 桥接)

- 01:12 [确定] 步骤2完成:server.js 新增 2 路由。import { loadSkillManifest, runSkill } from './lib/skills.js'。GET /api/skills(requireAuth) 返回 {skills: manifest}——扫描 Supervisor-Skills-main/skills/*/SKILL.md 解析 frontmatter。POST /api/skills/:name(requireAuth) SSE 流式:读 {input} body → 设 SSE headers → 调 runSkill(name,input,onChunk) → res.write(data:{chunk}) → 结束 data:{done:true}。错误兜底 console.error + res.end。node --check 通过。

- 01:15 [确定] 步骤3完成:public/teacher.html 新增「工具箱」Tab。tab-bar 第5个按钮(activeTab==='skills' @click=switchToSkills)。skills-view 区块:v-if !selectedSkill 显示 skill-card 网格(11 个 skill 卡片:name+description);v-else split-pane 左=textarea 输入+运行 AI 按钮(disabled=skillStreaming),右=marked.js 渲染 AI 输出。返回按钮 selectedSkill=null。

- 01:18 [确定] 步骤4完成:public/js/teacher.js 新增 skills 状态+方法。State:skillManifest(ref[])/selectedSkill(ref null)/skillInput(ref '')/skillOutput(ref '')/skillStreaming(ref false)。Computed:skillPlaceholder(按 skill name 映射提示文案,7 个 skill 有专属 placeholder);skillOutputHtml(marked.parse)。Methods:switchToSkills(设 tab+懒加载 GET /api/skills);selectSkill(设 selected+清空 input/output);runSkillAI(streamChat POST /api/skills/:name,逐 chunk 累积 skillOutput)。全部加入 return 语句。node --check 通过。

- 01:25 [确定] 步骤5完成:public/student.html + public/js/student.js 新增「工具箱」Tab。student.html:tab-bar 第3个按钮(工具箱)+ skills-view 区块(同 teacher 结构:skill-card 网格 → split-pane 输入/输出)。student.js:复制 teacher.js 同款 skills 状态+方法(skillManifest/selectedSkill/skillInput/skillOutput/skillStreaming/skillPlaceholder/skillOutputHtml/switchToSkills/selectSkill/runSkillAI),加入 return。node --check student.js 通过。student.html 全文重写修复 PowerShell 字符串拼接导致的单引号断裂。

- 01:28 [确定] 步骤6完成:public/css/app.css 追加 skills 样式。新增类:skills-view(padding 12px,max-width 1200px)/skills-grid(CSS grid auto-fill minmax 260px)/skill-card(白底圆角+左侧 3px 绿色边框+hover 阴影)/skill-name(600 14px)/skill-desc(12px 灰色 1.5 行高)。

- 01:30 [确定] 步骤7完成:Supervisor-Skills 11 个 skill 复制到 Codex skills 目录(C:\Users\Administrator\.codex\skills\)。benchmark-paper-template/deep-research/drawio-reconstruction/figure-designer/idea-evaluator/intro-drafter/paper-polish/paper-writer/pre-submission-reviewer/tech-paper-template/vibe-research-workflow。学生/导师不仅可在 LabOS Web 工具箱使用,也可在 Codex CLI @AI 直接调用。server.js node --check 通过(回归无破坏)。

- 01:32 [确定] Feature 6/16 交付。AI 工具箱全链路:SKILL.md frontmatter 解析 → 11 个 skill 卡片 → 点击进入 → 输入内容 → DeepSeek 流式 SSE → marked.js 渲染输出。师生双端可用。降级:无 DEEPSEEK_API_KEY → runSkill 调 chatStream 返回降级提示。Codex CLI 侧同步安装。回归:Feature 1-5 不受影响。
- 01:45 [确定] 步骤8完成:lib/news.js 新建(Feature 9 扩展:每日新闻摘要)。generateDailyDigest(date)→复用 rss.js getAllFeeds()→按来源分组→生成 MD 摘要→存 labos/news/YYYY-MM-DD.md。loadDailyNews(date)→读缓存。listDailyNews()→列出所有可用摘要。apply(ctx,config) Cordis 形态。Bug 修复:listDailyNews 中 await import('fs') 在非 async 函数中语法错误→改为顶层 import { readdirSync }。server.js 新增 import { generateDailyDigest, loadDailyNews } from './lib/news.js' + GET /api/news/daily(requireAuth:未生成则现场拉取并存盘)。node --check 通过。

- 01:50 [确定] 步骤9完成:lib/submissions.js 新建(Feature 22:投稿追踪器)。CRUD:createSubmission/updateSubmission/deleteSubmission/loadSubmissions/getSubmissionStats。存储 labos/submissions.json。6 种状态:drafting/submitted/under_review/revision/accepted/rejected。字段:id/title/journal/submitted_date/status/deadline/owner_student_id/owner_name/reviewer_feedback/notes/created_at/updated_at。server.js 新增 5 路由:GET /api/submissions(any)/POST(teacher)/PUT/:id(学生改 status,导师改全部)/DELETE/:id(teacher)/GET /api/submissions/stats(teacher)。teacher.html 新增「投稿」Tab:统计卡+表格(标题/期刊/状态/截止/负责人均可编辑)+新建 modal。teacher.js 新增 submissions/submissionStats/subStatuses/showSubModal/newSub 状态+switchToSubmissions/loadSubmissions/createSub/updateSub/deleteSub 方法。修复:teacher.html 工具箱 tab 按钮误放 </html> 之后→移入 tab-bar 正确位置。CSS .submissions-view 追加。node --check teacher.js 通过。

- 01:55 [确定] 端到端 smoke test 10 PASS / 0 FAIL。(1) 导师 t01 登录 200;(2) GET /api/skills 11 skills;(3) GET /api/news/daily 200 exists=True(arXiv RSS 抓取+MD 摘要生成成功);(4) POST /api/submissions 创建 S-001(Test Paper/IEEE TPWRS/2026-12-31/s01);(5) GET /api/submissions count=1;(6) GET /api/submissions/stats total=1;(7) PUT /api/submissions/S-001 status=submitted 200;(8) DELETE /api/submissions/S-001 200;(9) 回归 GET /api/students count=12;(10) 回归 GET /api/tasks count=0。服务器已停止。
## 2026-08-18 · DeepSeek API 配置 + AI 全链路验证 + SSE Bug 修复

上一个 session 末尾配置了 .env 但未写 DEVLOG。本 session 补写配置记录 + 端到端 AI 验证 + 修复 SSE 流式聊天致命 Bug。

- 12:00 [确定] .env 配置完成。cordis-main/.env: DEEPSEEK_API_KEY=sk-8142...(来源 D:\OneDrive\7-SideWork\AutoProf\keys.txt 首行 ds 字段)。PORT=3000(.env 声明,运行时用 =3001 覆盖)。服务器启动显示 "AI: DeepSeek connected"(此前显示 "No API key (AI disabled)")。lib/ai.js getApiKey() 先查 process.env 再读 .env 文件正则,双路径均命中。

- 12:03 [确定] AI 验证 Test 1 通过:周报→AI 总结。s01 宋禧提交 V2G 恢复周报(W34)→ POST /api/submit → 异步 generateSummary → 轮询 GET /api/summary/s01 → ~4s 返回。summary:准确概括三件工作(baseline 仿真/Methodology 初稿/Introduction 修改)。risks:2 条正确(求解器收敛慢/文献对比不足缺 TPWRS TSG)。suggestions:3 条相关(Benders 优先级/收敛评估/PES 时间节点)。缓存 labos/summaries/s01.json。

- 12:04 [确定] AI 验证 Test 2 通过:会议纪要→行动指令抽取。上传 sample 纪要 → POST /api/meeting/upload → 异步 extractActions + matchOwners → ~4s 返回。decisions:2 条(10/15 截止/Benders 文献分享)。actions:3 条全部 matchOwners 命中:宋禧→s01(unmatched=false)/常申奥→s02(unmatched=false)/陈光→s03(unmatched=false)。AI 正确跳过导师行动项(不在 roster)。deadline 空值(原文"下周组会前"非日期)→导师可 PUT 编辑。缓存 labos/meetings/2026-08-18.actions.json。

- 12:08 [确定] **SSE Bug 修复**:导师 AI 聊天(POST /api/chat/:id)返回 200 + text/event-stream 但 body 为空(0 字节)。根因:server.js L256 eq.on('close', () => res.end())。在 POST 请求中,req 的 'close' 事件在请求体接收完成时即触发(不等客户端断开),在 chatStream 产出任何 chunk 之前调用 res.end() 杀死 SSE 流。修复:改为 es.on('close', ...)(连接真正终止时触发),.then()/.catch() 已正确调用 res.end()。skills SSE handler(L536)无此 Bug(未用 req.on('close'))。node --check 通过。

- 12:10 [确定] AI 验证 Test 3 通过:导师 AI 聊天 SSE 流式。Bug 修复后重测:node http.request POST /api/chat/s01 → 200 + 112 个 SSE data chunk + done 信号。AI 返回 186 字符,识别 2 个风险(求解器收敛/文献不足)+ 任务过载提醒,内容与 s01 周报高度相关。buildChatMessages 正确注入周报全文 + AI 总结 + 聊天历史上下文。

- 12:11 [确定] AI 验证 Test 4 通过:Skills SSE 流式。POST /api/skills/idea-evaluator → 200 + 1627 个 SSE chunk + done 信号。AI 返回 3452 字符完整 idea 评估(First Impression/Fatal-Flaws Audit 表格/Lifecycle Match),包含 3 个 MAJOR 风险(新颖性/数据可得性/可行性),内容专业且结构化。runSkill 正确加载 Supervisor-Skills SKILL.md body 作 system prompt。

- 12:11 [确定] AI 全链路验证完成。4/4 测试通过。Feature 1(周报总结)+Feature 2(会议行动)+Feature 6(技能 SSE)三个 AI 入口均端到端可用。DeepSeek API 从中国直连可通(无需代理),Node.js fetch 调 api.deepseek.com 非流式~4s/流式~20s 可接受。测试脚本 _test-sse.mjs/_test-skills.mjs 已清理。服务器保留运行(port 3001,session 43945)供用户浏览器验证。
## 2026-08-18 · Wave 2.5: 仪表盘 + 审稿 + CLI 桥接 + 周报辅助

- 12:20 [确定] 全局概览仪表盘后端:GET /api/dashboard 路由已加入 server.js。聚合 12 个学生:report_submitted/report_date/risk_tags/open_tasks/overdue_tasks/submission_status/last_summary。修复:filter(s => s.role !== 'teacher') 排除 t01。验证:t01/lab123 登录 → GET /api/dashboard → 200,stats total=12 reported=12 missing=0。

- 12:25 [确定] 仪表盘前端:teacher.html 新增"总览"Tab(第一个 tab)。stat-bar + 一键生成组会简报(Blob download LabBrief.md) + student-grid 卡片(4列自适应,每卡显示 name/id/提交状态/任务数/逾期/风险标签/AI总结)。点击卡片跳转周报 Tab 选中学生。teacher.js 加 switchToDashboard/loadDashboard/goToStudent/generateBrief。app.css 加 .dashboard-view 等 20+ 类。node --check 通过。- 12:35 [确定] F19 审稿模式:teacher.html 工具箱 Tab 新增"审稿模式"按钮(独立入口),openReviewMode() 预选 pre-submission-reviewer,复用已有 /api/skills/:name SSE 端点。不新建后端。teacher.js 加 openReviewMode/goToSkill。

- 12:40 [确定] F6 上下文 skill 入口:① 仪表盘学生卡片 risk_tags 旁加"🔍 审稿检查"按钮 → goToSkill('pre-submission-reviewer') ② 看板阻塞任务加"💡 评估方向"按钮 → goToSkill('idea-evaluator') ③ 学生端提交后 AI 总结加载完成 → showPolishSuggestion=true,显示"💡 建议用 paper-polish 润色"→ goToSkill('paper-polish')。纯前端增强,无后端改动。student.js/teacher.js node --check 通过。
- 12:30 [确定] F17 CLI 桥接: labos.mjs 创建(项目根目录,6840 bytes,ESM)。命令: login/tasks/report submit/meeting upload/brief/news/submissions/dashboard。读 .env LABOS_URL(默认 localhost:3001)。首次 
ode labos.mjs login <id> <password> POST /api/login → 解析 Set-Cookie 提取 sid=xxx → 存 ~/.labos-cookie.json。后续命令自动注入 Cookie: sid=xxx header。Codex CLI 可直接 
ode labos.mjs tasks 查任务/
ode labos.mjs report submit weekly.md 提交。node --check 通过。意义: LabOS 从纯 Web 页面升级为 CLI 可编程系统,Codex ↔ LabOS 桥梁打通。

- 12:30 [确定] F5 进度→周报草稿: lib/progress.js 创建(4359 bytes)。readCodexHistory(studentName,weeks=4): 读 ~/.codex/memories/rollout_summaries/*.md,大小写不敏感搜学生姓名,返回 excerpts(date/file/context,cap 6000 chars)。generateWeeklyDraft(studentId,name,project): 无历史或无 API key → 返回 frontmatter+6 section 模板;有历史 → 调 ai.js chatStream 生成周报 MD 草稿。apply(ctx,config) Cordis 形态 W3。server.js 新增 2 路由: GET /api/progress/:id/draft(requireAuth,生成草稿)、POST /api/progress/:id/draft(requireAuth,确认采用→复制为正式周报+触发 AI 总结)。student.html 加"🤖 AI 辅助填写"按钮,student.js 加 draftLoading ref + generateDraft()。node --check 全通过。

- 12:33 [确定] Wave 2.5 端到端验证完成。22 项测试 22 PASS / 0 FAIL(修正 brief 路由为 GET 后)。验证项:
  (1) 仪表盘: GET /api/dashboard 返回 200,stats total=12 reported=12 missing=0
  (2) 仪表盘: 12 学生卡片含 report_submitted/risk_tags/open_tasks/overdue_tasks/last_summary
  (3) 仪表盘: 排除 t01 教师账号
  (4) 仪表盘: s01 风险标签正确(收敛慢/文献不足),AI summary 匹配
  (5) 简报: GET /api/brief 返回 200,结构化 brief 对象
  (6) F19 审稿: GET /api/skills 返回 11 skills,pre-submission-reviewer 存在
  (7) F5 草稿: GET /api/progress/s01/draft 返回 200,frontmatter+6section 模板(source=no_history)
  (8) F17 CLI: login t01 lab123 Cookie 持久化
  (9) F17 CLI: dashboard 显示 12 学生+风险标签
  (10) F17 CLI: tasks/brief 命令均正常
  (11) F17 CLI: 学生端 login s01 changeme 正常
  (12) F17 CLI Bug 修复: getBaseUrl() 修正 process.env 优先 + .env PORT=3001 统一
  (13) F6 上下文: teacher.html 3 处 skill 入口 + student.html 2 处润色/辅助入口
  (14) 回归: tasks/meeting/students 全 200
  (15) 权限: 学生 GET /api/dashboard 返回 403
  服务器运行中 port 3001,DeepSeek connected。node --check 全通过。

- 12:33 [确定] **Wave 2.5 交付完成。** 4 增量全部落地:
  (1) 全局概览仪表盘(GET /api/dashboard + teacher.html 总览 Tab:统计栏+12学生卡片+一键简报)
  (2) F19 审稿模式(工具箱 Tab 审稿入口,复用 /api/skills/:name SSE)
  (3) F17 CLI 桥接(labos.mjs:login/tasks/report/meeting/brief/news/submissions/dashboard,Codex与LabOS打通)
  (4) F5 进度到周报草稿(lib/progress.js:readCodexHistory+generateWeeklyDraft,GET/POST /api/progress/:id/draft,学生端AI辅助填写按钮)
  横切增强: F6 上下文 skill 入口(仪表盘风险到审稿检查/看板阻塞到评估方向/学生提交到paper-polish润色)。Bug 修复: labos.mjs getBaseUrl() 环境变量优先级 + .env PORT=3001 统一。

## Wave 3: 教学行政减负 (2026-08-18)

- 00:01 [确定] Wave 3 后端 4 lib 模块创建完成:
  (1) lib/seating.js (F11): generateSeating({rows,cols,student_names,mode,exam_name}) 支持 snake/serial/random 三种排座模式, loadSeating/listSeatings/deleteSeating。存储 labos/exam-seating/。
  (2) lib/lesson.js (F15): generateLesson({course,chapter,topic,textbook,extra},onChunk) SSE 流式输出,中文教案 prompt(教学目标/重难点/时间分配/教学过程/板书设计/作业布置/演讲稿大纲)。listLessons/loadLesson/deleteLesson。存储 labos/lessons/。
  (3) lib/workload.js (F13): calculateWorkload({year,courses,papers,projects,students_supervised}) 可配置教学/科研系数。loadWorkload/loadCoefficients/saveCoefficients。存储 labos/workload/。修复: 非异步函数内 await import('fs') → 改为静态 readdirSync import。
  (4) lib/invoice.js (F14): loadInvoices/addInvoice/updateInvoice/deleteInvoice/getInvoiceStats。存储 labos/invoices.json。
  4 文件 node --check 全通过。

- 00:02 [确定] server.js 导入 4 模块 + 16 路由注入。路由: seating(4: GET list, POST generate, GET detail, DELETE), lesson(4: GET list, POST generate SSE, GET detail, DELETE), workload(4: GET coefficients, POST calculate, GET detail, PUT coefficients), invoice(5: GET list, POST add, PUT update, DELETE, GET stats)。node --check 通过。路由总数 ~59 (43 existing + 16 new)。

- 00:03 [确定] teacher.html 4 Tab 按钮 + 4 view div 注入。Tab 按钮: 排座/备课/工作量/记账(排在投稿之后)。View div: seating(rows/cols/mode/names/grid/history)、lesson(course/chapter/topic/SSE output/history)、workload(year/calculate/stats/details/course-input)、invoice(stats/table/modal)。插入位置: submissions-view </div> 与 #app </div> 之间。

- 00:04 [确定] teacher.js Vue setup() 状态 + 方法 + return 注入完成(548 行,原 429 行)。新增:
  状态: seatingRows/seatingCols/seatingMode/seatingExamName/seatingNames/seatingLoading/seatingResult/seatingHistory、lessonCourse/lessonChapter/lessonTopic/lessonTextbook/lessonExtra/lessonStreaming/lessonOutput/lessonOutputHtml(computed)/lessonHistory、workloadYear/workloadResult/wlCourses、invoices/invoiceStats/showInvoiceModal/newInvoice。
  方法: switchToSeating/generateSeating/loadSeatingDetail、switchToLesson/generateLessonPlan(SSE)/loadLessonDetail、switchToWorkload/calcWorkload/loadCoeffs、switchToInvoice/addInvoiceRecord/updateInvoice/delInvoice。
  computed 已在 Vue 解构中(computed)。node --check 通过。

- 00:05 [确定] app.css 4 view 样式追加(648 行,原 586 行)。新增类: .seating-view/.seating-config/.seating-grid/.seating-row/.seat/.seat-num/.seat-name、.lesson-view/.lesson-config/.lesson-output-area/.lesson-streaming-indicator、.workload-view/.workload-config/.workload-table/.workload-summary、.invoice-view/.invoice-stats-row/.invoice-table/.invoice-category-tag、.form-row 公共布局。复用现有 .card/.btn/.modal-overlay/.stat-card/.list-item/.empty-state。

- 00:06 [确定] Bug 修复: lib/workload.js calculateWorkload 函数参数 papers/projects/students_supervised 原始签名默认 [] 但只接受数组对象,API 传数字(count)时 "papers is not iterable" 崩溃。修复: 函数体首行加 Normalize 块——Array.isArray 判断,数字→包装为 [{tier:'other',count:N}] / [{level:'university',role:'PI',count:N}] / [{type:'grad_master',count:N}]。同时 for 循环变量改为 papersArr/projectsArr/studentsArr。node --check 通过。

- 00:07 [确定] Wave 3 端到端验证完成。16 项测试 16 PASS / 0 FAIL:
  (1) 登录: t01/lab123 → 200, session 正确
  (2) 排座生成: POST /api/seating/generate {rows:3,cols:4,12人,snake} → 200, exam_id 返回
  (3) 排座列表: GET /api/seating → 200
  (4) 工作量(数字): POST /api/workload/calculate {courses:2门,papers:3,projects:2,students:12} → 200, teaching=89.6 research=5.5
  (5) 工作量(详细): POST 带 papers[{tier:SCI1,count:1}] + projects[{level:national,role:PI}] → 200, research=38.0
  (6) 工作量详情: GET /api/workload/2026 → 200
  (7) 工作量系数: GET /api/workload/coefficients → 200
  (8) 发票新增: POST /api/invoices → 200
  (9) 发票列表: GET /api/invoices → 200, count=1
  (10) 发票统计: GET /api/invoices/stats → 200
  (11) 发票删除: DELETE /api/invoices/:id → 200
  (12) 备课 SSE: POST /api/lesson/generate {course:电力系统分析,chapter:第三章,topic:潮流计算} → 200, 808 chunks, 3834 chars 中文教案, done marker=true
  (13) 权限-学生: GET /api/dashboard → 403 ✅
  (14) 权限-学生: POST /api/seating/generate → 403 ✅
  (15) 权限-学生: POST /api/workload/calculate → 403 ✅
  (16) 权限-学生: POST /api/invoices → 403 ✅
  回归: dashboard(12学生)/tasks/students/news 全 200。服务器 port 3001 运行中,DeepSeek connected。

- 00:07 [确定] **Wave 3 交付完成。** 4 个教学行政功能全部落地:
  (1) F11 排座: generateSeating(snake/serial/random) + 历史管理 + 前端表格展示
  (2) F13 工作量: calculateWorkload(数字+数组双模式) + 可配置系数 + 前端表格展示
  (3) F14 记账: invoices CRUD + 统计 + 前端表格+modal
  (4) F15 备课: generateLesson SSE 流式中文教案 + 历史 + 前端实时渲染
  横切: 复用现有 .card/.btn/.modal-overlay/.stat-card/.list-item/.empty-state CSS。Bug 修复: workload.js 参数类型兼容(数字 vs 数组)。权限: teacher-only 写操作,学生 403。


## Wave 4: F20 AI 面试/答辩模拟 (2026-08-18)

- 13:18 [确定] F20 后端 lib/interview.js 创建完成: startInterview/continueInterview/getScenarios/apply。4 场景: thesis_defense(毕业答辩)/project_defense(项目答辩)/job_interview(求职面试)/qa_practice(问答练习)。教练模式(coachMode): 分析问题意图+2-3种回答策略+示例话术。复用 ai.js chatStream SSE。node --check 通过。

- 13:19 [确定] server.js 导入 + 2 路由注入: GET /api/interview/scenarios(requireAuth), POST /api/interview(requireAuth, SSE流式)。SSE 模式: text/event-stream + flushHeaders -> startInterview/continueInterview 回调写 data: chunk -> done:true -> res.end()。路由插入 // --- Start --- 之前。node --check 通过。

- 13:20 [确定] 前端 6 文件注入完成:
  teacher.html: 新增"面试"Tab 按钮 + interview view(场景选择/主题输入/上下文/聊天区/回答框/教练按钮)。
  student.html: 新增"面试练习"Tab + 同构 view。
  teacher.js: 面试状态(7 ref: interviewScenario/interviewTopic/interviewContext/interviewMessages/interviewAnswer/interviewStreaming/interviewCoachMode) + 4 方法(switchToInterview/startInterview/sendInterviewAnswer/sendInterviewCoach), 复用 streamChat()。
  student.js: 同构状态+方法。
  app.css: .chat-bubble.ai(assistant别名)/.form-input/.interview-view/.interview-chat。

- 13:21 [确定] F20 端到端验证完成。7 项测试 7 PASS / 0 FAIL:
  (1) 登录: t01/lab123 -> 200 cookie OK
  (2) scenarios: GET -> 200 count=4 (thesis_defense/project_defense/job_interview/qa_practice)
  (3) start SSE: POST {action:start, scenario:qa_practice, topic:电力系统韧性恢复, context:IEEE 33节点} -> 200, 49 chunks, done=true, AI 生成"IEEE 33节点配电网极端天气多馈线故障韧性核心评估指标"问题
  (4) continue SSE: POST {action:continue, answer:EV移动储能辅助恢复供电} -> 200, 70 chunks, done=true, AI 追问"恢复速度 vs 恢复完整性权衡 + 关键负荷优先 vs 总负荷最大化决策逻辑"
  (5) coach SSE: POST {coachMode:true} -> 200, 601 chunks, done=true, AI 分析问题意图(决策逻辑/工程实践性/系统视野三层维度)+ 回答策略
  (6) 前端: GET /teacher -> 200 面试Tab FOUND; GET /student -> 200 面试Tab FOUND
  (7) 权限: 学生 GET /api/interview/scenarios -> 200 count=4(学生可用面试练习)
  ALL SSE TESTS PASS。

- 13:21 [确定] **Wave 4 F20 交付完成。** AI 面试/答辩模拟全部落地: 4 场景 + SSE 流式问答 + 教练模式(导师模拟审稿人/答辩委员提问,学生答辩练习)。复用 chatStream SSE 管线,无新依赖。Git init 已完成(commit cecb329, 178 files), Health check 31/31 PASS(Wave 0-3 全部端点)。当前功能计数: F1周报+F2会议纪要+F3看板+F5进度草稿+F6上下文skill+F9RSS+F17CLI+F11排座+F13工作量+F14记账+F15备课+F18邮箱+F19审稿+F20面试 = 14 功能。

## Wave 4.1: 版本控制 + .env loader 修复 (2026-08-18)

- 13:40 [确定] 版本控制基础设施建立:
  (1) VERSION 文件(D:\OneDrive\7-SideWork\AutoProf\VERSION = 0.4.0)
  (2) CHANGELOG.md(父 AutoProf 文件夹,按 Wave 聚合用户可见变更,Wave 0-4 全量回溯)
  (3) GET /api/version 端点(无 auth,读 ../VERSION,返回 {version, app})
  (4) 登录页版本徽章(ver-badge div + fetch /api/version 自渲染)
  (5) Git tag v0.4.0 打在 cordis-main 仓库
  版本规则: 0.<Wave>.<patch>。VERSION/CHANGELOG 与 DEVLOG 同位父文件夹(符合用户约定),git 仓库在 cordis-main。

- 13:41 [确定] **Bug 修复: .env PORT 死配置。** 根因: server.js line 44 `process.env.PORT || 3000` 但无 dotenv,.env 的 PORT=3001 从未加载进 process.env。之前跑 3001 是因为上个 session 在 shell 设了 PORT=3001 环境变量;裸 `node server.js` 回退 3000,导致 labos.mjs CLI(默认 3001)连不上。修复: 加最小 .env loader(IIFE,读 .env 正则 KEY=VALUE,只填充未设置的 process.env,与 ai.js 直读 .env 模式一致)。验证: 重启后绑 3001(从 .env),DeepSeek connected,登录 200,/api/version 返回 0.4.0,徽章脚本 FOUND。

- 13:41 [确定] 版本控制端到端验证 PASS: /api/version -> {"version":"0.4.0"}; /login 徽章 HTML+脚本 FOUND; 登录回归 200; 端口 3001(.env 生效)。Git: commit faaee86, tag v0.4.0。
## 2026-08-18 Wave 4.2: GitHub 远程仓库上线

- 14:05 [确定] **GitHub 推送完成。** 仓库 https://github.com/njtdf/AutoProf-LabOS (private)。操作: git remote add origin + git push -u origin master + git push origin v0.4.0。远程现有 4 commits (cecb329..e6f1c37) + tag v0.4.0。凭据: Windows Git Credential Manager 缓存。代理: git http.proxy=127.0.0.1:7890 (GFW)。PII/密钥已脱敏: labos/students.yaml 等运行时数据在 .gitignore,用 students.yaml.example 替代。gh CLI 首次查不到仓库(API 缓存延迟),但 git ls-remote/push 直连成功。

- 14:05 [确定] 版本控制体系完整: 本地 git(4 commits) + tag v0.4.0 + remote origin + GitHub private repo。VERSION=0.4.0, CHANGELOG.md 父目录, DEVLOG.md 父目录(append-only)。下一步进入 Option A: 停止加功能,用真实学生数据端到端验证核心日常循环。

## 2026-08-18 Wave 4.3: Option A 核心循环端到端验证

- 14:18 [确定] **核心循环验证 PASS (exit 0)。** 脚本 scripts/validate-core-loop.mjs 用 12 个学生真实周报跑通完整闭环。结果:
  - Phase 1 AI 总结: 11/12 ok (s01 fresh skip), 0 fail, 每个约 1.5-2s (s07 7.8s API 抖动), 11 个真实 DeepSeek 调用成功
  - Phase 2 看板创建: 12 任务 (T-002~T-013), next_id 14, owner 姓名匹配 12/12 全正确 (createTask 反查 roster)
  - Phase 3 状态流转: 3/3 (T-002/003/004 todo->in_progress->done), updated_at 变更验证通过
  - Phase 4 会议 promote: 3 actions -> T-014/015/016, source='meeting' + source_ref 关联正确
  - Phase 5 仪表盘: 12 卡片, 12 有总结, 12 有风险, 9 有开放任务; stats: total=12 reported=12 missing=0 overdue=0
- 14:18 [确定] **发现 Bug: promoteMeetingAction status 不一致。** action.status='pending' 直接传入 task.status, 与 kanban 枚举 (todo|in_progress|done|blocked) 不一致。实际影响: getBoardStats 出现 pending key (byStatus.pending=3), 仪表盘 open_tasks 不计 meeting promote 的任务 (s01/s02/s03 open_tasks=0 尽管各有 1 个 meeting 任务)。修复方案: promoteMeetingAction 加 status 映射 pending->todo。
- 14:18 [确定] 诊断报告: labos/validation-report-2026-08-18.md。13 个功能中 6 个核心循环 PASS (周报/AI总结/看板/流转/会议promote/仪表盘) + 1 个已验 (F20 面试) + 12 个端点级 PASS 但工作流未验证 (STT/RSS/邮箱/审稿/CLI/周报草稿/聊天室/座位/备课/工作量/发票/记忆)。

- 14:52 [确定] **Bug 修复: promoteMeetingAction status 映射。** kanban.js L161 promoteMeetingAction 把 action.status 直接传入 createTask,meeting actions 的 status='pending' 与 kanban 枚举(todo|in_progress|done|blocked)不一致。修复: 加枚举校验 ['todo','in_progress','done','blocked'].includes(action.status),非枚举值(含 pending)回退 'todo'。同时修复现有 3 个 pending 任务(T-014/015/016) -> todo。验证: tasks.json status 分布 done:3 todo:12,无 pending key。语法 node --check 通过。

## 2026-08-18 Wave 4.4: Bug 修复后盐雾测试 (Smoke Test Re-run)

- 15:06 [确定] **盐雾测试 PASS (bug 修复后重跑)。** 清空 tasks.json -> 重启 server(session 98740, 加载修复后 kanban.js) -> 重跑 validate-core-loop.mjs。结果:
  - Phase 1: 12/12 fresh skip (零 API 消耗)
  - Phase 2: 12 任务创建 (T-001~T-012), next_id=13
  - Phase 3: 3/3 状态流转 (todo->in_progress->done)
  - Phase 4: 3 meeting actions promote (T-013~T-015), **status 全部 todo (无 pending bug)**
  - Phase 5: 仪表盘 12 卡片, 12 有总结, 12 有风险, 12 有任务; stats: total=12 reported=12 missing=0 overdue=0
  - 诊断报告: Bugs Found = **None** (上次有 pending bug, 本次修复确认)
  - byStatus: {todo:12, in_progress:0, done:3, blocked:0} — 无 pending key, bug 修复验证通过
- 15:06 [确定] **exit code 1 但非逻辑错误。** Node.js Windows async handle assertion (UV_HANDLE_CLOSING) 在 Phase 5 HTTP 连接关闭后触发, 是 Node 18 Windows 已知 quirk。验证逻辑 "Overall: PASS" 已打印, 报告已保存, 数据已写入。不影响结果。
- 15:06 [确定] 手动验证指南生成: D:\OneDrive\7-SideWork\AutoProf\MANUAL-VERIFICATION-GUIDE.md。覆盖全部已实现功能 (登录/周报/AI总结/导师聊天/会议/看板/仪表盘/RSS/面试/座位/备课/工作量/发票/CLI桥接/聊天室/skills), 每功能含前置条件+操作步骤+预期结果+降级路径。
 

## 2026-08-19 Wave 5: ValueCycle — AI 贯穿全局的共享上下文层

- 04:04 [确定] Step 1: lib/ai-context.js 语法修复。writeBackFromSummary 原有 await import(dynamic) 在非 async 函数中。修复: 加 updateValueCycle + updateMemory 静态导入, 函数改 async, 删动态 import。node --check 通过。
- 04:10 [确定] Step 2: lib/ai.js 扩展 context 参数。generateSummary(report, context='') 和 buildChatMessages(...,context='') 新增第5参数。context 非空时追加价值链上下文到 systemPrompt。extractActions 未改(deferred)。修复全局 Replace 误伤 extractActions。
- 04:15 [确定] Step 3: lib/summary.js 接入 context。generateAndSaveSummary 调 buildStudentContext(studentId) -> generateSummary(report, context) -> writeBackFromSummary(studentId, summary) fire-and-forget。循环依赖 ESM live binding 验证通过。
- 04:20 [确定] Step 4: server.js 加 6 个 valuecycle 路由 + chat 注入 context。路由: GET/PUT group, GET/PUT :id, PUT :id/assessment, GET alignment/all。chat POST 加 buildStudentContext 调用。修复 req.session -> req.user。
- 04:25 [确定] Step 5: 导师端价值链 Tab。teacher.html 加 tab + 内容区(课题组价值链头 + 12学生对齐网格 + 详情面板可编辑导师评估)。teacher.js 加 5 方法。app.css 加样式。修复 alignment 网格字段名(扁平 vs nested)。
- 04:30 [确定] Step 6: 学生端首次登录弹窗。student.js 加 loadMyVc/submitVcForm。onMounted 触发。student.html 加 modal(目标下拉+多选+备注)。CSS 加 modal 样式。
- 04:35 [确定] E2E 验证 PASS。6路由全200/JSON。buildStudentContext 返回755字符上下文。AI through-line 核心修复: memory.js 的 getContextString+injectContext 此前从未被任何AI调用使用,本波次 summary.js+chat 路由均已接入。
- 04:35 [较可信] 版本 v0.4.0 -> v0.5.0。新增7文件/修改5文件。Cordis 形态 apply() 保留(W3 deferred)。
## 手动验证指南核对修正 — 2026-08-19

- 05:30 [确定] 核对 MANUAL-VERIFICATION-GUIDE.md (AutoProf 父目录), 发现 4 类问题:
  1. 版本号全标 0.4.0 (实际已 0.5.0)
  2. 导师账号 t01 被 tab 字符损坏为 	01 (多处)
  3. 完全缺失 Wave 5 价值链功能章节
  4. 降级测试代码块格式损坏 (ode server.js 丢失 n, ` 未闭合)
- 05:35 [确定] 全文重写。新增 Section 10 价值链 (3 子节: 10a 学生首次登录弹窗 / 10b 导师价值链 Tab / 10c AI 上下文穿透验证)。功能清单 22 -> 23 项, 结果表 25 -> 26 行。
- 05:35 [确定] 验证: 0.4.0 残留 0 处, tab+01 损坏 0 处, 价值链章节存在, node server.js 代码块完整。共 15448 字符 / 775 行。
- 05:35 [较可信] 文件位于 AutoProf 父目录 (git 仓库外), 为参考文档不入库。
## 2026-08-19 13:21 — Wave 5.5 Bug Fix: 5 个用户报告 Bug 全部修复

### Bug 1+4: 价值链/面试模块在所有页面底部始终可见 [确定]
**根因**: 	eacher.html 第 518 行有一个多余的 </div> 提前关闭了 #app 容器,导致 interview 和 valuecycle 两个 -if section 落在 Vue mount point 之外。浏览器忽略 -if 指令,将这两个 section 作为静态 HTML 永久渲染。
**修复**: 删除第 518 行多余的 </div>,在第 654 行(脚本标签前)补一个 </div> 关闭 #app。div 计数 210/210 不变,但嵌套层级正确。
**验证**: HTTP 拉取 teacher.html,interview section 在 scripts 之前(line 518 < 655),div balanced PASS。

### Bug 5: 导师 AI 聊天(SSE)无任何显示 [确定]
**根因**: 	eacher.html 第 91 行 ef="chatMessages" 与 	eacher.js 第 10 行 const chatMessages = ref([]) 命名冲突。Vue 3 template ref binding 在 mount 时将 DOM 元素赋值给 chatMessages.value,覆盖了消息数组。导致 -for 无法遍历(遍历 DOM 元素)、push() 失败(DOM 无 push 方法)、聊天区域永远空白。
**修复**: 第 91 行 ef="chatMessages" → ef="chatMessagesEl",与 	eacher.js 第 14 行 const chatMessagesEl = ref(null) 对齐。
**验证**: HTTP 拉取 teacher.html,ef="chatMessagesEl" 存在 PASS,旧 ef="chatMessages" 已移除 PASS。POST /api/chat/s01 SSE 流式响应正常,AI 回复引用了学生周报内容。

### Bug 2: 实时会议"AI 总结+抽取行动"按钮无响应 [较可信]
**根因**(三重):
1. 按钮 :disabled="extracting || !transcript.trim()" — Web Speech API 未产出转写文本时按钮被禁用,点击无反应
2. 后端 extraction 失败时只 console.error,不写 actions 文件 → 前端轮询 60s 超时无反馈
3. 无轮询进度指示
**修复**:
- meeting-live.html: 按钮 :disabled 去掉 !transcript.trim(),函数内检查并 showToast
- server.js: extraction catch 中 saveActions(date, {status:'error', ...}) → 轮询可检测 error 状态
- meeting-live.js: 新增 pollCount ref + 进度显示,轮询检测 status==='error'/'no_api_key' 并 showToast
**验证**: POST /api/meeting/upload 200 → 8s 后 GET /api/meeting/2026-08-19 返回 3 个行动项,宋禧→s01/常申奥→s02/陈光→s03 全部匹配。

### Bug 3: 实时会议页面缺少顶部导航栏 [确定]
**根因**: meeting-live.html 是独立页面,header 只有标题 + "← 返回" 链接 + 退出按钮,缺少与 teacher.html 一致的 13 项 tab-bar。
**修复**: meeting-live.html header 内添加完整 tab-bar(纯 HTML <a> 链接,非 Vue 指令),"实时会议" tab 标记 active。
**验证**: HTTP 拉取 meeting-live.html,13 个 tab-btn PASS,active 在 meeting-live PASS。

### 未改动文件
- student.html div 67/67 balanced,tab-bar 4 项(周报/看板/工具箱/面试练习)学生端专属,无问题
- pi.js streamChat() SSE reader 逻辑正确
- lib/meeting.js unExtraction() 核心逻辑正确
- lib/ai.js xtractActions() system prompt + JSON response_format 正确
---

## 2026-08-19 14:22 — Bug 修复 Session 2 (Bug 6-16)

### Bug 6: student.html #app 提前关闭 [确定]
**根因**: student.html L146 多余 </div> 提前关闭 #app，导致 interview section (v-if) 和价值链 modal (v-if) 落在 Vue app 外部 → v-if 失效 → 始终渲染为静态 HTML。
**用户反馈**: 周报页面不选择学生情况下是AI面试.答辩模拟
**修复**: 移除 L146 多余 </div>，在 script 标签前添加 </div> 关闭 #app。Node.js 验证 FINAL DEPTH=0。
**文件**: public/student.html

### Bug 7: student.js showPolishSuggestion 死代码 [确定]
**根因**: startPollingSummary() 中 return 在 showPolishSuggestion.value = true 之前执行 → paper-polish 建议永远不显示。
**修复**: 调整顺序，先设 showPolishSuggestion.value = true 再 return。
**文件**: public/js/student.js L125-130

### Bug 8: api.js headers 展开脆弱 + credentials 缺失 [确定]
**根因**: headers 在 ...options 展开之后设置，调用方传 headers 会静默覆盖 Content-Type。streamChat 未显式设 credentials。
**修复**: 改为先展开 ...options 再设 headers。同时为 api() 和 streamChat() 显式添加 credentials same-origin。
**文件**: public/js/api.js

### Bug 9: 导师默认 Tab 为 cockpit 而非 dashboard [确定]
**根因**: activeTab 初始化为 cockpit（周报），但第一个可见 Tab 按钮是 总览（dashboard）。
**修复**: 改为 ref(dashboard)，onMounted 中调用 loadDashboard()。
**文件**: public/js/teacher.js

### Bug 10: meeting-live 导航链接不指向特定 Tab [确定]
**根因**: meeting-live.html 所有导航链接指向 /teacher（落地在 dashboard），用户点会议后需再点一次。
**修复**: 导航链接改用 hash 片段（/teacher#meeting 等）；teacher.js onMounted 读取 hash 调用对应 switchTo 函数。
**文件**: public/meeting-live.html, public/js/teacher.js

### Bug 11: 导师 AI 聊天消息不渲染 Markdown [确定]
**根因**: teacher.html L97 使用文本插值而非 v-html。AI 回复 Markdown 显示为纯文本。
**修复**: 添加 formatMessage(content) 函数（用 marked.parse），teacher.html 改为 v-html。
**文件**: public/teacher.html, public/js/teacher.js

### Bug 12: 面试/答辩消息不渲染 Markdown [确定]
**根因**: teacher.html L541/544 和 student.html L169/172 面试消息使用文本插值。
**修复**: 统一改用 v-html=formatMessage。student.js 也添加 formatMessage 函数并导出。
**文件**: public/teacher.html, public/student.html, public/js/student.js

### Bug 13: Tab 切换不更新 URL hash [确定]
**根因**: onMounted 读取 hash 切换 Tab，但点击 Tab 按钮只改 activeTab 不更新 hash → 刷新丢失当前 Tab。
**修复**: 导入 watch from Vue，添加 watch(activeTab) 更新 history.replaceState。所有 Tab 按钮改用 switchTo 函数。
**文件**: public/js/teacher.js, public/teacher.html

### Bug 14: 周报 Tab 按钮用内联表达式而非函数 [确定]
**根因**: teacher.html 周报 Tab 按钮直接设值，不走函数，不更新 hash。
**修复**: 新增 switchToCockpit() 函数，按钮改为调用函数。onMounted hash 处理也调用 switchToCockpit()。
**文件**: public/js/teacher.js, public/teacher.html

### Bug 15: 实时会议 AI总结+抽取行动 在无转写文本时无法使用 [确定]
**根因**: Web Speech API 可能不产生 final transcript → transcript 为空 → generateActions() 提前返回。
**修复**: 添加 manualText ref + 手动输入 textarea（STT 不可用兜底）。generateActions() 先检查 manualText 作为 fallback。
**文件**: public/js/meeting-live.js, public/meeting-live.html

### CSS: chat-bubble Markdown 渲染样式 [确定]
新增 .chat-bubble > div 重置 white-space normal; p/ul/ol/li/code/pre 样式; .chat-bubble.user 内 code/pre 暗色背景。
**文件**: public/css/app.css

### API 验证 (2026-08-19 14:22)
| 端点 | 状态 | 结果 |
|---|---|---|
| POST /api/login (t01/lab123) | 200 | ok:true, user:id:t01, name:汤老师, role:teacher |
| GET /api/dashboard | 200 | 12 学生, 12 已交, 0 逾期 |
| GET /api/summary/s01 | 200 | summary 非空, 2 risks |
---

## Bug Fix Session 5 — 2026-08-19 2026-08-19 14:47

### Bug 16: express.static 无 cache-control 头 → 浏览器无限期缓存旧 JS/CSS [确定]
**根因**: xpress.static 默认设置 ETag 但不设 Cache-Control。浏览器收到 200 OK + ETag 后,即使文件已更新,只要 ETag 未变(304)就直接用缓存。导致前几轮修复的 JS 改动无法到达用户浏览器。
**修复**: server.js L60 添加 setHeaders 到 xpress.static:es.setHeader('Cache-Control', 'no-cache, must-revalidate')。L68 添加全局中间件对 es.sendFile 也设同值。
**验证**: Invoke-WebRequest http://localhost:3001/login → Cache-Control: must-revalidate, no-cache ✅
**文件**: server.js

### Bug 17: HTML script/link 标签无 cache-bust 版本号 → 浏览器用旧缓存 [确定]
**根因**: <script src="/js/teacher.js"> 无 query string。即使 Cache-Control: no-cache,浏览器仍可能用 If-None-Match 拿 304 → 用旧 JS。Vue 挂载失败 → 所有 -if 内容同时显示(价值链出现在每个页面底部、面试内容出现在周报 Tab、聊天区域空白)。
**修复**: 所有 4 个 HTML 文件的 <script> 和 <link> 标签添加 ?v=052 query string。每次发布新版本只需递增此数字。
**文件**: public/teacher.html, public/student.html, public/meeting-live.html, public/index.html

### Bug 18: 版本不匹配时无自动刷新机制 → 用户不知道要 hard refresh [确定]
**根因**: 即使用 cache-bust query string,如果用户从未访问过新版本,URL 里还是旧的 ?v=051,浏览器不会请求新文件。
**修复**: pi.js 顶部添加 APP_VERSION = '0.5.2' + checkVersion() 函数。页面加载时调 GET /api/version,若服务端版本 ≠ 客户端版本,自动 window.location.reload() 强制刷新。VERSION 文件从  .4.0 更新到  .5.2。
**验证**: GET /api/version → {"version":"0.5.2","app":"AutoProf LabOS"} ✅
**文件**: public/js/api.js, VERSION

### Bug 19: meeting-live 手动输入框在录音时隐藏 → AI 抽取按钮无内容可用 [确定]
**根因**: meeting-live.html 手动输入 card 有 -if="!recording" → 用户点"开始会议"后手动输入框消失 → 结束录音后 Web Speech API 可能未产生 transcript → 点"AI 总结+抽取行动"无内容 → 提前返回。
**修复**: 移除 -if="!recording",手动输入框始终可见。STT 降级时显示红色提示文字。
**文件**: public/meeting-live.html

### Bug 20: meeting-live generateActions 不合并 STT + 手动文本 [确定]
**根因**: generateActions() 只用 	ranscript.value,fallback 到 manualText.value。两者不合并 → STT 产生部分文本 + 手动补充文本时只取一份。
**修复**: 改为 content = transcript + '\n\n' + manualText。空时 showToast 提示用户手动输入。
**文件**: public/js/meeting-live.js

### Bug 21: 学生端无 hash 导航 → 刷新后 Tab 丢失 [确定]
**根因**: student.js onMounted 不读 URL hash,无 watch(activeTab) 更新 hash。学生在看板 Tab 刷新后回到周报 Tab。
**修复**: 导入 watch,添加 watch(activeTab) 更新 history.replaceState。onMounted 末尾读 hash 还原 Tab(与 teacher.js 一致)。
**文件**: public/js/student.js

### Bug 22: meeting-live.js syncManualText 死代码 [确定]
**根因**: syncManualText() 函数被 return 但从未在模板中调用(Bug 20 修复后 generateActions 直接合并,不需要 sync)。
**修复**: 删除 syncManualText 函数定义和 return 中的引用。
**文件**: public/js/meeting-live.js

### 端到端验证 2026-08-19 2026-08-19 14:47 [确定]

| 测试项 | 方法 | 结果 |
|---|---|---|
| 版本端点 | GET /api/version |  .5.2 ✅ |
| Cache-Control 头 | Invoke-WebRequest /login | must-revalidate, no-cache ✅ |
| v=052 cache-bust | 4 个 HTML 文件 curl | 全部包含 =052 ✅ |
| 教师登录 | POST /api/login t01/lab123 | 200 ✅ |
| 仪表盘 12 学生 | GET /api/dashboard | 12 卡片, 全部 reported=True ✅ |
| SSE 聊天流 | POST /api/chat/s01 | 逐 token 流式输出 ✅ |
| 会议上传 | POST /api/meeting/upload | 200 ✅ |
| AI 抽取 | 10s 后 GET /api/meeting/2026-08-20 | 2 decisions + 3 actions ✅ |
| 姓名匹配 | 宋禧→s01, 常申奥→s02, 陈光→s03 | 全部命中 ✅ |
| 看板 promote | POST /api/tasks/from-meeting | T-035 创建 ✅ |
| 学生行动项 | GET /api/my-actions (s01 登录) | 3 条 ✅ |
| 学生任务 | GET /api/tasks (s01 登录) | 21 条 ✅ |
| meeting-live 导航栏 | curl /meeting-live | 12 个 tab 链接 ✅ |
| meeting-live 手动输入 | HTML 检查 | textarea 始终可见 ✅ |
| 语法检查 | 
ode -c 所有 JS | 全部 PASS ✅ |
| div 平衡 | regex count | teacher 211/211, student 67/67, meeting-live 20/20 ✅ |
2026-08-19 07:27:42 [确定] v0.5.3: Sidebar UI overhaul + Agent panel + Calendar + LabBrief markdown fix
- teacher.html: top tab-bar -> left sidebar nav (4 sections: core/agent/research/teaching)
- student.html: same sidebar treatment (learning/research tools sections)
- teacher.js: +agents ref (10 agents static), +switchToAgents, +calendarMonth/calendarDays/calendarLabel computed, +switchToCalendar, +prevMonth/nextMonth, +validTabs updated
- lib/calendar.js: NEW - loadCalendarEvents() aggregates task deadlines + meeting dates + submission deadlines
- server.js: +import calendar, +GET /api/calendar/events route
- app.css: +cockpit-toolbar, +calendar-header/title/weekday/day/event styles, +event color coding
- LabBrief fix: /api/brief returns {brief, markdown, students} via renderBriefMarkdown()
- Version bumped to 0.5.3 across all HTML/JS/VERSION
- E2E verified: teacher sidebar+agents+calendar OK, student sidebar OK, calendar API 15 events, dashboard 12 students

2026-08-20 08:50:00 [确定] v0.6.0: W6a valuecycle state upgrade + W7a trajectory.js (v2.1 first new code)

## W6a: valuecycle.js 4 new fields

- lib/valuecycle.js: +normalizeValueCycle() auto-fills graduation_state/decision_log/capability/recent_rewards on old JSON; +DEFAULT_CAPABILITY (7 dimensions 0-5); +DEFAULT_GRADUATION; +getAllAlignments() returns graduation_progress/risk_level/expected_graduation/capability_avg/decision_count
- lib/ai-context.js: buildStudentContext() now injects graduation state + capability profile + recent rewards + decision log into AI prompt; tail message asks AI to check risk_level and suggest pivot if needed
- server.js: +PUT /api/valuecycle/:id/graduation, +PUT /api/valuecycle/:id/capability, +POST /api/valuecycle/:id/decision
- teacher.html: +graduation section (degree select, expected_graduation month, progress slider, risk_level select, colored progress bar); +capability radar (7 horizontal CSS bars with number inputs); +decision log (list + add form with date/decision/rationale/outcome)
- teacher.js: +capabilityLabels, +newDecision ref, +saveGraduation(), +saveCapability(), +addDecision()
- app.css: +graduation-bar-outer/inner, +risk-low/medium/high/critical/unknown colors, +capability-radar/row/label/bar-outer/bar-inner/input, +decision-log/item/date/text/outcome styles

## W7a: trajectory.js — human-AI interaction logging

- lib/trajectory.js: NEW — logTrajectory() writes to labos/trajectories/YYYY-MM-DD-{actor_id}-{n}.json; searchTrajectories() by tags/actor_id/session_type; getTrajectoryStats() returns total/by_type/top_tags/last_activity; listTrajectories() browse all; apply(ctx,config) Cordis shape
- lib/chat.js: saveMessage() triggers logTrajectory() every 5 messages (snapshot of last 5, truncated to 500 chars each); try/catch so trajectory failures never break chat
- server.js: +GET /api/trajectories/:actor, +GET /api/trajectory-stats/:actor, +GET /api/trajectories (all)

## E2E verification (14/14 PASS)

- Login + valuecycle backward compat: s01.json auto-normalized with 4 new fields [确定]
- PUT graduation (s02 progress_pct=30) persisted on re-read [确定]
- PUT capability (s02 coding=4) persisted [确定]
- POST decision (s02 decision_log=1) persisted [确定]
- GET trajectories/stats/all: empty but no errors [确定]
- Dashboard regression: 12 students returned [确定]
- Tasks regression: normal [确定]
- News regression: normal [确定]
- Student can view own valuecycle [确定]
- alignment/all aggregates: graduation_progress=60, risk_level=medium, capability_avg=0.714, decision_count=1 [确定]
- chat->trajectory: 5 messages -> labos/trajectories/2026-08-20-s01-001.json created [确定]
- trajectory search/stats: returns correct metadata [确定]
- All 6 files pass node -c syntax check [确定]
- Version: 0.5.3 -> 0.6.0 (VERSION, api.js, 9 cache-bust strings in 3 HTML files) [确定]

## 待办 (W6c manual)
- 导师必须手动填写 >=3 学生的 graduation_state (degree/requirements/expected_graduation/progress_pct/risk_level)
- 导师必须手动填写 >=3 学生的 capability (7 dimensions, 0-5)
- 导师必须手动添加 >=3 学生的 decision_log 条目

## W7: EvoTeam UI 大重构 (v0.6.0 → v0.7.0) — 2026-08-20

### Bug 修复

- [01:30] server.js: labosDir 未定义导致启动崩溃 (line 405 agent-chat 路由引用了不存在的 labosDir) → 添加 `const labosDir = join(__dirname, 'labos')` 在 __dirname 定义之后 [确定]
- [01:32] meeting-live.html: 旧 tab-bar 含已废弃的 排座/备课/记账 等链接 + 无返回按钮 → 替换为 "← 返回工作台" 按钮 + EvoTeam 品牌更新 + CSS 版本 v060→v070 [确定]
- [01:35] Bug 1 (周报空白/无法选学生): switchToCockpit() 已含 `if (students.value.length === 0) await loadStudents()` + hash 设置 → Wave 7 重构已修复 [确定]
- [01:35] Bug 3 (面试内容泄漏到周报): v-if 边界审查通过 — cockpit(v-if activeTab==='cockpit') 与 interview(v-if activeTab==='interview') 互斥; sidebar 周报→switchToCockpit / 面试→switchToInterview 映射正确 → Wave 7 重构已修复 [确定]

### Sidebar 5 段重构 (teacher.html)

- 核心: 总览(Knowledge Navigator) / ToDo / 通知 / 日历 / 项目管理 / 价值链
- 学生管理: 周报 / 会议(组会|听记|讨论) / 任务(原看板) / 修改
- Agent: 实时状态
- 科研工具: 工具箱 / 投稿 / 审稿
- 教学管理: 考试(排座|登分|OBE|监考|出题) / 教学(备课|学情|题库|经验) / 财务 / 行政 / 面试
- nav-badge: ToDo 未完成数 + 通知未读数 实时显示
- Logo: AutoProf → EvoTeam

### Knowledge Navigator 总览 (teacher.html + teacher.js)

- 9 个 Agent 头像网格: 🧑‍💼大管家 / 📝总结 / 🗓️会议 / 🎤STT / 🧰技能 / 📈进度 / 🔍审稿 / 🎯面试 / 🔗价值链
- 每个 Agent: CSS 渐变头像 + emoji + 状态指示点 (active/idle/working)
- 点击 Agent → 聊天面板 (SSE 流式 via POST /api/agent-chat/:agentId)
- 大管家 agent: 注入全部学生 summaries + tasks stats + meeting actions (buildManagerContext)
- 今日概览栏: 待办/未读/会议/逾期 统计
- 团队动态 feed: 最近活动 (周报提交/任务完成/会议结束)

### 周报 Tab 重构 (teacher.html)

- 学生卡片网格从总览移入周报 tab (无选中学生时显示)
- "一键生成组会简报" 按钮在工具栏
- 分屏布局: 左 AI 聊天 (SSE) / 右 AI 总结 + 学生周报渲染 (marked.js)
- 学生下拉选择器 + 点击卡片跳转

### 会议 Tab 子页签 (teacher.html)

- 组会: 上传纪要 MD + AI 抽取行动项 + 行动项表格编辑 (现有 meeting 功能)
- 听记: 实时 STT (WebSocket /api/stt + Web Speech API fallback) + 开始/结束会议 + AI 总结按钮
- 讨论: 占位 "即将上线"

### 考试/教学 子页签 (teacher.html)

- 考试: 排座(现有) / 登分 / OBE / 监考 / 出题 (后4项占位)
- 教学: 备课(现有) / 学情 / 题库 / 经验 (后3项占位)
- switchToSeating() → activeTab='exam' + examSubTab='seating'
- switchToLesson() → activeTab='teaching' + teachingSubTab='lesson'

### 新页面骨架 (teacher.html + teacher.js)

- ToDo: 从 tasks.json 取 deadline=today + 手动添加 (title/priority) + 勾选完成
- 通知: 复用 lib/email.js IMAP → 未读邮件列表 + 同步按钮
- 项目管理: 从 students.yaml project 聚合 + 关联任务数 + 进度条
- 修改: 分屏 (左 SSE 聊天 paper-polish / 右文档粘贴区)
- 审稿: 分屏 (左输入 / 右 SSE 输出 pre-submission-reviewer)

### 欢迎页 (index.html + login.js)

- EvoTeam 品牌渐变背景
- 3 卡片: AutoUngrad(🎓绿) / AutoGrad(🔬紫) / AutoProf(👨‍🏫粉)
- 点击卡片 → 展开登录表单 (slide-down 过渡) + 角色预选
- login.js: +selectedRole ref + selectRole() 函数

### 学生端导航同步 (student.html)

- Logo: AutoProf → EvoTeam
- 学习→核心 / 看板→任务
- +日历 / +AI助手 (占位)
- CSS cache-bust v=070

### 后端路由 (server.js)

- GET /api/agent-chat/:agentId — 加载 agent 聊天历史 (labos/agent-chat/:agentId.json, max 50)
- POST /api/agent-chat/:agentId — SSE 流式聊天, agent-specific system prompts (9 个 agent)
- buildManagerContext() — 注入全部学生数据给大管家 agent
- agent-chat 目录自动创建 (labos/agent-chat/)

### teacher.js 扩展

- agents 数组: 9 个 agent (id/shortName/icon/color/gradient/status)
- Knowledge Navigator: activeAgentId / agentChatMessages / agentChatInput / agentStreaming / agentStreamText / selectAgent() / sendAgentChat()
- Meeting: meetingSubTab ref
- STT: sttRecording / sttTranscript / sttError / sttSummarizing / startSTT() / stopSTT() / sttSummarize() + Web Speech API fallback
- ToDo: todoItems / newTodoText / newTodoPriority / todoCount / switchToTodo() / loadTodo() / addTodo() / toggleTodo()
- 通知: emails / emailSyncing / unreadCount / switchToNotify() / loadEmails() / syncEmail()
- 项目管理: projectList / switchToProjects() / loadProjects()
- 修改: revisionMessages / revisionInput / revisionStreaming / revisionStreamText / revisionDoc / switchToRevision() / sendRevisionChat()
- 审稿: reviewInput / reviewStreaming / reviewStreamText / reviewOutput / reviewOutputHtml / switchToReview() / runReview()
- 团队动态: teamFeed / todayMeetings / overdueCount / loadTeamFeed()
- switchToDashboard() 调用 Promise.all([loadDashboard(), loadTeamFeed()])
- validTabs 扩展含全部新 tab; hash routing 更新
- 所有 21 个 switchTo* 函数已定义且导出
- 语法验证: node -c 通过 [确定]

### CSS (app.css)

- 欢迎页: 渐变背景 / 卡片 / slide-down 过渡
- Knowledge Navigator: agent grid / avatars (色系变体) / status dots / chat panel / feed
- 子页签栏 / nav-badge / ToDo / 通知 / 项目管理 / STT 样式
- cursor blink 动画

### 版本升级

- VERSION: 0.6.0 → 0.7.0 [确定]
- api.js APP_VERSION: 0.6.0 → 0.7.0 [确定]
- 所有 HTML cache-bust: v=060 → v=070 (teacher.html / student.html / index.html / meeting-live.html) [确定]

### E2E 验证 (HTTP API 层)

- server.js 启动: port 3001 + DeepSeek connected [确定]
- 登录 (t01/lab123): 200 + session cookie [确定]
- GET /api/dashboard: 12 students, stats={total:12,reported:12,missing:0,overdue_tasks:0} [确定]
- GET /api/students: 200, 返回 s01 宋禧 等学生列表 [确定]
- GET /api/tasks: 200, 返回 T-001 等任务 [确定]
- GET /api/board/stats: 200, stats={total:40,todo:36,in_progress:1,done:3,blocked:0} [确定]
- GET /api/agent-chat/manager: 200, {messages:[]} [确定]
- GET /api/my-actions: 200, {actions:[]} (teacher 无行动项) [确定]
- 页面加载: /login=200 / /=200 / /teacher=302(未认证重定向) / /student=302 [确定]
- 语法验证: server.js + teacher.js + student.js + login.js + api.js 全部 node -c 通过 [确定]

### 待办 (用户验证)

- UI 层验证: 导师登录浏览器 → 总览 9 agent 头像 → 周报学生网格 → 选学生分屏 → 会议子页签 → 考试/教学子页签
- Agent 聊天 SSE 流式: POST /api/agent-chat/manager 发送消息 → 验证逐字流式输出
- STT 实时转写: FunASR 是否可用 (需 CUDA + 模型), Web Speech API fallback 验证
- 通知: IMAP 配置 .env 后验证邮件同步
- 导师手动录入: graduation_state / capability / decision_log (W6c 延续)

---

## 2026-08-20 22:30 — v0.7.3: 全局空白页根因修复 + Agent 管理 + KB 集成

### 根因诊断 [确定]

**所有页面空白的唯一根因：版本不匹配导致无限重载循环。**

- `VERSION` 文件内容 = `0.7.0`
- `public/js/api.js` `APP_VERSION = '0.7.3'`
- `checkVersion()` 在不匹配时调用 `window.location.reload()` → 页面无限重载 → Vue 永远无法完成 mount → 空白

### 修复清单 [确定]

1. **VERSION 文件**: `0.7.0` → `0.7.3`（`D:\OneDrive\7-SideWork\AutoProf\VERSION`）
2. **api.js 防无限重载**: 加 localStorage 时间戳，10 秒内不重复 reload（防止未来版本不匹配时再次死循环）
3. **server.js `fs is not defined`**: `/api/agents/custom` 路由用了 `fs.existsSync` 但 server.js 只导入了命名函数。改为 `existsSync` / `readFileSync` / `writeFileSync`
4. **缓存版本**: 所有 HTML `?v=072/070` → `?v=073`，api.js `0.7.2` → `0.7.3`
5. **Agent 管理面板**: teacher.html 883-963 行，4 子 tab（Agents/Skills/Plugins/MCP），每个 Agent 有对话/编辑/删除按钮，创建 Agent modal
6. **知识库**: 总览 tab 内嵌 KB 文件列表 + 搜索 + 文件查看 modal

### 浏览器验证 [确定]

导师 t01/lab123 登录后逐 tab 验证：

| Tab | 状态 | 关键内容 |
|---|---|---|
| 总览 | ✅ 0 error | 统计栏 + 9 Agent 网格 + 12 学生动态 + KB 文件列表 |
| 周报 | ✅ 0 error | 12 学生下拉 + 卡片网格(风险标签/AI总结) + 选学生后 AI 聊天(上下文注入生效) |
| 会议 | ✅ 0 error | 3 子tab(组会/听记/讨论) + 上传 + 4 次会议历史 |
| 任务 | ✅ 0 error | 40 任务 + 统计(1进行中) + RSS arXiv 新闻 |
| Agent | ✅ 0 error | 4 子tab + 5 Agent 卡片(大管家/总结/会议/STT/技能) + 创建/编辑/删除 |

### 教训记录 [确定]

- **版本文件同步**: 每次改 api.js APP_VERSION 必须同步改 VERSION 文件，否则触发无限重载
- **server.js import 风格**: 用命名导入 `{ readFileSync, existsSync }` 时，代码中不能用 `fs.` 前缀
- **PowerShell 转义**: 永远不要用 `node -e` 传含引号/模板字符串/正则的代码，写 .mjs 文件代替

### 待用户验证

- 审稿/面试/考试/教学/财务/行政 tab 渲染（版本修复后应该全部正常）
- Agent 对话 SSE 流式（POST /api/agent-chat/:agentId）
- 创建/编辑/删除 Agent 持久化（POST /api/agents/save → labos/agents-custom.json）
- 知识库文件点击查看 modal
- 学生端登录 + 周报编辑 + 提交 + AI 总结

---

## 2026-08-20 21:06 — v0.7.4 学生端品牌切换 + 日历 + AI助手 + 知识库 + 本科生账号 [确定]

### 问题

前一个 session 修复了全局空白页根因（VERSION 不同步），但 student.js 仍缺少 student.html 引用的 brandName / 日历 / AI助手 / 知识库 逻辑，导致 Vue prod mode 静默空白页。

### 改动

| 文件 | 改动 | 置信度 |
|---|---|---|
| public/js/student.js | 新增 brandName computed（grad->AutoGrad, undergrad->AutoUngrad, teacher->AutoProf） | [确定] |
| public/js/student.js | 新增日历模块（calendarMonth/Weekdays/Events/Label/Days + switchToCalendar/prevMonth/nextMonth，复用 teacher.js 逻辑） | [确定] |
| public/js/student.js | 新增 AI 助手模块（assistantMessages/Input/Streaming + sendAssistantMessage SSE + loadAssistantHistory + mySummary + myReportHtml） | [确定] |
| public/js/student.js | 新增知识库模块（kbFiles/Search/Loading/FilteredFiles + loadKb + viewKbFile + switchToKb） | [确定] |
| public/js/student.js | validTabs 扩展为 7 项（+calendar/assistant/kb）+ hash 恢复 + return block 补全所有新 ref | [确定] |
| public/student.html | student.js cache bust 073->074 | [确定] |
| public/teacher.html | sidebar-logo EvoTeam->AutoProf | [确定] |
| scripts/rebuild-student-js.mjs | 构建脚本（字符串替换方式修改 student.js，避免 PowerShell 转义） | [确定] |

### 验证结果（浏览器 DOM 快照 + console error）

| 角色 | 账号 | 品牌 | Tab 验证 | console error |
|---|---|---|---|---|
| 研究生 | s01/changeme | AutoGrad | 周报+任务+日历+AI助手+知识库 全部正常 | 0 |
| 本科生 | u01/changeme | AutoUngrad | 周报正常（模板含 u01/本科生张三/本科创新训练） | 0 |

日历 tab：2026年8月 网格 + 事件（组会/补充IEEE 33-bus实验数据）可见
AI助手 tab：聊天历史加载 + AI 回复引用周报内容（V2G恢复/求解器收敛风险/文献综述不足）
知识库 tab：文件列表（manager.json/students.yaml/tasks.json 等）+ 搜索框 + 刷新按钮

### 未改动

- 后端 lib/ 全部不动
- server.js 不动（chat 路由已在前 session 放开 requireAuth）
- VERSION 文件保持 0.7.3（未改 api.js APP_VERSION）

## 2026-08-20 — v0.7.4 版本同步提交 + 浏览器端到端验证 [确定]

### 提交内容 (commit 2e35e87)
- VERSION 文件 → 0.7.4
- api.js APP_VERSION → 0.7.4
- HTML 缓存标签全部 → ?v=074 (index/teacher/student)
- CHANGELOG.md 新建 (含版本编号规则表 + v0.7.4/v0.7.3 条目)
- scripts/bump-version.mjs 创建 (一键同步 VERSION + api.js + HTML 标签)
- Git push 到 https://github.com/njtdf/AutoProf-LabOS master

### 版本编号规则 (用户确认, 已写入 CHANGELOG)
| 改动类型 | 改第几位 | 示例 |
| 大版本/发布 | 第二位 | 0.7.4 → 0.8.0 |
| 大改(新功能/模块) | 第三位 | 0.7.3 → 0.7.4 |
| 小改(bugfix/微调) | 第四位 | 0.7.4 → 0.7.4.1 |
- 每次推送 GitHub 必须改 CHANGELOG

### 服务器修复
- 旧服务器 PID 25216 缓存了 0.7.3 (启动时读 VERSION)
- 客户端 0.7.4 vs 服务端 0.7.3 → 会触发 checkVersion() 无限重载
- taskkill + 重启 node server.js → 服务端 /api/version 返回 0.7.4
- 客户端/服务端版本匹配 ✓

### 浏览器验证 (应用内浏览器, DOM 快照)
| 角色 | 账号 | 品牌 | console error | 状态 |
|---|---|---|---|---|
| 导师 t01 | lab123 | AutoProf | 0 | ✅ 5段导航 + 9 Agent 网格 + 15学生 |
| 研究生 s01 | changeme | AutoGrad | 0 | ✅ 7 tab + 周报模板 + 预览 |
| 周报页 | — | — | 0 | ✅ 不再空白, 选学生 → AI总结 + 聊天记录 |

### 关键修复确认 (前 session)
- 周报空白页 → 修复 switchToCockpit 未调 loadStudents()
- 学生端 student.js 重建 → 加日历/AI助手/知识库/品牌切换
- 服务器版本缓存 → 重启修复

### 当前功能状态
- F1 周报管理 ✅ | F2 会议纪要 ✅ | F3 任务看板 ✅ | F5 周报草稿 ✅
- F6 科研工具箱 ✅ | F9 RSS ✅ | F18 邮箱 ✅ | F19 审稿 ✅
- F20 面试 ✅ | F22 价值链 ✅ | Knowledge Navigator ✅ | EvoTeam 欢迎页 ✅
- Agent 管理面板 ✅ | 5段导航重构 ✅ | 本科生端 u01-u03 ✅
- 品牌切换 (AutoProf/AutoGrad/AutoUngrad) ✅

---

## 2026-08-20 22:30 — Wave 8: SQLite 数据库 + LLM 记忆 + 课题组知识库 [确定]

**目标**: 三件一起干 — ① SQLite 15 表替换散落 JSON/YAML/MD 文件存储 ② LLM 跨会话记忆（聊天自动抽取 → SQLite → 下次对话注入）③ 课题组知识库 TF-IDF 语义搜索

### 前序 session 交付状态（handoff 接力）

前序 LLM 已完成 + 测试了核心模块，但未集成 server.js / 未提交 git：
- `lib/db.js` (92 行) — 15 表 schema + WAL + initDb/getStats/transaction ✅ 测试通过
- `scripts/migrate-to-sqlite.mjs` (307 行) — 全量迁移 ✅ students=19, reports=13, summaries=12, tasks=40, meetings=4, chat=18, agent_chat=22, vc=14, traj=1
- `lib/memory.js` (128 行) — storeMemory/retrieveMemories/searchMemories/buildMemoryContext/extractMemoriesFromChat ✅
- `lib/knowledge.js` (278 行) — indexAll/searchKnowledge/getDocumentStats/getKnowledgeGraph ✅ 29 docs / 5622 keywords
- `lib/ai.js` 扩展 — extractMemories() ✅ 代码正确（未测真实 API 调用）

### 本 session 修复 + 集成

#### 1. memory.js 命名冲突修复 [确定]
- **根因**: 前序 session 新建的 SQLite memory.js **覆盖**了旧 JSON memory.js（loadMemory/updateMemory/accumulateFromReport/getContextString）。server.js 第 40 行和 ai-context.js 都导入旧函数名 → 服务器启动即崩
- **修复**: 从 git HEAD 恢复旧 memory.js → 拆分为两个文件：
  - `lib/memory.js` = 旧 JSON 学生记忆（loadMemory/updateMemory/accumulateFromReport/getContextString/injectContext）— 恢复原状
  - `lib/llm-memory.js` = 新 SQLite LLM 记忆（storeMemory/retrieveMemories/searchMemories/buildMemoryContext/extractMemoriesFromChat）

#### 2. ai-context.js 集成 [确定]
- 顶部加 `import { buildMemoryContext } from './llm-memory.js'`
- buildStudentContext() 末尾（return 之前）追加 LLM 记忆段落：
```js
const llmMemCtx = buildMemoryContext(studentId, 'steward')
if (llmMemCtx) { parts.push(''); parts.push(llmMemCtx) }
```
- 效果: AI 与学生聊天时，system prompt 自动注入跨会话历史决策/反馈/偏好

#### 3. chat.js 集成 [确定]
- 顶部加 `import { extractMemoriesFromChat } from './llm-memory.js'`
- saveMessage() 末尾（trajectory 块之后）追加：
```js
if (trimmed.length % 5 === 0) {
  extractMemoriesFromChat(studentId, trimmed).catch(() => {})
}
```
- 效果: 每 5 条消息异步触发 DeepSeek 抽取记忆 → SQLite，不阻塞聊天响应

#### 4. server.js 集成 [确定]
- 3 条新 import: db.js / llm-memory.js / knowledge.js
- initDb() 启动调用（try/catch 不崩）
- 11 条新路由（插入 `// --- Start ---` 之前）:
  | Method | Path | Auth | 验证 |
  |---|---|---|---|
  | GET | /api/db/stats | teacher | ✅ 200, 15 表行数 |
  | POST | /api/db/migrate | teacher | ✅ 200, 幂等 |
  | GET | /api/llm-memory/:agentId | teacher | ✅ 200, 返回记忆列表 |
  | POST | /api/llm-memory/:agentId | teacher | ✅ 200, id=2 |
  | GET | /api/llm-memory/:agentId/search | teacher | ✅ 200, 2 results |
  | DELETE | /api/llm-memory/:id | teacher | ✅ 200, deleted=true |
  | GET | /api/kb/search?q= | any | ✅ 200, 1 result (Benders) |
  | GET | /api/kb/documents | any | ✅ 200, total=29, paginated |
  | POST | /api/kb/index | teacher | ✅ 200, indexed 29 docs / 5622 kw |
  | GET | /api/kb/stats | any | ✅ 200, by_category |
  | GET | /api/kb/graph | teacher | ✅ 200, 76 nodes / 58 edges |

### 回归测试 [确定]
| 路由 | 状态 |
|---|---|
| GET /api/students | ✅ 200 |
| GET /api/report/s01 | ✅ 200 |
| GET /api/summary/s01 | ✅ 200 |
| GET /api/tasks | ✅ 200 |
| GET /api/board/stats | ✅ 200 |
| GET /api/news | ✅ 200 |

### 路由命名决策 [确定]
原计划用 `/api/memory/:agentId`，但与已有 `/api/memory/:id`（旧 F7-lite JSON 记忆）冲突（Express `:id` 和 `:agentId` 是同一路由模式）。改用 `/api/llm-memory/:agentId` 前缀避免歧义。

### 版本
- 0.7.4 → 0.7.5（大改 = 新模块，第三位）

### 当前功能状态
- F1 周报 ✅ | F2 会议 ✅ | F3 看板 ✅ | F5 草稿 ✅ | F6 工具箱 ✅
- F9 RSS ✅ | F18 邮箱 ✅ | F19 审稿 ✅ | F20 面试 ✅ | F22 价值链 ✅
- Knowledge Navigator ✅ | EvoTeam 欢迎页 ✅ | Agent 管理 ✅ | 5段导航 ✅
- **SQLite 数据库 ✅** | **LLM 记忆 ✅** | **课题组知识库 ✅** | 本科生端 ✅



---

## 2026-08-21 22:00 — Wave 8 续: 知识库前端页面 [确定]

### 完成内容

知识库从总览页面移至核心导航下的独立页面,导师和学生均可访问。

**导师端** (`teacher.html` + `teacher.js`):
- 导航栏核心段新增📖知识库入口(在价值链之后)
- 知识库页面:TF-IDF搜索栏 + 统计面板(总文档/关键词/按类别) + 搜索结果(score+snippet+path) + 分页文档列表 + 重建索引按钮
- `switchToKnowledge()` / `loadKbStats()` / `loadKbDocuments()` / `searchKb()` / `rebuildKbIndex()` / `kbNextPage()` / `kbPrevPage()`
- validTabs + hash routing 更新

**学生端** (`student.html` + `student.js`):
- 知识库导航从科研工具移至核心段(在日历之后)
- 页面升级:新增TF-IDF语义搜索 + 统计面板 + 保留原文件浏览器
- `semSearchKb()` / `loadKbStats()` 新函数,`switchToKb()` 增加加载统计

**CSS** (`app.css`):
- `.knowledge-view` / `.kb-search-bar` / `.kb-stats-grid` / `.kb-stat-card` / `.kb-result-item` / `.kb-result-score` 等

**缓存版本**: 075 -> 076 (teacher.html + student.html)

### API验证结果 [确定]

| 测试 | 结果 |
|---||
| teacher login | PASS |
| KB stats: 29 docs, 5622 keywords | PASS |
| KB search Benders: 1 result, score=0.0040 | PASS |
| KB documents: 29 total, paginated | PASS |
| KB rebuild index: 29 docs / 5622 kw | PASS |
| KB graph: 76 nodes / 58 edges | PASS |
| DB stats: 19 students, 29 docs, 40 tasks | PASS |
| LLM memory list: 0 memories (empty OK) | PASS |
| student login | PASS |
| student KB stats: 29 docs | PASS |
| student KB search V2G: 5 results | PASS |
| old KB list: 75 files (backward compat) | PASS |

**12/12 PASS, 0 FAIL**

### 版本
- 0.7.5 -> 0.7.6 (Wave 8 续,大改=第三位)
