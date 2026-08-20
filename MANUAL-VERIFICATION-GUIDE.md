# AutoProf LabOS — 手动验证指南

**版本**: 0.5.0 | **日期**: 2026-08-19 | **服务器**: localhost:3001

---

## 前置准备

### 1. 启动服务器

```powershell
cd D:\OneDrive\7-SideWork\AutoProf\cordis-main
node server.js
```

**预期**: 终端显示 LabOS server running on http://localhost:3001 + DeepSeek: connected。

如果端口被占:
```powershell
taskkill /F /IM node.exe
node server.js
```

### 2. 打开浏览器

地址栏输入: http://localhost:3001

### 3. 账号清单

| 角色 | 账号 | 密码 | 用途 |
|---|---|---|---|
| 导师 | t01 | lab123 | 教师端全部功能 |
| 学生(研究生) | s01 | changeme | 学生端验证(宋禧) |
| 学生(研究生) | s02 | changeme | 学生端验证(常申奥) |

> 其他学生 s03~s12 密码均为 changeme。

### 4. DeepSeek API 状态

.env 文件已配置 DEEPSEEK_API_KEY。如 AI 功能无响应,检查:
```powershell
Get-Content D:\OneDrive\7-SideWork\AutoProf\cordis-main\.env | Select-String "DEEPSEEK"
```

---

## 功能验证清单

| # | 功能 | 验证状态 | 类型 |
|---|---|---|---|
| 1 | 登录 + 角色路由 | 核心循环已验 | 必验 |
| 2 | 学生周报提交 | 核心循环已验 | 必验 |
| 3 | AI 总结生成 | 核心循环已验 | 必验 |
| 4 | 导师 AI 聊天 (SSE) | 已实现 | 必验 |
| 5 | 会议纪要转行动指令 | 核心循环已验 | 必验 |
| 6 | 会议行动转看板 promote | 核心循环已验 | 必验 |
| 7 | 任务看板 (导师端) | 核心循环已验 | 必验 |
| 8 | 任务看板 (学生端) | 核心循环已验 | 必验 |
| 9 | 全局仪表盘 | 核心循环已验 | 必验 |
| 10 | 价值链 ValueCycle (Wave 5) | E2E 已验 | 必验 |
| 11 | RSS 每日新闻 | 端点 PASS | 选验 |
| 12 | F20 面试模拟 | 已验 7/7 | 选验 |
| 13 | F11 考试座位 | 端点 PASS | 选验 |
| 14 | F15 备课+演讲稿 | 端点 PASS | 选验 |
| 15 | F13 工作量计算 | 端点 PASS | 选验 |
| 16 | F14 发票管理 | 端点 PASS | 选验 |
| 17 | F17 CLI 桥接 | 端点 PASS | 选验 |
| 18 | F4 聊天室 | 端点 PASS | 选验 |
| 19 | F6 Skills 工具箱 | 端点 PASS | 选验 |
| 20 | F5 周报 AI 草稿 | 端点 PASS | 选验 |
| 21 | F18 邮箱转看板 | 端点 PASS | 选验 |
| 22 | F2 实时 STT | 端点 PASS | 选验 |
| 23 | F7 记忆系统 | 端点 PASS | 选验 |

---

## 第一部分: 核心循环 (必验, 10 项)

### 1. 登录 + 角色路由

**前置**: 服务器运行, 浏览器打开 http://localhost:3001

**步骤**:

1. 浏览器自动跳转到 /login
2. 看到三张角色卡片: **本科生** / **研究生** / **老师**
3. 点击 **"老师"**
4. 输入账号 t01, 密码 lab123
5. 点击 **"登录"**

**预期**:
- 页面跳转到 /teacher
- 顶部显示 "AutoProf Lab Cockpit" + "汤老师"
- 底部有版本徽章 0.5.0

**验证权限控制**:
1. 地址栏直接输入 http://localhost:3001/student → 应该被拒绝 (403 或重定向)
2. 退出登录
3. 用 s01 / changeme 登录 (选"研究生")
4. 地址栏输入 http://localhost:3001/teacher → 应该被拒绝

