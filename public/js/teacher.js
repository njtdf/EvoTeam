const { createApp, ref, computed, onMounted, nextTick } = Vue

createApp({
  setup() {
    const user = ref(null)
    const students = ref([])
    const selectedStudentId = ref('')
    const report = ref(null)
    const summary = ref(null)
    const chatMessages = ref([])
    const chatInput = ref('')
    const chatStreaming = ref(false)
    const loadingReport = ref(false)
   const chatMessagesEl = ref(null)
 
    // --- 总览 Dashboard 状态 ---
    const dashboardData = ref(null)
    const loadingDashboard = ref(false)
    const briefGenerating = ref(false)

    // --- 会议 Tab 状态 ---
    const activeTab = ref('cockpit')
    const meetings = ref([])
    const selectedMeetingDate = ref('')
    const selectedMeeting = ref(null)
    const meetingDate = ref(new Date().toISOString().slice(0, 10))
    const meetingContent = ref('')
    const meetingUploading = ref(false)
    const meetingPolling = ref(false)
    const meetingSaving = ref(false)
    const meetingUploadMsg = ref('')
    let meetingPollTimer = null

    // --- 看板 Tab 状态 ---
    const tasks = ref([])
    const boardStats = ref(null)
    const news = ref([])
    const newsError = ref('')
    const showTaskModal = ref(false)
    const newTask = ref({ title: '', owner_student_id: '', deadline: '', priority: 'medium', project: '' })

    const kanbanCols = [
      { status: 'todo', label: '待办' },
      { status: 'in_progress', label: '进行中' },
      { status: 'done', label: '已完成' },
      { status: 'blocked', label: '阻塞' },
    ]

    const reportHtml = computed(() => {
      if (!report.value) return ''
      const r = report.value
      let md = `## ${r.meta.name} - ${r.meta.project}\n`
      md += `**Status:** ${r.meta.status} | **Period:** ${r.meta.period_start} ~ ${r.meta.period_end}\n\n`
      for (const s of r.sections) {
        md += `### ${s.heading}\n\n${s.content}\n\n`
      }
      try { return marked.parse(md) } catch { return md }
    })

    const meetingHtml = computed(() => {
      if (!selectedMeeting.value || !selectedMeeting.value.content) return ''
      try { return marked.parse(selectedMeeting.value.content) } catch { return selectedMeeting.value.content }
    })

    // ===== 周报 Tab =====
    async function loadStudents() {
      try {
        const data = await api('/api/students')
        students.value = data.students
      } catch (e) { showToast('Failed to load students: ' + e.message) }
    }

    async function onStudentChange() {
      if (!selectedStudentId.value) return
      report.value = null; summary.value = null; chatMessages.value = []
      loadingReport.value = true
      const sid = selectedStudentId.value
      const [reportResp, summaryResp, chatResp] = await Promise.allSettled([
        api(`/api/report/${sid}`), api(`/api/summary/${sid}`), api(`/api/chat/${sid}`),
      ])
      if (reportResp.status === 'fulfilled') report.value = reportResp.value.report
      loadingReport.value = false
      if (summaryResp.status === 'fulfilled' && summaryResp.value.summary) summary.value = summaryResp.value.summary
      if (chatResp.status === 'fulfilled') {
        chatMessages.value = chatResp.value.messages || []
        nextTick(scrollChatToBottom)
      }
    }

    async function sendChat() {
      const msg = chatInput.value.trim()
      if (!msg || chatStreaming.value) return
      chatInput.value = ''
      chatMessages.value.push({ role: 'user', content: msg })
      nextTick(scrollChatToBottom)
      chatMessages.value.push({ role: 'assistant', content: '' })
      const aiIdx = chatMessages.value.length - 1
      chatStreaming.value = true
      await streamChat(`/api/chat/${selectedStudentId.value}`, { message: msg },
        (chunk) => { chatMessages.value[aiIdx].content += chunk; nextTick(scrollChatToBottom) },
        () => { chatStreaming.value = false },
        (err) => { chatMessages.value[aiIdx].content += `\n[Error: ${err}]`; chatStreaming.value = false },
      )
    }

    function scrollChatToBottom() {
      const el = chatMessagesEl.value
      if (el) el.scrollTop = el.scrollHeight
    }

    // ===== 会议 Tab =====
    async function switchToMeeting() { activeTab.value = 'meeting'; await loadMeetings() }

    async function loadMeetings() {
      try { const data = await api('/api/meeting'); meetings.value = data.meetings || [] }
      catch (e) { showToast('加载会议列表失败: ' + e.message) }
    }

    async function uploadMeeting() {
      if (!meetingDate.value || !meetingContent.value.trim()) { showToast('请填写日期和纪要内容'); return }
      meetingUploading.value = true; meetingUploadMsg.value = ''
      try {
        await api('/api/meeting/upload', { method: 'POST', body: JSON.stringify({ date: meetingDate.value, content: meetingContent.value }) })
        selectedMeetingDate.value = meetingDate.value
        meetingUploadMsg.value = '已保存,AI 抽取中...'
        showToast('纪要已上传,AI 抽取中')
        startPollMeeting(meetingDate.value)
        await loadMeetings()
      } catch (e) { showToast('上传失败: ' + e.message); meetingUploading.value = false }
    }

    function startPollMeeting(date) {
      meetingPolling.value = true
      let attempts = 0
      const poll = async () => {
        attempts++
        try {
          const data = await api(`/api/meeting/${date}`)
          selectedMeeting.value = normalizeMeeting(data)
          if (data.actions) { meetingPolling.value = false; meetingUploading.value = false; meetingUploadMsg.value = ''; return }
          if (attempts < 45) { meetingPollTimer = setTimeout(poll, 2000) }
          else { meetingPolling.value = false; meetingUploading.value = false; meetingUploadMsg.value = 'AI 抽取超时,请稍后刷新' }
        } catch (e) {
          if (attempts < 45) { meetingPollTimer = setTimeout(poll, 2000) }
          else { meetingPolling.value = false; meetingUploading.value = false }
        }
      }
      poll()
    }

    async function loadMeeting(date) {
      selectedMeetingDate.value = date
      try { const data = await api(`/api/meeting/${date}`); selectedMeeting.value = normalizeMeeting(data) }
      catch (e) { showToast('加载会议失败: ' + e.message) }
    }

    function normalizeMeeting(data) {
      const m = { date: data.date, content: data.content, actions: data.actions }
      if (m.actions && Array.isArray(m.actions.actions)) {
        m.actions.actions = m.actions.actions.map(a => ({ ...a, owner_student_id: a.owner_student_id || '' }))
      }
      return m
    }

    function onOwnerChange(a) {
      const found = students.value.find(s => s.id === a.owner_student_id)
      if (found) { a.owner_name = found.name; a.unmatched = false }
      else { a.owner_name = ''; a.unmatched = true }
    }

    async function saveActions() {
      if (!selectedMeeting.value || !selectedMeeting.value.actions) return
      meetingSaving.value = true
      try {
        const data = await api(`/api/meeting/${selectedMeetingDate.value}/actions`, {
          method: 'PUT', body: JSON.stringify({ actions: selectedMeeting.value.actions.actions }),
        })
        if (data.actions) {
          selectedMeeting.value.actions.actions = data.actions.map(a => ({ ...a, owner_student_id: a.owner_student_id || '' }))
        }
        showToast('已保存改派')
        await loadMeetings()
      } catch (e) { showToast('保存失败: ' + e.message) }
      finally { meetingSaving.value = false }
    }

    // ===== 看板 Tab =====
    async function switchToKanban() {
      activeTab.value = 'kanban'
      await Promise.all([loadTasks(), loadBoardStats(), loadNews()])
    }

    async function loadTasks() {
      try { const data = await api('/api/tasks'); tasks.value = data.tasks || [] }
      catch (e) { showToast('加载任务失败: ' + e.message) }
    }

    async function loadBoardStats() {
      try { const data = await api('/api/board/stats'); boardStats.value = data.stats }
      catch (e) { /* non-critical */ }
    }

    async function loadNews() {
      try {
        const data = await api('/api/news')
        news.value = data.news || []
        newsError.value = data.error || ''
      } catch (e) { news.value = []; newsError.value = e.message }
    }

    function tasksByStatus(status) { return tasks.value.filter(t => t.status === status) }

    function isOverdue(t) {
      return t.deadline && t.deadline < new Date().toISOString().slice(0, 10) && t.status !== 'done'
    }

    async function createTask() {
      if (!newTask.value.title.trim()) { showToast('请输入任务标题'); return }
      try {
        const data = await api('/api/tasks', { method: 'POST', body: JSON.stringify(newTask.value) })
        if (data.ok) {
          showToast('任务已创建')
          showTaskModal.value = false
          newTask.value = { title: '', owner_student_id: '', deadline: '', priority: 'medium', project: '' }
          await loadTasks(); await loadBoardStats()
        }
      } catch (e) { showToast('创建失败: ' + e.message) }
    }

    async function updateTaskStatus(t, newStatus) {
      try {
        await api(`/api/tasks/${t.task_id}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) })
        t.status = newStatus
        await loadBoardStats()
      } catch (e) { showToast('更新失败: ' + e.message) }
    }

    async function deleteTask(taskId) {
      if (!confirm('删除此任务?')) return
      try {
        await api(`/api/tasks/${taskId}`, { method: 'DELETE' })
        await loadTasks(); await loadBoardStats()
        showToast('已删除')
      } catch (e) { showToast('删除失败: ' + e.message) }
    }

    async function promoteToKanban(date, taskId) {
      try {
        const data = await api('/api/tasks/from-meeting', { method: 'POST', body: JSON.stringify({ date, task_id: taskId }) })
        if (data.ok) showToast(`已提升到看板: ${data.task.title}`)
      } catch (e) { showToast('提升失败: ' + e.message) }
    }

    // ===== 总览 Dashboard =====
    async function switchToDashboard() {
      activeTab.value = 'dashboard'
      await loadDashboard()
    }

    async function loadDashboard() {
      loadingDashboard.value = true
      try {
        dashboardData.value = await api('/api/dashboard')
      } catch (e) { showToast('加载总览失败: ' + e.message) }
      finally { loadingDashboard.value = false }
    }

    function goToStudent(id) {
      activeTab.value = 'cockpit'
      selectedStudentId.value = id
      onStudentChange()
    }

    async function generateBrief() {
      briefGenerating.value = true
      try {
        const data = await api('/api/brief')
        const content = typeof data.brief === 'string' ? data.brief : JSON.stringify(data.brief, null, 2)
        const blob = new Blob([content], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'LabBrief.md'; a.click()
        URL.revokeObjectURL(url)
        showToast('组会简报已生成并下载')
      } catch (e) { showToast('生成失败: ' + e.message) }
      finally { briefGenerating.value = false }
    }

    onMounted(async () => {
      const u = await getMe()
      if (!u) { window.location.href = '/login'; return }
      if (u.role !== 'teacher') { window.location.href = '/student'; return }
      user.value = u
      await loadStudents()
    })

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

    async function openReviewMode() {
      activeTab.value = 'skills'
      if (skillManifest.value.length === 0) {
        try { const data = await api('/api/skills'); skillManifest.value = data.skills || [] }
        catch (e) { showToast('加载工具列表失败: ' + e.message); return }
      }
      const found = skillManifest.value.find(s => s.name === 'pre-submission-reviewer')
      if (found) selectSkill(found)
      else showToast('pre-submission-reviewer 技能未找到')
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

     // ===== 投稿追踪 (Feature 22) =====
     const submissions = ref([])
     const submissionStats = ref(null)
     const subStatuses = ['drafting', 'submitted', 'under_review', 'revision', 'accepted', 'rejected']
     const showSubModal = ref(false)
     const newSub = ref({ title: '', journal: '', deadline: '', owner_student_id: '' })
     async function switchToSubmissions() {
       activeTab.value = 'submissions'
       await loadSubmissions()
     }
     async function loadSubmissions() {
       try {
         const data = await api('/api/submissions')
         submissions.value = data.submissions || []
         const stats = await api('/api/submissions/stats')
         submissionStats.value = stats
       } catch (e) { showToast('加载投稿失败: ' + e.message) }
     }
     async function createSub() {
       try {
         await api('/api/submissions', { method: 'POST', body: JSON.stringify(newSub.value) })
         showSubModal.value = false
         newSub.value = { title: '', journal: '', deadline: '', owner_student_id: '' }
         await loadSubmissions()
         showToast('投稿已创建')
       } catch (e) { showToast('创建失败: ' + e.message) }
     }
     async function updateSub(s) {
       try { await api(`/api/submissions/${s.id}`, { method: 'PUT', body: JSON.stringify(s) }) }
       catch (e) { showToast('更新失败: ' + e.message) }
     }
     async function deleteSub(id) {
       try { await api(`/api/submissions/${id}`, { method: 'DELETE' }); await loadSubmissions(); showToast('已删除') }
       catch (e) { showToast('删除失败: ' + e.message) }
     }
     // ===== 排座 (Feature 11) =====
     const seatingRows = ref(6)
     const seatingCols = ref(8)
     const seatingMode = ref('snake')
     const seatingExamName = ref('')
     const seatingNames = ref('')
     const seatingLoading = ref(false)
     const seatingResult = ref(null)
     const seatingHistory = ref([])
     async function switchToSeating() {
       activeTab.value = 'seating'
       try { const data = await api('/api/seating'); seatingHistory.value = data.seatings || [] } catch (e) { showToast('加载历史失败: ' + e.message) }
     }
     async function generateSeating() {
       seatingLoading.value = true
       try {
         const names = seatingNames.value.split('\n').map(s => s.trim()).filter(Boolean)
         const data = await api('/api/seating/generate', { method: 'POST', body: JSON.stringify({ rows: seatingRows.value, cols: seatingCols.value, student_names: names, mode: seatingMode.value, exam_name: seatingExamName.value }) })
         seatingResult.value = data
         const hist = await api('/api/seating'); seatingHistory.value = hist.seatings || []
         showToast('座位图已生成')
       } catch (e) { showToast('生成失败: ' + e.message) }
       finally { seatingLoading.value = false }
     }
     async function loadSeatingDetail(examId) {
       try { seatingResult.value = await api('/api/seating/' + examId) }
       catch (e) { showToast('加载失败: ' + e.message) }
     }

     // ===== 备课 (Feature 15) =====
     const lessonCourse = ref('')
     const lessonChapter = ref('')
     const lessonTopic = ref('')
     const lessonTextbook = ref('')
     const lessonExtra = ref('')
     const lessonStreaming = ref(false)
     const lessonOutput = ref('')
     const lessonOutputHtml = computed(() => { try { return marked.parse(lessonOutput.value) } catch { return lessonOutput.value } })
     const lessonHistory = ref([])
     async function switchToLesson() {
       activeTab.value = 'lesson'
       try { const data = await api('/api/lessons'); lessonHistory.value = data.lessons || [] } catch (e) { showToast('加载历史失败: ' + e.message) }
     }
     async function generateLessonPlan() {
       lessonStreaming.value = true
       lessonOutput.value = ''
       try {
         await streamChat('/api/lesson/generate', { course: lessonCourse.value, chapter: lessonChapter.value, topic: lessonTopic.value, textbook: lessonTextbook.value, extra: lessonExtra.value },
           (chunk) => { lessonOutput.value += chunk },
           () => { lessonStreaming.value = false; api('/api/lessons').then(d => lessonHistory.value = d.lessons || []).catch(() => {}) },
           (err) => { showToast('生成失败: ' + err.message); lessonStreaming.value = false }
         )
       } catch (e) { showToast('生成失败: ' + e.message); lessonStreaming.value = false }
     }
     async function loadLessonDetail(filename) {
       try { const data = await api('/api/lesson/' + filename); lessonOutput.value = data.content }
       catch (e) { showToast('加载失败: ' + e.message) }
     }

     // ===== 工作量 (Feature 13) =====
     const workloadYear = ref(String(new Date().getFullYear()))
     const workloadResult = ref(null)
     const wlCourses = ref([])
     async function switchToWorkload() { activeTab.value = 'workload' }
     async function calcWorkload() {
       try { workloadResult.value = await api('/api/workload/calculate', { method: 'POST', body: JSON.stringify({ year: workloadYear.value, courses: wlCourses.value }) }); showToast('工作量已计算') }
       catch (e) { showToast('计算失败: ' + e.message) }
     }
     async function loadCoeffs() {
       try { const data = await api('/api/workload/coefficients'); showToast('系数已加载') }
       catch (e) { showToast('加载失败: ' + e.message) }
     }

     // ===== 记账 (Feature 14) =====
     const invoices = ref([])
     const invoiceStats = ref(null)
     const showInvoiceModal = ref(false)
     const newInvoice = ref({ date: '', amount: '', category: '', description: '', vendor: '' })
     async function switchToInvoice() {
       activeTab.value = 'invoice'
       try {
         invoices.value = (await api('/api/invoices')).invoices || []
         invoiceStats.value = await api('/api/invoices/stats')
       } catch (e) { showToast('加载失败: ' + e.message) }
     }
     async function addInvoiceRecord() {
       try {
         await api('/api/invoices', { method: 'POST', body: JSON.stringify(newInvoice.value) })
         showInvoiceModal.value = false
         newInvoice.value = { date: '', amount: '', category: '', description: '', vendor: '' }
         invoices.value = (await api('/api/invoices')).invoices || []
         invoiceStats.value = await api('/api/invoices/stats')
         showToast('已记录')
       } catch (e) { showToast('保存失败: ' + e.message) }
     }
     async function updateInvoice(inv) {
       try { await api('/api/invoices/' + inv.id, { method: 'PUT', body: JSON.stringify(inv) }) }
       catch (e) { showToast('更新失败: ' + e.message) }
     }
     async function delInvoice(id) {
       try {
         await api('/api/invoices/' + id, { method: 'DELETE' })
         invoices.value = (await api('/api/invoices')).invoices || []
         invoiceStats.value = await api('/api/invoices/stats')
         showToast('已删除')
       } catch (e) { showToast('删除失败: ' + e.message) }
     }

    // 面试/答辩 (Feature 20)
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

    // --- 价值链 Tab 状态 (Wave 5) ---
    const groupVc = ref(null)
    const alignments = ref([])
    const selectedVcStudent = ref(null)
    const vcSaving = ref(false)

    async function switchToValueCycle() {
      activeTab.value = 'valuecycle'
      await Promise.all([loadGroupVc(), loadAlignments()])
    }

    async function loadGroupVc() {
      try {
        const r = await fetch('/api/valuecycle/group')
        if (r.ok) groupVc.value = await r.json()
      } catch (e) { console.error('loadGroupVc:', e.message) }
    }

    async function loadAlignments() {
      try {
        const r = await fetch('/api/valuecycle/alignment/all')
        if (r.ok) {
          const data = await r.json()
          alignments.value = Array.isArray(data) ? data : []
        }
      } catch (e) { console.error('loadAlignments:', e.message) }
    }

    async function selectVcStudent(id) {
      try {
        const r = await fetch(`/api/valuecycle/${id}`)
        if (r.ok) selectedVcStudent.value = await r.json()
      } catch (e) { console.error('selectVcStudent:', e.message) }
    }

    async function saveVcAssessment() {
      if (!selectedVcStudent.value) return
      vcSaving.value = true
      try {
        const id = selectedVcStudent.value.student_id
        const assessment = selectedVcStudent.value.advisor_assessment
        const r = await fetch(`/api/valuecycle/${id}/assessment`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(assessment),
        })
        if (r.ok) {
          const data = await r.json()
          selectedVcStudent.value = data.valuecycle
          await loadAlignments()
        }
      } catch (e) { console.error('saveVcAssessment:', e.message) }
      vcSaving.value = false
    }

    return {
      user, students, selectedStudentId, report, summary, chatMessages,
      // 价值链
      groupVc, alignments, selectedVcStudent, vcSaving,
      switchToValueCycle, loadGroupVc, loadAlignments, selectVcStudent, saveVcAssessment,
      chatInput, chatStreaming, loadingReport, reportHtml, chatMessagesEl,
      onStudentChange, sendChat, logout,
      // 总览
      dashboardData, loadingDashboard, briefGenerating,
      switchToDashboard, loadDashboard, goToStudent, generateBrief,
      // 会议
      activeTab, meetings, selectedMeetingDate, selectedMeeting, meetingDate,
      meetingContent, meetingUploading, meetingPolling, meetingSaving,
      meetingUploadMsg, meetingHtml, switchToMeeting, loadMeetings,
      uploadMeeting, loadMeeting, onOwnerChange, saveActions,
      // 看板
      tasks, boardStats, news, newsError, showTaskModal, newTask, kanbanCols,
      switchToKanban, loadTasks, loadBoardStats, loadNews, tasksByStatus,
      isOverdue, createTask, updateTaskStatus, deleteTask, promoteToKanban,
      // AI 工具箱
      skillManifest, selectedSkill, skillInput, skillOutput, skillStreaming,
     skillPlaceholder, skillOutputHtml, switchToSkills, selectSkill, runSkillAI,
     openReviewMode, goToSkill,
      // 投稿追踪
      submissions, submissionStats, subStatuses, showSubModal, newSub,
      switchToSubmissions, loadSubmissions, createSub, updateSub, deleteSub,
      // 排座
      seatingRows, seatingCols, seatingMode, seatingExamName, seatingNames, seatingLoading, seatingResult, seatingHistory,
      switchToSeating, generateSeating, loadSeatingDetail,
      // 备课
      lessonCourse, lessonChapter, lessonTopic, lessonTextbook, lessonExtra, lessonStreaming, lessonOutput, lessonOutputHtml,
      switchToLesson, generateLessonPlan, loadLessonDetail,
      // 工作量
      workloadYear, workloadResult, wlCourses,
      switchToWorkload, calcWorkload, loadCoeffs,
      // 记账
      invoices, invoiceStats, showInvoiceModal, newInvoice,
      switchToInvoice, addInvoiceRecord, updateInvoice, delInvoice,
      // 面试
      interviewScenario, interviewTopic, interviewContext,
      interviewHistory, interviewAnswer, interviewStreaming, interviewStreamText,
      switchToInterview, startInterview, sendInterviewAnswer, sendInterviewCoach,
    }
  },
}).mount('#app')
