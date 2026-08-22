const { createApp, ref, computed, onMounted, watch } = Vue

createApp({
  setup() {
    const user = ref(null)
    const markdown = ref('')
    const previewHtml = ref('')
    const submitting = ref(false)
    const summary = ref(null)
    const summaryLoading = ref(false)
    const showPolishSuggestion = ref(false)
    const draftLoading = ref(false)
    let pollTimer = null
    // --- 周报上下文 (飞轮回流) ---
    const reportContext = ref(null)
    const showFeedback = ref(false)
    // --- 会议行动(只读) ---
    const myActions = ref([])
    const showActions = ref(false)
    const actionsLoading = ref(false)
  // --- 周报历史 ---
  const reportHistory = ref([])
  const showHistory = ref(false)
  const historyViewReport = ref(null) // {raw, meta} or null
    // --- 看板 ---
    const activeTab = ref('report')
    const tasks = ref([])
    const kanbanCols = [
      { status: 'todo', label: '待办' },
      { status: 'in_progress', label: '进行中' },
      { status: 'done', label: '已完成' },
      { status: 'blocked', label: '阻塞' },
    ]

    const brandName = computed(() => {
      if (!user.value) return 'EvoTeam'
      const map = { grad: 'AutoGrad', undergrad: 'AutoUngrad', teacher: 'AutoProf' }
      return map[user.value.role] || 'EvoTeam'
    })

    const roleLabel = computed(() => {
      if (!user.value) return ''
      const map = { grad: 'Grad Student', undergrad: 'Undergrad', teacher: 'Teacher' }
      return map[user.value.role] || user.value.role
    })

    function updatePreview() {
      try { previewHtml.value = marked.parse(markdown.value) }
      catch { previewHtml.value = '<p style="color:#999">Preview error</p>' }
    }

    // Format message content as HTML (Markdown → HTML via marked)
    function formatMessage(content) {
      if (!content) return ''
      try { return marked.parse(content) } catch { return content }
    }

    function formatHistoryReport() {
      if (!historyViewReport.value || !historyViewReport.value.raw) return ''
      try { return marked.parse(historyViewReport.value.raw) } catch { return historyViewReport.value.raw }
    }

    function generateTemplate() {
      const now = new Date()
      const start = new Date(now.getTime() - 14 * 86400000)
      const fmt = d => d.toISOString().slice(0, 10)
      const u = user.value
      return `---
title: "双周报"
student_id: "${u?.id || ''}"
name: "${u?.name || ''}"
project: "${u?.project || ''}"
period_start: "${fmt(start)}"
period_end: "${fmt(now)}"
submitted_at: "${now.toISOString()}"
status: "on_track"
---

## 1. 本周进展

1)
2)
3)

## 2. 问题与困难

1)

## 3. 本周活动

1)
2)
3)

## 4. 下两周计划

1)
2)
3)

## 5. 服务工作

1)

## 6. 附件

- (无)
`
    }

    function loadTemplate() { markdown.value = generateTemplate(); updatePreview() }
    function clearEditor() { markdown.value = ''; previewHtml.value = '' }

    async function doSubmit() {
      if (!markdown.value.trim()) { showToast('周报内容不能为空'); return }
      submitting.value = true
      try {
        const data = await api('/api/submit', { method: 'POST', body: JSON.stringify({ content: markdown.value }) })
        if (data.ok) {
          const flywheelMsg = data.flywheel ? ' | 已索引知识库+记录轨迹' : ''
          showToast('提交成功！AI 正在生成总结...' + flywheelMsg)
          startPollingSummary(user.value.id)
          loadReportContext(user.value.id)
        }
      } catch (e) { showToast('Submit failed: ' + e.message) }
      finally { submitting.value = false }
    }

    async function generateDraft() {
      draftLoading.value = true
      try {
        const data = await api(`/api/progress/${user.value.id}/draft`)
        if (data.draft) {
          markdown.value = data.draft
          updatePreview()
          if (data.source === 'no_history') showToast('未找到 Codex 历史，使用模板。')
          else if (data.source === 'no_api_key') showToast('未配置 API key，使用模板。')
          else showToast(`AI 草稿已生成（基于 ${data.excerpts_found} 条 Codex 历史）`)
        }
      } catch (e) { showToast('Draft generation failed: ' + e.message) }
      finally { draftLoading.value = false }
    }

    function startPollingSummary(studentId) {
      summaryLoading.value = true
      let attempts = 0
      const poll = async () => {
        attempts++
        try {
          const data = await api(`/api/summary/${studentId}`)
         if (data.summary && !data.summary.summary?.includes('(AI')) {
            summary.value = data.summary
            summaryLoading.value = false
            showPolishSuggestion.value = true
            return
         }
          if (attempts < 30) { pollTimer = setTimeout(poll, 2000) }
          else { summaryLoading.value = false; showToast('AI 总结生成超时，请稍后查看。') }
        } catch {
          if (attempts < 30) { pollTimer = setTimeout(poll, 2000) }
          else { summaryLoading.value = false }
        }
      }
      poll()
    }

    // ===== 会议行动(只读) =====
    async function loadMyActions() {
      actionsLoading.value = true
      try { const data = await api('/api/my-actions'); myActions.value = data.actions || [] }
      catch (e) { showToast('加载会议行动失败: ' + e.message) }
      finally { actionsLoading.value = false }
    }

    async function toggleActions() {
      if (showActions.value) { showActions.value = false; return }
      await loadMyActions(); showActions.value = true
    }

    // ===== 周报上下文 (飞轮回流) =====
    async function loadReportContext(sid) {
      const studentId = sid || user.value?.id
      if (!studentId) return
      try {
        const data = await api(`/api/report-context/${studentId}`)
        reportContext.value = data
      } catch (e) { console.error('report-context load failed:', e.message) }
    }

    function toggleFeedback() {
      if (showFeedback.value) { showFeedback.value = false; return }
      loadReportContext()
      showFeedback.value = true
    }

    // ===== 看板 =====
    async function switchToKanban() {
      activeTab.value = 'kanban'
      await loadMyTasks()
    }

    async function loadMyTasks() {
      try { const data = await api('/api/tasks'); tasks.value = data.tasks || [] }
      catch (e) { showToast('加载任务失败: ' + e.message) }
    }

    function myTasksByStatus(status) { return tasks.value.filter(t => t.status === status) }

    function isOverdue(t) {
      return t.deadline && t.deadline < new Date().toISOString().slice(0, 10) && t.status !== 'done'
    }

    const myTaskStats = computed(() => {
      const total = tasks.value.length
      const inProgress = tasks.value.filter(t => t.status === 'in_progress').length
      const done = tasks.value.filter(t => t.status === 'done').length
      const overdue = tasks.value.filter(t => isOverdue(t)).length
      const todo = tasks.value.filter(t => t.status === 'todo').length
      const blocked = tasks.value.filter(t => t.status === 'blocked').length
      const pct = total > 0 ? Math.round(done / total * 100) : 0
      return { total, inProgress, done, overdue, todo, blocked, pct }
    })

    async function updateTaskStatus(t, newStatus) {
      try {
        await api(`/api/tasks/${t.task_id}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) })
        t.status = newStatus
        showToast('状态已更新')
      } catch (e) { showToast('更新失败: ' + e.message) }
    }

    // ===== 日历 (复用 teacher 端逻辑) =====
    const calendarMonth = ref(new Date().toISOString().slice(0, 7))
    const calendarWeekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    const calendarEvents = ref([])

    const calendarLabel = computed(() => {
      const [y, m] = calendarMonth.value.split('-')
      return y + '年' + parseInt(m) + '月'
    })

    const calendarDays = computed(() => {
      const [y, m] = calendarMonth.value.split('-').map(Number)
      const firstDay = new Date(y, m - 1, 1)
      const lastDay = new Date(y, m, 0)
      let startWeekday = firstDay.getDay() - 1
      if (startWeekday < 0) startWeekday = 6
      const days = []
      const prevLast = new Date(y, m - 1, 0).getDate()
      for (let i = startWeekday - 1; i >= 0; i--) {
        days.push({ num: prevLast - i, inMonth: false, isToday: false, events: [] })
      }
      const today = new Date()
      const todayStr = today.toISOString().slice(0, 10)
      for (let d = 1; d <= lastDay.getDate(); d++) {
        const dateStr = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0')
        const evs = calendarEvents.value.filter(e => e.date === dateStr)
        days.push({ num: d, inMonth: true, isToday: dateStr === todayStr, events: evs })
      }
      const remaining = 42 - days.length
      for (let d = 1; d <= remaining; d++) {
        days.push({ num: d, inMonth: false, isToday: false, events: [] })
      }
      return days
    })

    async function switchToCalendar() {
      activeTab.value = 'calendar'
      try {
        const r = await fetch('/api/calendar/events')
        if (r.ok) calendarEvents.value = await r.json()
      } catch (e) { console.error('loadCalendar:', e.message) }
    }

    function prevMonth() {
      const [y, m] = calendarMonth.value.split('-').map(Number)
      const d = new Date(y, m - 2, 1)
      calendarMonth.value = d.toISOString().slice(0, 7)
    }

    function nextMonth() {
      const [y, m] = calendarMonth.value.split('-').map(Number)
      const d = new Date(y, m, 1)
      calendarMonth.value = d.toISOString().slice(0, 7)
    }

    // ===== AI 助手 (学生与 AI 聊天, SSE) =====
    const assistantMessages = ref([])
    const assistantInput = ref('')
    const assistantStreaming = ref(false)
    const mySummary = ref(null)
    const myReportHtml = ref('')

    async function switchToAssistant() {
      activeTab.value = 'assistant'
      await loadAssistantHistory()
    }

    async function loadAssistantHistory() {
      try {
        const r = await fetch('/api/chat/' + user.value.id)
        if (r.ok) {
          const data = await r.json()
          assistantMessages.value = data.messages || []
        }
      } catch (e) { console.error('loadAssistantHistory:', e.message) }
      try {
        const r2 = await fetch('/api/summary/' + user.value.id)
        if (r2.ok) {
          const d2 = await r2.json()
          mySummary.value = d2.summary || null
        }
      } catch (e) { console.error('loadSummary:', e.message) }
      try {
        const r3 = await fetch('/api/report/' + user.value.id)
        if (r3.ok) {
          const d3 = await r3.json()
          if (d3.content) {
            try { myReportHtml.value = marked.parse(d3.content) }
            catch { myReportHtml.value = d3.content }
          }
        }
      } catch (e) { console.error('loadReport:', e.message) }
    }

    async function sendAssistantMessage() {
      const msg = assistantInput.value.trim()
      if (!msg || assistantStreaming.value) return
      assistantMessages.value.push({ role: 'user', content: msg })
      assistantInput.value = ''
      assistantStreaming.value = true
      try {
        await streamChat('/api/chat/' + user.value.id, { message: msg },
          (chunk) => {
            const last = assistantMessages.value[assistantMessages.value.length - 1]
            if (last && last.role === 'assistant' && last._streaming) {
              last.content += chunk
            } else {
              assistantMessages.value.push({ role: 'assistant', content: chunk, _streaming: true })
            }
          },
          () => {
            const last = assistantMessages.value[assistantMessages.value.length - 1]
            if (last) delete last._streaming
            assistantStreaming.value = false
          },
          (err) => {
            showToast('AI 错误: ' + err)
            assistantStreaming.value = false
          }
        )
      } catch (e) {
        showToast('发送失败: ' + e.message)
        assistantStreaming.value = false
      }
    }

    // ===== 知识库 (文件管理) =====
    const kbFiles = ref([])
    const kbSearch = ref('')
    const kbLoading = ref(false)
    const kbViewingFile = ref(null)
    const kbViewingFileName = ref('')
    const kbFileContent = ref('')
    // TF-IDF search refs
    const kbSemQuery = ref('')
    const kbSemResults = ref([])
    const kbSemLoading = ref(false)
    const kbSemStats = ref(null)

    const kbFilteredFiles = computed(() => {
      if (!kbSearch.value) return kbFiles.value
      const q = kbSearch.value.toLowerCase()
      return kbFiles.value.filter(f =>
        f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
      )
    })

    async function switchToKb() {
      activeTab.value = 'kb'
      await loadKb()
      await loadKbStats()
    }

    async function loadKb() {
      kbLoading.value = true
      try {
        const r = await api('/api/kb/list')
        kbFiles.value = r.files || []
      } catch (e) { showToast('加载知识库失败: ' + e.message) }
      finally { kbLoading.value = false }
    }

    async function viewKbFile(path) {
      kbViewingFile.value = true
      kbViewingFileName.value = path.split('/').pop()
      kbFileContent.value = '加载中...'
      try {
        const r = await fetch('/api/kb/file?path=' + encodeURIComponent(path))
        const d = await r.json()
        kbFileContent.value = d.content || d.error || '无内容'
      } catch (e) { kbFileContent.value = '加载失败: ' + e.message }
    }

    // TF-IDF semantic search
    async function semSearchKb() {
      const q = kbSemQuery.value.trim()
      if (!q) { kbSemResults.value = []; return }
      kbSemLoading.value = true
      try {
        const r = await api('/api/kb/search?q=' + encodeURIComponent(q) + '&limit=20')
        kbSemResults.value = r.results || []
      } catch(e) { showToast('搜索失败: ' + e.message) }
      kbSemLoading.value = false
    }

    async function loadKbStats() {
      try {
        const r = await api('/api/kb/stats')
        kbSemStats.value = r
      } catch(e) { console.error('KB stats:', e) }
    }


    // ===== 周报历史 =====
    async function loadReportHistory() {
      try {
        const data = await api(`/api/reports/${user.value.id}`)
        reportHistory.value = data.reports || []
      } catch (e) { console.error('report history load failed:', e.message) }
    }

    function toggleHistory() {
      if (showHistory.value) { showHistory.value = false; return }
      loadReportHistory(); showHistory.value = true
    }

    async function viewHistoryReport(filename) {
      try {
        const data = await api(`/api/report/${user.value.id}?file=${encodeURIComponent(filename)}`)
        historyViewReport.value = data.report
      } catch (e) { showToast('加载历史周报失败: ' + e.message) }
    }

    function closeHistoryView() { historyViewReport.value = null }

    function startNewReport() {
      historyViewReport.value = null
      showHistory.value = false
      loadTemplate()
    }
   onMounted(async () => {
     const u = await getMe()
     if (!u) { window.location.href = '/login'; return }
     if (u.role === 'teacher') { window.location.href = '/teacher'; return }
    user.value = u
    loadTemplate()
    loadMyActions()
    loadReportContext(u.id)
    loadMyVc()
    loadReportHistory()
  })

    // Sync URL hash when tab changes (so refresh/bookmark keeps current tab)
    watch(activeTab, (newTab) => {
      if (window.location.hash !== '#' + newTab) {
        history.replaceState(null, '', '#' + newTab)
      }
    })

    // Restore tab from URL hash on initial load
    const hash = window.location.hash.slice(1)
    const validTabs = ['report', 'daily', 'kanban', 'calendar', 'assistant', 'ideas', 'kb', 'skills', 'interview']
    if (hash && validTabs.includes(hash)) {
      activeTab.value = hash
      if (hash === 'kanban') switchToKanban()
      else if (hash === 'calendar') switchToCalendar()
      else if (hash === 'assistant') switchToAssistant()
      else if (hash === 'kb') switchToKb()
      else if (hash === 'skills') switchToSkills()
      else if (hash === 'interview') switchToInterview()
      else if (hash === 'daily') switchToDailyBrief()
      else if (hash === 'ideas') switchToIdeas()
    }

    // --- 价值链首次填写 (Wave 5) ---
    const myVc = ref(null)
    const showVcModal = ref(false)
    const vcForm = ref({ primary: '', secondary: [], career_note: '' })
    const vcGoals = [
      { value: 'graduation', label: '顺利毕业' },
      { value: 'state_grid', label: '国网/电力企业' },
      { value: 'academia', label: '学术深造/读博' },
      { value: 'enterprise', label: '互联网/科技企业' },
      { value: 'startup', label: '创业' },
    ]
    const vcSecondaryOpts = [
      { value: 'paper', label: '发论文' },
      { value: 'patent', label: '申请专利' },
      { value: 'skill', label: '提升编程/工程能力' },
      { value: 'network', label: '扩展人脉' },
      { value: 'industry', label: '工业落地经验' },
    ]

    async function loadMyVc() {
      try {
        const r = await fetch(`/api/valuecycle/${user.value.id}`)
        if (r.ok) {
          myVc.value = await r.json()
          if (!myVc.value.filled) {
            showVcModal.value = true
          }
        }
      } catch (e) { console.error('loadMyVc:', e.message) }
    }

    async function submitVcForm() {
      const id = user.value.id
      const r = await fetch(`/api/valuecycle/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personal_goals: vcForm.value,
          filled: true,
        }),
      })
      if (r.ok) {
        const data = await r.json()
        myVc.value = data.valuecycle
        showVcModal.value = false
      }
    }

    // ===== AI 工具箱 (Feature 6/16) =====
     const skillManifest = ref([])
     const selectedSkill = ref(null)
     const skillInput = ref('')
     const skillOutput = ref('')
     const skillStreaming = ref(false)
     const skillPlaceholder = computed(() => {
       if (!selectedSkill.value) return ''
       const map = {
         'idea-evaluator': '粘贴你的研究想法(1-3 段),AI 会从五个维度评估并给出 verdict',
         'pre-submission-reviewer': '粘贴论文全文或关键章节,AI 会做投稿前审查(5 维度)',
         'paper-writer': '提供你的原始数据/结果/发现,AI 辅助起草论文段落',
         'intro-drafter': '提供论文的核心贡献和背景,AI 辅助起草 Introduction',
         'paper-polish': '粘贴需要润色的段落,AI 在保持原意的前提下改进英文',
         'deep-research': '输入研究问题,AI 做 survey 级文献调查',
         'figure-designer': '描述你的数据和想要展示的内容,AI 建议图表设计方案',
       }
       return map[selectedSkill.value.name] || '输入内容,点击运行 AI'
     })
     const skillOutputHtml = computed(() => {
       try { return marked.parse(skillOutput.value || '') } catch { return skillOutput.value || '' }
     })
     async function switchToSkills() {
       activeTab.value = 'skills'
       if (skillManifest.value.length === 0) {
         try {
           const data = await api('/api/skills')
           skillManifest.value = data.skills || []
         } catch (e) { showToast('加载工具列表失败: ' + e.message) }
       }
     }
     function selectSkill(s) {
       selectedSkill.value = s
       skillInput.value = ''
       skillOutput.value = ''
     }
     async function runSkillAI() {
       if (!skillInput.value.trim() || !selectedSkill.value) { showToast('请输入内容'); return }
       skillStreaming.value = true
       skillOutput.value = ''
       try {
         await streamChat(`/api/skills/${selectedSkill.value.name}`, { input: skillInput.value },
           (chunk) => { skillOutput.value += chunk },
           () => {},
           (err) => { showToast('AI 错误: ' + err) }
         )
       } catch (e) { showToast('运行失败: ' + e.message) }
     finally { skillStreaming.value = false }
    }

    async function goToSkill(name) {
      activeTab.value = 'skills'
      if (skillManifest.value.length === 0) {
        try { const data = await api('/api/skills'); skillManifest.value = data.skills || [] }
        catch (e) { return }
      }
      const found = skillManifest.value.find(s => s.name === name)
     if (found) selectSkill(found)
   }

    // 面试/答辩练习 (Feature 20)
    const interviewScenario = ref('')
    const interviewTopic = ref('')
    const interviewContext = ref('')
    const interviewHistory = ref([])
    const interviewAnswer = ref('')
    const interviewStreaming = ref(false)
    const interviewStreamText = ref('')

    function switchToInterview() { activeTab.value = 'interview' }

    async function startInterview() {
      if (!interviewScenario.value) return
      interviewHistory.value = []
      interviewStreamText.value = ''
      interviewStreaming.value = true
      await streamChat('/api/interview', {
        action: 'start', scenario: interviewScenario.value,
        topic: interviewTopic.value, context: interviewContext.value,
      }, (chunk) => { interviewStreamText.value += chunk },
      () => {
        if (interviewStreamText.value) interviewHistory.value.push({ role: 'assistant', content: interviewStreamText.value })
        interviewStreamText.value = ''
        interviewStreaming.value = false
      }, (err) => {
        showToast('AI 错误: ' + err)
        if (interviewStreamText.value) interviewHistory.value.push({ role: 'assistant', content: interviewStreamText.value })
        interviewStreamText.value = ''
        interviewStreaming.value = false
      })
    }

    async function sendInterviewAnswer() {
      if (!interviewAnswer.value.trim() || interviewStreaming.value) return
      const answer = interviewAnswer.value
      interviewHistory.value.push({ role: 'user', content: answer })
      interviewAnswer.value = ''
      interviewStreamText.value = ''
      interviewStreaming.value = true
      const hist = interviewHistory.value.slice(0, -1).map(m => ({ role: m.role, content: m.content }))
      await streamChat('/api/interview', {
        action: 'continue', scenario: interviewScenario.value,
        topic: interviewTopic.value, context: interviewContext.value,
        history: hist, answer,
      }, (chunk) => { interviewStreamText.value += chunk },
      () => {
        if (interviewStreamText.value) interviewHistory.value.push({ role: 'assistant', content: interviewStreamText.value })
        interviewStreamText.value = ''
        interviewStreaming.value = false
      }, (err) => {
        showToast('AI 错误: ' + err)
        if (interviewStreamText.value) interviewHistory.value.push({ role: 'assistant', content: interviewStreamText.value })
        interviewStreamText.value = ''
        interviewStreaming.value = false
      })
    }

    async function sendInterviewCoach() {
      if (interviewStreaming.value) return
      interviewHistory.value.push({ role: 'user', content: '[请求推荐回答策略]' })
      interviewStreamText.value = ''
      interviewStreaming.value = true
      const hist = interviewHistory.value.slice(0, -1).map(m => ({ role: m.role, content: m.content }))
      await streamChat('/api/interview', {
        action: 'continue', scenario: interviewScenario.value,
        topic: interviewTopic.value, context: interviewContext.value,
        history: hist, answer: '', coachMode: true,
      }, (chunk) => { interviewStreamText.value += chunk },
      () => {
        if (interviewStreamText.value) interviewHistory.value.push({ role: 'assistant', content: interviewStreamText.value })
        interviewStreamText.value = ''
        interviewStreaming.value = false
      }, (err) => {
        showToast('AI 错误: ' + err)
        if (interviewStreamText.value) interviewHistory.value.push({ role: 'assistant', content: interviewStreamText.value })
        interviewStreamText.value = ''
        interviewStreaming.value = false
      })
    }
    // ===== 毕业状态 (只读) =====
    const gradSummary = ref(null)

    async function switchToGraduation() {
      activeTab.value = 'graduation'
      window.location.hash = 'graduation'
      if (!user.value?.id) return
      try {
        gradSummary.value = await api('/api/graduation/' + user.value.id)
      } catch (e) { showToast('加载毕业状态失败: ' + e.message) }
    }



    // ===== 我的档案 =====
    const myProfile = ref(null)
    const profileLoading = ref(false)
    const capabilityLabels = {
      modeling: '建模', experiment: '实验', writing: '写作', coding: '编程',
      presentation: '表达', literature: '文献', independence: '独立性'
    }

    async function switchToProfile() {
      activeTab.value = 'profile'
      await loadMyProfile()
    }

    async function loadMyProfile() {
      if (!user.value) return
      profileLoading.value = true
      try {
        const res = await api('/api/student-profile/' + user.value.student_id)
        myProfile.value = res
      } catch(e) {
        console.error('Profile load error:', e)
      }


    async function loadNews() {
      try {
        const data = await api('/api/news')
        news.value = data.news || []
      } catch(e) { news.value = [] }
    }      profileLoading.value = false
    }


    // ===== Course =====
    const courseData = ref(null)
    const courseLoading = ref(false)
    const courseSubTab = ref('schedule')

    async function switchToCourse() {
      activeTab.value = 'course'
      await loadCourse()
    }

    async function loadCourse() {
      courseLoading.value = true
      try {
        courseData.value = await api('/api/course/电力系统基础')
      } catch(e) {
        console.error('Course load error:', e)
      }
      courseLoading.value = false
    }


    
    // ===== Daily Brief + Ideas (Wave 7) =====
    const dailyBrief = ref(null)
    const news = ref([])
    const ideaList = ref([])
    const ideaInput = ref('')
    const ideaStreaming = ref(false)
    const ideaStreamText = ref('')
    const sharedIdeas = ref([])
    const ideaShareTitle = ref('')
    const ideaShareContent = ref('')

    async function switchToDailyBrief() {
      activeTab.value = 'daily'
      try { dailyBrief.value = await api('/api/daily-brief') }
      catch(e) { console.error('dailyBrief:', e) }
    }

    async function switchToIdeas() {
      activeTab.value = 'ideas'
      try {
        const r = await api('/api/ideas'); ideaList.value = r.ideas || []
        const sr = await api('/api/ideas?shared=true'); sharedIdeas.value = sr.ideas || []
    await loadNews()
      }
      catch(e) { console.error('ideas:', e) }
    }

    async function sparkIdeas() {
      if (ideaStreaming.value) return
      ideaStreaming.value = true
      ideaStreamText.value = ''
      try {
        const resp = await fetch('/api/ideas/spark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idea: ideaInput.value })
        })
        const reader = resp.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop()
          for (const line of lines) {
            if (!line.startsWith('data:')) continue
            try {
              const data = JSON.parse(line.slice(5).trim())
              if (data.chunk) ideaStreamText.value += data.chunk
              if (data.error) ideaStreamText.value += "\nError: " + data.error
            } catch {}
          }
        }
      } catch(e) {
        ideaStreamText.value = 'Error: ' + e.message
      }
      ideaStreaming.value = false
    }

    async function saveSparkResult(shared) {
      const title = ideaShareTitle.value || ideaInput.value.slice(0, 40) || 'AI spark result'
      const content = ideaStreamText.value || ''
      if (!content.trim()) { showToast('No content to save'); return }
      try {
        const r = await api('/api/ideas', { method: 'POST', body: JSON.stringify({ title, content, tags: ['spark'], source: 'spark', shared: !!shared }) })
        if (r.id) {
          showToast(shared ? 'Saved and shared!' : 'Saved to your ideas')
          ideaShareTitle.value = ''
          await loadIdeas()
          const sr = await api('/api/ideas?shared=true'); sharedIdeas.value = sr.ideas || []
        }
      } catch(e) { showToast('Save failed: ' + e.message) }
    }

    async function likeIdea(id) {
      try {
        const r = await api('/api/ideas/' + id + '/like', { method: 'POST' })
        const idx = sharedIdeas.value.findIndex(i => i.id === id)
        if (idx >= 0) sharedIdeas.value[idx] = r
        const mi = ideaList.value.findIndex(i => i.id === id)
        if (mi >= 0) ideaList.value[mi] = r
      } catch(e) { showToast('Like failed: ' + e.message) }
    }

    function likedByMe(idea) {
      return idea.liked_by && idea.liked_by.includes(user.value.id)
    }

    return {
      gradSummary, switchToGraduation,
      user, markdown, previewHtml, submitting, summary, summaryLoading,
      roleLabel, updatePreview, loadTemplate, clearEditor, doSubmit, logout,
    formatHistoryReport,
      formatMessage,
      draftLoading, generateDraft,
      reportHistory, showHistory, historyViewReport,
    loadReportHistory, toggleHistory, viewHistoryReport, closeHistoryView, startNewReport,
    reportContext, showFeedback, loadReportContext, toggleFeedback,
      myActions, showActions, actionsLoading, toggleActions,
      activeTab, tasks, kanbanCols, switchToKanban, loadMyTasks,
      myTasksByStatus, isOverdue, updateTaskStatus,
      // AI 工具箱
      skillManifest, selectedSkill, skillInput, skillOutput, skillStreaming,
      skillPlaceholder, skillOutputHtml, switchToSkills, selectSkill, runSkillAI,
      showPolishSuggestion, goToSkill,
      // 价值链
      myVc, showVcModal, vcForm, vcGoals, vcSecondaryOpts,
      loadMyVc, submitVcForm,
      // 面试练习
      interviewScenario, interviewTopic, interviewContext,
      interviewHistory, interviewAnswer, interviewStreaming, interviewStreamText,
      switchToInterview, startInterview, sendInterviewAnswer, sendInterviewCoach,
      // 品牌
      brandName,
      // 日历
      calendarMonth, calendarWeekdays, calendarEvents, calendarLabel, calendarDays,
      switchToCalendar, prevMonth, nextMonth,
      // AI 助手
      assistantMessages, assistantInput, assistantStreaming,
      sendAssistantMessage, switchToAssistant, mySummary, myReportHtml,
      // 知识库
      kbFiles, kbSearch, kbLoading, kbFilteredFiles,
      kbViewingFile, kbViewingFileName, kbFileContent, kbSemQuery, kbSemResults, kbSemLoading, kbSemStats, semSearchKb, loadKbStats,
      loadKb, viewKbFile, switchToKb,
      // 我的档案
      myProfile, profileLoading, switchToProfile, capabilityLabels,
      courseData, courseLoading, courseSubTab, switchToCourse,
      // Daily Brief + Ideas
      dailyBrief, news, ideaList, ideaInput, ideaStreaming, ideaStreamText,
      sharedIdeas, ideaShareTitle, ideaShareContent,
      myTaskStats, saveSparkResult, likeIdea, likedByMe,
      switchToDailyBrief, switchToIdeas, sparkIdeas,
    }
  },
}).mount('#app')