**降级**: 无

---

### 2. 学生周报提交

**前置**: 用 s01 / changeme 登录 (研究生角色)

**步骤**:

1. 登录后进入学生端 /student
2. 看到 **左右分屏**: 左边 Markdown 编辑器, 右边实时预览
3. 点击 **"模板"** 按钮 → 编辑器自动填充周报模板 (frontmatter + 6 个 section 骨架)
4. 在编辑器里修改一些内容 (比如改 "Progress" 下面的文字)
5. 右边预览区应该实时更新
6. 点击 **"提交周报"**

**预期**:
- 弹出"提交成功"提示
- 文件写入 labos/reports/s01/ 目录

**文件验证** (PowerShell):
```powershell
Get-ChildItem D:\OneDrive\7-SideWork\AutoProf\cordis-main\labos\reports\s01\ | Sort-Object LastWriteTime -Descending | Select-Object -First 3
```

---

### 3. AI 总结生成

**前置**: 刚提交周报后 (步骤 2)

**步骤**:

1. 提交后, 编辑器下方出现 "AI 总结生成中..." 提示
2. 等待 5-15 秒 (取决于 DeepSeek 响应)
3. AI 总结卡片出现, 包含:
   - **总结**: 1-2 句话描述学生做了什么
   - **风险**: 风险点列表 (进度停滞/方向偏离/技术阻塞/资源不足/数据质量)
   - **导师建议**: 给导师的讨论问题

**预期**: 总结内容与周报相关, 不是空壳。

**文件验证**:
```powershell
Get-Content D:\OneDrive\7-SideWork\AutoProf\cordis-main\labos\summaries\s01.json | ConvertFrom-Json | Select-Object summary, risks
```

**降级**: 删除 .env 里的 DEEPSEEK_API_KEY → 重启 → 提交仍成功, 但 AI 总结显示 "未配置 API Key"。

---

### 4. 导师 AI 聊天 (SSE 流式)

**前置**: 用 t01 / lab123 登录导师端

**步骤**:

1. 进入 /teacher 页面
2. 点击 **"周报"** Tab
3. 顶部学生下拉框选择一个学生 (比如 "宋禧 s01")
4. 右侧显示该学生的周报渲染 (Markdown 转 HTML)
5. 右侧上方显示 AI 总结卡片 (如果已有)
6. 左侧 **AI 聊天框** 输入: "这个学生本周进度怎么样?"
7. 点击 **发送**

**预期**:
- AI 回复逐字流式出现 (SSE), 不是一次性出现
- 回复内容引用了学生周报内容 (上下文注入生效)
- 聊天气泡式 UI, 导师消息靠右, AI 消息靠左
- AI 回复中的 Markdown 格式（列表、加粗、代码块）正确渲染为 HTML

**验证持久化**:
1. 刷新页面
2. 重新选同一学生
3. 聊天历史应该还在

**Tab 导航**:
- 点击任意 Tab 后 URL hash 更新（如 /teacher#kanban）
- 刷新页面后保持在同一 Tab（hash 读取后自动切换）
- 从 meeting-live 页面点击导航栏 → 跳转到对应 Tab（非默认总览）

**降级**: 无 API Key → AI 回复 "未配置 API Key, 无法对话"。

---

### 5. 会议纪要 → 行动指令

**前置**: 导师端登录

**步骤**:

1. 点击 **"会议"** Tab
2. 看到上传框 + 会议历史列表
3. 在上传框粘贴会议纪要 (或用测试夹具):
```powershell
Get-Content D:\OneDrive\7-SideWork\AutoProf\cordis-main\labos\meetings\_sample-2026-W33.md
```
复制内容到上传框。
4. 日期填 2026-08-18 (或当天日期)
5. 点击 **"上传并抽取"**

**预期**:
- 页面显示 "AI 抽取中..."
- 5-15 秒后, 行动项表格出现:
  - **决议** (decisions) 列表
  - **行动项** (actions) 表格: 任务 / 负责人 / 截止日期 / 状态
- 负责人列是下拉框, 已自动匹配学生 (宋禧→s01, 常申奥→s02)

**文件验证**:
```powershell
Get-Content D:\OneDrive\7-SideWork\AutoProf\cordis-main\labos\meetings\2026-08-18.actions.json | ConvertFrom-Json | Select-Object decisions, actions
```

**降级**: 无 API Key → 纪要保存成功, 但 actions 为空 + "未配置 API Key" 提示。

---

### 6. 会议行动 → 看板 promote

**前置**: 会议 Tab 已有行动项 (步骤 5)

**步骤**:

1. 在行动项表格里, 每行右侧有 **"→看板"** 按钮
2. 点击其中一行的 "→看板"

**预期**:
- 提示 "已推送到看板"
- 切换到 **"看板"** Tab → 该任务出现在 "待办" 列
- 任务 source 标签显示 "meeting"

---

### 7. 任务看板 (导师端)

**前置**: 导师端登录

**步骤**:

1. 点击 **"看板"** Tab
2. 看到四列看板: **待办** | **进行中** | **已完成** | **阻塞**
3. 每列下方有任务卡片 (标题 + 负责人 + 截止日期 + 优先级标签 + 来源标签)
4. 点击 **"+ 新建任务"**
5. 在弹窗中填写: 标题 / 负责人 (下拉选学生) / 截止日期 / 优先级
6. 点击保存 → 新任务出现在 "待办" 列
7. 找一个任务, 用状态下拉框改为 "进行中" → 卡片移到 "进行中" 列
8. 再改为 "已完成" → 卡片移到 "已完成" 列

**预期**: 任务状态切换流畅, 页面刷新后状态保持。

**文件验证**:
```powershell
Get-Content D:\OneDrive\7-SideWork\AutoProf\cordis-main\labos\tasks.json | ConvertFrom-Json | Select-Object -ExpandProperty tasks | Format-Table task_id, title, status, owner_name
```

---

### 8. 任务看板 (学生端)

**前置**: 用 s01 / changeme 登录

**步骤**:

1. 学生端页面, 点击 **"看板"** Tab
2. 只看到分配给自己的任务 (按 owner_student_id 过滤)
3. 可以修改任务状态 (todo → in_progress → done)
4. **不能** 修改: 负责人 / 优先级 / 删除任务
5. 也看到 **"我的会议行动"** 卡片, 显示分配给自己的会议行动项 (只读)

**预期**: 学生只看到自己的任务, 状态可改, 其他字段只读。

---

### 9. 全局仪表盘

**前置**: 导师端登录

**步骤**:

1. 进入导师端, 默认显示 **"总览"** Tab (第一个 Tab)
2. 看到统计栏: 12 学生 | 12 已交 | 0 未交 | 0 逾期
3. 下方是 **学生卡片网格** (4列x3行, 12 张卡片)
4. 每张卡片显示:
   - 学生姓名 + ID (宋禧 s01)
   - 周报状态 (已交 / 未交)
   - 任务数 (2 任务)
   - 风险标签 (风险关键词)
   - AI 总结摘要 (1 句话)
5. 点击任意学生卡片 → 跳转到 "周报" Tab 并选中该学生
6. 点击 **"一键生成组会简报"** → 下载或显示 LabBrief.md

**预期**: 12 张卡片全部有内容 (不是空壳), 统计数与实际数据一致。

**API 验证**:
```powershell
$r = Invoke-WebRequest -Uri "http://localhost:3001/api/login" -Method POST -Body '{"role":"teacher","student_id":"t01","password":"lab123"}' -ContentType "application/json" -SessionVariable s
$d = Invoke-WebRequest -Uri "http://localhost:3001/api/dashboard" -WebSession $s
$d.Content | ConvertFrom-Json | Select-Object -ExpandProperty stats
```

---

### 10. 价值链 ValueCycle (Wave 5 新增)

> **核心变化**: 此前 AI 被封在各功能内部 (memory.js 的 getContextString 写了但从未被调用)。Wave 5 修复了这一病根 — generateSummary 和 buildChatMessages 现在注入共享上下文 (价值链 + 记忆 + 任务 + 会议 + 总结), AI 风险还会通过 writeBackFromSummary 回流到价值链和记忆层。

#### 10a. 学生端 — 首次登录价值链弹窗

**前置**: 用 s01 / changeme 登录 (研究生角色)。s01 已重置为未填, 会触发弹窗。

**步骤**:

1. 登录后, 页面中央弹出 **价值链填写弹窗** (首次登录触发, filled=false 时显示)
2. 弹窗包含:
   - **主目标** 下拉: 进电网 (state_grid) / 读博 (academia) / 企业 (enterprise) / 创业 (startup) / 毕业 (graduation)
   - **次目标** 多选: 论文 (paper) / 专利 (patent) / 技能 (skill) / 人脉 (network) / 产业 (industry)
   - **职业备注** 文本框
3. 选择主目标 + 勾选次目标 + 填备注
4. 点击 **"提交"**

**预期**:
- 弹窗关闭, 提示"已保存"
- 刷新页面后不再弹 (filled=true)
- s02~s12 同样未填, 可逐个登录体验

**跳过**: 点击 **"稍后再填"** → 弹窗关闭, filled 仍为 false, 下次登录再弹。

**文件验证**:
```powershell
Get-Content D:\OneDrive\7-SideWork\AutoProf\cordis-main\labos\valuecycles\s01.json | ConvertFrom-Json | Select-Object filled, personal_goals
```

#### 10b. 导师端 — 价值链 Tab

**前置**: 用 t01 / lab123 登录导师端

**步骤**:

1. 点击 **"价值链"** Tab (在"周报"之后)
2. 顶部显示 **课题组价值链**:
   - 6 个研究方向: 电力系统韧性 / 分布式算电协同 / V2G / 氢基综合能源系统韧性 / 移动储能 / AI datacenter
   - 5 类产出: paper / patent / platform / industry_solution / social_value
3. 下方是 **12 学生对齐网格** (4 列 × 3 行)
4. 每张卡片显示: 学生姓名 + 主目标标签 + 就绪度
5. 点击任意学生卡片 → 右侧 **详情面板**:
   - 学生价值链详情 (主目标 / 次目标 / 职业备注 / 研究阶段)
   - **导师评估区** (可编辑):
     - 价值分 滑块 (0-100)
     - 就绪度 下拉 (exploring / approaching / ready / deployed)
     - 评语文本框
6. 修改评估 → 点击 **"保存"**

**预期**: 保存后刷新, 评估值保持。未填学生显示"未填"标签。

**API 验证**:
```powershell
# 组级价值链
$r1 = Invoke-WebRequest -Uri "http://localhost:3001/api/valuecycle/group" -WebSession $s
$r1.Content | ConvertFrom-Json

# 全体对齐
$r2 = Invoke-WebRequest -Uri "http://localhost:3001/api/valuecycle/alignment/all" -WebSession $s
$r2.Content | ConvertFrom-Json | Select-Object student_name, filled, primary_goal, value_score

# 导师评估 (PUT)
$body = '{"value_score":80,"readiness":"ready","notes":"进展良好可投稿"}'
Invoke-WebRequest -Uri "http://localhost:3001/api/valuecycle/s01/assessment" -Method PUT -Body $body -ContentType "application/json" -WebSession $s
```

#### 10c. AI 上下文穿透验证

**验证 AI 是否真的读了价值链**:

1. 学生 s01 填完价值链后提交一份周报
2. 导师在该学生的 AI 聊天里问: "这个学生的职业目标和课题组方向对齐吗?"
3. **预期**: AI 回复应引用价值链数据 (如"该生目标是进电网, 课题组产出方向包含 paper"), 而不是泛泛而谈
4. 如 AI 回复与价值链无关 → 上下文注入未生效, 检查 lib/ai-context.js 的 buildStudentContext 是否被 summary.js / server.js chat 路由调用

**API 验证** (直接查看注入的上下文):
```powershell
cd D:\OneDrive\7-SideWork\AutoProf\cordis-main
node -e "import('./lib/ai-context.js').then(m => m.buildStudentContext('s01').then(c => console.log(c)))"
```
预期: 输出 700+ 字符的上下文文本, 包含 group VC + student VC + tasks + meetings + memory。

---

## 第二部分: 增量功能 (选验, 13 项)

### 11. RSS 每日新闻

**前置**: 导师端登录, 在看板 Tab 的欢迎页

**步骤**:
1. 看板 Tab 顶部欢迎区有 RSS 新闻条目
2. 显示最新 10 条 (arXiv cs.AI / eess.SP / IEEE Spectrum)
3. 每条有标题 + 来源 + 时间

**预期**: 有新闻条目显示。网络不通时为空 + 提示。

**API 验证**:
```powershell
$r = Invoke-WebRequest -Uri "http://localhost:3001/api/news" -WebSession $s
$r.Content | ConvertFrom-Json | Measure-Object
```

---

### 12. F20 面试模拟

**前置**: 导师端登录

**步骤**:
1. 点击 **"工具箱"** Tab
2. 找到 **"面试模拟"** 卡片
3. 点击进入
4. 选择场景 (论文答辩 / 项目答辩 / 面试)
5. 输入相关内容 (论文摘要 / 项目描述)
6. 点击 **"开始模拟"**
7. AI 以面试官身份提问, SSE 流式输出
8. 你回答后 AI 继续追问

**预期**: 7 个场景可选, AI 提问与场景相关。

**API 验证**:
```powershell
$r = Invoke-WebRequest -Uri "http://localhost:3001/api/interview/scenarios" -WebSession $s
$r.Content | ConvertFrom-Json
```

---

### 13. F11 考试座位安排

**前置**: 导师端登录

**步骤**:
1. 工具箱 → **"考试座位"**
2. 上传座位图 (或现场照片) + 学生名单
3. 点击 **"生成座位图"**
4. 系统生成学生座位分布
5. 可扫码查看

**API 验证**:
```powershell
$r = Invoke-WebRequest -Uri "http://localhost:3001/api/seating" -WebSession $s
$r.Content
```

---

### 14. F15 备课 + 演讲稿

**前置**: 导师端登录

**步骤**:
1. 工具箱 → **"备课"**
2. 输入课程主题 / 大纲
3. 点击 **"生成教案"**
4. AI 生成教案 (SSE 流式)
5. 可选: 点击 **"生成演讲稿"** → 生成逐字演讲稿

**API 验证**:
```powershell
$r = Invoke-WebRequest -Uri "http://localhost:3001/api/lessons" -WebSession $s
$r.Content
```

---

### 15. F13 工作量计算

**前置**: 导师端登录

**步骤**:
1. 工具箱 → **"工作量"**
2. 输入学年 (如 2026)
3. 系统按系数计算: 教学 + 科研 + 指导 + 服务
4. 系数可编辑 (导师可调整)
5. 生成工作量报告

**API 验证**:
```powershell
$r = Invoke-WebRequest -Uri "http://localhost:3001/api/workload/2026" -WebSession $s
$r.Content
```

---

### 16. F14 发票管理

**前置**: 导师端登录

**步骤**:
1. 工具箱 → **"发票"**
2. 手动录入或粘贴发票信息
3. 系统自动解析: 金额 / 日期 / 类别
4. 统计面板: 按类别 / 按月份汇总
5. 可编辑 / 删除

**API 验证**:
```powershell
$r = Invoke-WebRequest -Uri "http://localhost:3001/api/invoices" -WebSession $s
$r.Content
```

---

### 17. F17 CLI 桥接

**前置**: PowerShell 终端

**步骤**:

```powershell
cd D:\OneDrive\7-SideWork\AutoProf\cordis-main

# 登录 (首次)
node labos.mjs login s01 changeme

# 查看任务
node labos.mjs tasks

# 提交周报
node labos.mjs report submit labos\reports\s01\2026-W33.md

# 生成简报
node labos.mjs brief

# 查看新闻
node labos.mjs news
```

**预期**: 每条命令返回 JSON 或格式化输出, 不报错。

---

### 18. F4 聊天室

**前置**: 导师端登录

**步骤**:
1. 导师端找到 **"聊天室"** 入口
2. 创建新聊天室 (命名, 如 "V2G 项目组")
3. 邀请学生加入
4. 发送消息
5. 可随时 @AI 拉 AI 进群
6. AI 回复以激发灵感为主

**API 验证**:
```powershell
$r = Invoke-WebRequest -Uri "http://localhost:3001/api/rooms" -Method POST -Body '{"name":"test-room"}' -ContentType "application/json" -WebSession $s
$r.Content
```

---

### 19. F6 Skills 工具箱

**前置**: 导师端登录

**步骤**:
1. 点击 **"工具箱"** Tab
2. 看到 11+ 个 skill 卡片:
   - pre-submission-reviewer (审稿)
   - paper-polish (润色)
   - idea-evaluator (选题评估)
   - nature-writing (Nature 写作)
   - intro-drafter (引言起草)
   - figure-designer (图表设计)
   - 等
3. 点击任意 skill → 进入工具页
4. 左侧输入框 (粘贴论文内容)
5. 右侧 SSE 流式输出
6. **审稿模式** (F19): 粘贴 abstract → AI 以 IEEE 审稿人身份审查

**预期**: SSE 流式输出, marked.js 渲染 Markdown。

**上下文入口** (F6 横切):
- 学生提交周报后 → 出现 "用 paper-polish 润色?" 建议
- 导师看到风险标签 → 出现 "用 pre-submission-reviewer 检查" 按钮

**API 验证**:
```powershell
$r = Invoke-WebRequest -Uri "http://localhost:3001/api/skills" -WebSession $s
$r.Content | ConvertFrom-Json
```

---

### 20. F5 周报 AI 草稿

**前置**: 用 s01 登录学生端

**步骤**:
1. 周报 Tab, 编辑器上方有 **"AI 辅助填写"** 按钮
2. 点击 → 系统读取 Codex 历史 (~/.codex/memories/rollout_summaries/)
3. 5-15 秒后, 草稿填入编辑器
4. 草稿基于实际 Codex 工作内容 (不是空壳)
5. 学生可编辑后提交

**预期**: 草稿有实质内容。如无 Codex 历史, 提示 "未找到工作记录"。

**API 验证**:
```powershell
$r = Invoke-WebRequest -Uri "http://localhost:3001/api/progress/s01/draft" -WebSession $s
$r.Content
```

---

### 21. F18 邮箱 → 看板

**前置**: .env 配置 IMAP_HOST / IMAP_USER / IMAP_PASS

**步骤**:
1. 导师端 → 工具箱 → **"邮箱同步"**
2. 点击 **"同步邮箱"**
3. 系统拉取未读邮件 → AI 抽取待办 → 创建看板任务 (source="email")
4. 看板出现新任务, 来源标签 "email"

**降级**: 无 IMAP 配置 → 提示 "未配置邮箱"。

**API 验证**:
```powershell
$r = Invoke-WebRequest -Uri "http://localhost:3001/api/email/unread" -WebSession $s
$r.Content
```

---

### 22. F2 实时 STT (会议实时转写)

**前置**: 导师端登录, 浏览器需支持 getUserMedia (Chrome/Edge)

**步骤**:
1. 导师端找到 **"实时会议"** 入口 (或访问 http://localhost:3001/meeting-live)
2. 点击 **"开始会议"**
3. 浏览器请求麦克风权限 → 允许
4. 开始说话 → 页面实时显示转写文字
5. 点击 **"结束会议"** → 累积文本保存
6. 点击 **"AI 总结+抽取行动"** → 复用文本管线 → 行动项自动 promote 到看板

**手动输入兜底**:
- 如果语音识别未产生文本（浏览器不支持/未授权麦克风），页面下方有手动输入文本框
- 直接粘贴会议纪要文本 → 点击 **"AI 总结+抽取行动"** → 同样抽取行动项

**降级**:
- FunASR/SenseVoice 不可用 → 切换到 webkitSpeechRecognition (Chrome Web Speech API)
- 无 GPU → CPU 推理 (慢但可用)

**状态检查**:
```powershell
$r = Invoke-WebRequest -Uri "http://localhost:3001/api/stt/status" -WebSession $s
$r.Content
```

---

### 23. F7 记忆系统

**前置**: 导师端登录

**步骤**:
1. 导师端 → 选择学生
2. 系统展示该学生的 "记忆" — 历史周报摘要 + 风险标签 + 任务记录
3. 用于导师快速回顾学生长期进展

**API 验证**:
```powershell
$r = Invoke-WebRequest -Uri "http://localhost:3001/api/memory/s01" -WebSession $s
$r.Content
```

---

## 第三部分: 降级 + 回归测试

### 24. 无 API Key 降级

**步骤**:

1. 停止服务器 (Ctrl+C)
2. 重命名 .env:
```powershell
Rename-Item D:\OneDrive\7-SideWork\AutoProf\cordis-main\.env .env.bak
```
3. 重启服务器:
```powershell
node server.js
```
4. 登录 → 提交周报 → 提交成功 (不崩)
5. AI 总结显示 "未配置 API Key"
6. 导师聊天返回 "未配置 API Key, 无法对话"
7. 会议上传 → 纪要保存, actions 为空
8. 看板 / 仪表盘 / 价值链 / 周报渲染 → 全部正常 (不依赖 AI)
9. 恢复:
```powershell
Rename-Item D:\OneDrive\7-SideWork\AutoProf\cordis-main\.env.bak .env
```
10. 重启服务器

**预期**: 无 API Key 时, AI 功能降级但不崩溃, 非 AI 功能完全正常。

---

### 25. CLI 回归验证

**步骤**:
```powershell
cd D:\OneDrive\7-SideWork\AutoProf\cordis-main

# CLI 登录
node labos.mjs login t01 lab123

# 查看简报
node labos.mjs brief

# 查看任务
node labos.mjs tasks

# 查看新闻
node labos.mjs news
```

**预期**: 每条命令正常返回, 不报连接错误。

---

### 26. 原始 CLI 回归

**步骤**:
```powershell
cd D:\OneDrive\7-SideWork\AutoProf\cordis-main
node cli.js generate
```

**预期**: 生成 labos/out/LabBrief.md, 不受新功能影响。

---

## 验证结果记录

验证完毕后, 在此处记录结果:

| # | 功能 | 结果 | 备注 |
|---|---|---|---|
| 1 | 登录 | [ ] PASS [ ] FAIL | |
| 2 | 周报提交 | [ ] PASS [ ] FAIL | |
| 3 | AI 总结 | [ ] PASS [ ] FAIL | |
| 4 | 导师聊天 | [ ] PASS [ ] FAIL | |
| 5 | 会议抽取 | [ ] PASS [ ] FAIL | |
| 6 | 会议转看板 | [ ] PASS [ ] FAIL | |
| 7 | 看板(导师) | [ ] PASS [ ] FAIL | |
| 8 | 看板(学生) | [ ] PASS [ ] FAIL | |
| 9 | 仪表盘 | [ ] PASS [ ] FAIL | |
| 10 | 价值链 | [ ] PASS [ ] FAIL | |
| 11 | RSS | [ ] PASS [ ] FAIL | |
| 12 | 面试 | [ ] PASS [ ] FAIL | |
| 13 | 座位 | [ ] PASS [ ] FAIL | |
| 14 | 备课 | [ ] PASS [ ] FAIL | |
| 15 | 工作量 | [ ] PASS [ ] FAIL | |
| 16 | 发票 | [ ] PASS [ ] FAIL | |
| 17 | CLI | [ ] PASS [ ] FAIL | |
| 18 | 聊天室 | [ ] PASS [ ] FAIL | |
| 19 | Skills | [ ] PASS [ ] FAIL | |
| 20 | 周报草稿 | [ ] PASS [ ] FAIL | |
| 21 | 邮箱 | [ ] PASS [ ] FAIL | |
| 22 | STT | [ ] PASS [ ] FAIL | |
| 23 | 记忆 | [ ] PASS [ ] FAIL | |
| 24 | 降级 | [ ] PASS [ ] FAIL | |
| 25 | CLI回归 | [ ] PASS [ ] FAIL | |
| 26 | 原始CLI | [ ] PASS [ ] FAIL | |

---

*指南更新时间: 2026-08-19 | LabOS v0.5.2*
*GitHub: https://github.com/njtdf/AutoProf-LabOS*
*验证脚本: scripts/validate-core-loop.mjs*
*盐雾测试结果: ALL PASS*
*诊断报告: labos/validation-report-2026-08-18.md*
*Wave 5 价值链层: AI through-line 共享上下文 (v0.5.0)*

---

## 排障指南

### 页面显示混乱(价值链出现在每个页面 / 面试内容出现在周报 / 聊天空白)

**根因**: 浏览器缓存了旧版 JS/CSS,Vue 3 无法挂载 → 所有 -if 内容同时显示。

**解决方案 (已自动修复)**:
1. LabOS v0.5.2 内置版本自动检测: pi.js 加载时调 GET /api/version,与服务端版本对比。不匹配时自动 window.location.reload()。
2. 所有 HTML 的 <script> 和 <link> 标签带 ?v=052 cache-bust query string。
3. 服务端 Cache-Control: no-cache, must-revalidate。

**如果仍显示旧版**:
- 按 Ctrl + Shift + R(Windows)或 Cmd + Shift + R(Mac)强制刷新
- 或打开 DevTools → Network → 勾选 "Disable cache" → 刷新
- 或清除浏览器缓存后重新访问

### 实时会议 STT 不可用

**现象**: "开始会议" 后无转写文本。

**原因**: FunASR 未安装,使用浏览器 Web Speech API 降级。仅 Chrome/Edge 支持。

**解决方案**:
- 使用 Chrome 或 Edge 浏览器
- 允许麦克风权限
- **手动输入兜底**: 页面下方"手动输入会议纪要"文本框始终可用。直接输入或粘贴会议纪要,点击"AI 总结+抽取行动"按钮即可。

---

## 知识库验证 (Wave 8, 0.7.6)

### 导师端

**前置**: t01 / lab123 登录

**步骤**:
1. 左侧导航栏「核心」段,点击「📖 知识库」
2. 页面显示统计面板(总文档 29 / 关键词 5622 / 按类别:meeting 4, report 13, summary 12)
3. 搜索框输入 `Benders` → 回车
4. 搜索结果显示匹配文档(会议纪要 2026-08-18,含snippet)
5. 点击「查看全部文档」→ 显示分页文档表格(ID/标题/路径/类别/学生)
6. 点击「🔄 重建索引」→ 提示重建完成
7. 点击搜索结果 → 弹出文件查看器,显示文件内容

**预期**: 页面非空白,搜索有结果,统计数字正确

### 学生端

**前置**: s01 / changeme 登录

**步骤**:
1. 左侧导航栏「核心」段,点击「📚 知识库」
2. 页面显示TF-IDF搜索栏 + 统计面板 + 文件浏览器
3. 搜索框输入 `V2G` → 回车
4. 搜索结果显示5条匹配结果
5. 文件浏览器仍可正常浏览文件

**预期**: 学生能搜索和浏览知识库,统计正确

### 降级验证

1. 如果DeepSeek API Key缺失:知识库搜索仍然工作(TF-IDF是纯算法,不需要AI)
2. 如果数据库未初始化:搜索返回空结果,不报错
