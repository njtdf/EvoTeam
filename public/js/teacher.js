const { createApp, ref, computed, onMounted, nextTick, watch } = Vue

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
   const reportContext = ref(null)
  const chatMessagesEl = ref(null)
 
    // --- 总览 Dashboard 状态 ---
    const dashboardData = ref(null)
    const loadingDashboard = ref(false)
    const briefGenerating = ref(false)

    // --- 会议 Tab 状态 ---
    const activeTab = ref('dashboard')
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
   const newTask = ref({ title: '', owner_student_id: '', deadline: '', priority: 'medium', project: '', description: '' })
   const taskDetail = ref(null)
   const showTaskDetail = ref(false)
   const taskDetailLoading = ref(false)
   // Phase 4: Promise Ledger (Li Kaifu execution closed-loop)
   const promiseStats = ref(null)
   const consistencyData = ref([])
   const overduePromises = ref([])
   const upcomingPromises = ref([])
   const showPromisePanel = ref(false)
   // Phase 5: Student Profile
   const profileFilter = ref('all')
   const profileList = ref([])
   const profileLoading = ref(false)
   const profileDetail = ref(null)
   const showProfileDetail = ref(false)
   const profileDetailLoading = ref(false)
   const labProgress = ref(null)
   const filteredProfiles = Vue.computed(() => {
     if (profileFilter.value === 'all') return profileList.value
     return profileList.value.filter(s => s.enrollment_status === profileFilter.value)
   })

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
    async function switchToCockpit() { activeTab.value = 'cockpit'; window.location.hash = 'cockpit'; if (students.value.length === 0) await loadStudents() }

    async function loadStudents() {
      try {
        const data = await api('/api/students')
        students.value = data.students
      } catch (e) { showToast('Failed to load students: ' + e.message) }
    }

    async function onStudentChange() {
      if (!selectedStudentId.value) return
      report.value = null; summary.value = null; chatMessages.value = []; reportContext.value = null
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
      // Phase 3: 飞轮上下文 (任务+会议行动+飞轮状态)
      try {
        const ctx = await api(`/api/report-context/${sid}`)
        reportContext.value = ctx
      } catch (e) { console.error('report-context:', e.message) }
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

    // Format message content as HTML (Markdown → HTML via marked)
    function formatMessage(content) {
      if (!content) return ''
      try { return marked.parse(content) } catch { return content }
    }
    // ===== 毕业状态 =====
    const gradStudentId = ref('')
    const gradSummary = ref(null)

    async function switchToGraduation() { activeTab.value = 'graduation'; window.location.hash = 'graduation'; if (students.value.length === 0) await loadStudents() }

    async function loadGraduation() {
      if (!gradStudentId.value) { gradSummary.value = null; return }
      try {
        gradSummary.value = await api('/api/graduation/' + gradStudentId.value)
      } catch (e) { showToast('加载毕业状态失败: ' + e.message) }
    }

    async function updateGradReq(reqId, status) {
      if (!gradStudentId.value) return
      try {
        const r = await api('/api/graduation/' + gradStudentId.value + '/requirement/' + reqId, {
          method: 'PUT', body: JSON.stringify({ status })
        })
        if (r.ok) {
          const updated = await api('/api/graduation/' + gradStudentId.value)
          gradSummary.value = updated
          showToast('已更新')
        }
      } catch (e) { showToast('更新失败: ' + e.message) }
    }

    async function updateGradNotes(reqId, notes) {
      if (!gradStudentId.value) return
      try {
        await api('/api/graduation/' + gradStudentId.value + '/requirement/' + reqId, {
          method: 'PUT', body: JSON.stringify({ notes })
        })
      } catch (e) { showToast('备注保存失败: ' + e.message) }
    }

    async function seedGraduation(student) {
      if (!student?.id) return
      try {
        const r = await api('/api/graduation/' + student.id + '/seed', {
          method: 'POST', body: JSON.stringify({ role: student.role })
        })
        if (r.ok) { await loadGraduation(); showToast('毕业模板已重置') }
      } catch (e) { showToast('重置失败: ' + e.message) }
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
      await Promise.all([loadTasks(), loadBoardStats()])
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

    function openTaskModal() {
      const d = new Date()
      d.setDate(d.getDate() + 7)
      newTask.value = { title: '', owner_student_id: '', deadline: d.toISOString().slice(0,10), priority: 'medium', project: '', description: '' }
      showTaskModal.value = true
    }

    async function createTask() {
      if (!newTask.value.title.trim()) { showToast('请输入任务标题'); return }
      try {
        const data = await api('/api/tasks', { method: 'POST', body: JSON.stringify(newTask.value) })
        if (data.ok) {
          showToast('任务已创建')
         showTaskModal.value = false
         newTask.value = { title: '', owner_student_id: '', deadline: '', priority: 'medium', project: '', description: '' }
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

   // ===== Phase 4: 任务详情 =====
   async function openTaskDetail(taskId) {
     showTaskDetail.value = true
     taskDetailLoading.value = true
     taskDetail.value = null
     try {
       const data = await api(`/api/tasks/${taskId}/detail`)
       taskDetail.value = data
     } catch (e) { showToast('加载任务详情失败: ' + e.message) }
     finally { taskDetailLoading.value = false }
   }

   function closeTaskDetail() {
     showTaskDetail.value = false
     taskDetail.value = null
   }

   async function promoteToKanban(date, taskId) {
      try {
        const data = await api('/api/tasks/from-meeting', { method: 'POST', body: JSON.stringify({ date, task_id: taskId }) })
        if (data.ok) showToast(`已提升到看板: ${data.task.title}`)
      } catch (e) { showToast('提升失败: ' + e.message) }
    }

    // ===== 总览 Dashboard =====
    async function loadPromiseData() {
      try {
        const [stats, consistency, overdue, upcoming] = await Promise.all([
          api('/api/promises/stats').catch(() => null),
          api('/api/promises/consistency').catch(() => ({ students: [] })),
          api('/api/promises/overdue').catch(() => ({ promises: [] })),
          api('/api/promises/upcoming?days=7').catch(() => ({ promises: [] })),
        ])
        promiseStats.value = stats?.stats || null
        consistencyData.value = consistency?.students || []
        overduePromises.value = overdue?.promises || []
        upcomingPromises.value = upcoming?.promises || []
      } catch (e) {
        console.error('loadPromiseData error:', e.message)
      }
    }

    async function fulfillPromiseAction(promiseId) {
      try {
        await api('/api/promises/' + promiseId + '/fulfill', {
          method: 'PUT',
          body: JSON.stringify({ evidence: '' }),
        })
        showToast('承诺已标记兑现')
        await loadPromiseData()
      } catch (e) { showToast('操作失败: ' + e.message) }
    }

async function switchToProfile() {
      activeTab.value = 'profile'
      await loadProfileList()
    }

    async function loadProfileList() {
      profileLoading.value = true
      try {
        const data = await api('/api/student-profiles')
        profileList.value = data.students || []
      } catch (e) { showToast('加载学生档案失败: ' + e.message) }
      finally { profileLoading.value = false }
    }

    async function openProfile(studentId) {
      showProfileDetail.value = true
      profileDetailLoading.value = true
      profileDetail.value = null
      try {
        const data = await api('/api/student-profile/' + studentId)
        profileDetail.value = data
      } catch (e) { showToast('加载档案失败: ' + e.message) }
      finally { profileDetailLoading.value = false }
    }

    function closeProfileDetail() {
      showProfileDetail.value = false
      profileDetail.value = null
    }

    async function loadLabProgress() {
      try {
        labProgress.value = await api('/api/lab-progress')
      } catch (e) { console.error('loadLabProgress error:', e.message) }
    }

async function switchToDashboard() {
      activeTab.value = 'dashboard'
      await Promise.all([loadDashboard(), loadTeamFeed()])
      await loadTodayTasks()
      await loadLabProgress()
      await loadPromiseData()
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
        const content = data.markdown || JSON.stringify(data.brief, null, 2)
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
     const hash = window.location.hash.slice(1)
     const validTabs = ['graduation', 'dashboard','todo','notify','projects','ideas','cockpit','meeting','kanban','revision','skills','submissions','review','exam','teaching','workload','invoice','interview','valuecycle','agents','calendar','knowledge']
     if (hash && validTabs.includes(hash)) {
       if (hash === 'dashboard') await switchToDashboard()
        else if (hash === 'todo') await switchToTodo()
        else if (hash === 'notify') await switchToNotify()
        else if (hash === 'projects') await switchToProjects()
        else if (hash === 'revision') switchToRevision()
        else if (hash === 'review') switchToReview()
        else if (hash === 'exam') await switchToSeating()
        else if (hash === 'teaching') await switchToLesson()
       else if (hash === 'cockpit') switchToCockpit()
       else if (hash === 'meeting') await switchToMeeting()
       else if (hash === 'kanban') await switchToKanban()
       else if (hash === 'skills') await switchToSkills()
       else if (hash === 'submissions') await switchToSubmissions()
       else if (hash === 'seating') await switchToSeating()
       else if (hash === 'lesson') await switchToLesson()
       else if (hash === 'workload') await switchToWorkload()
       else if (hash === 'invoice') await switchToInvoice()
       else if (hash === 'interview') await switchToInterview()
        else if (hash === 'agents') switchToAgents()
        else if (hash === 'calendar') await switchToCalendar()
        else if (hash === 'valuecycle') await switchToValueCycle()
        else if (hash === 'ideas') await switchToIdeas()
        else if (hash === 'knowledge') await switchToKnowledge()
     } else {
       await switchToDashboard()
     }
   })

    // Sync URL hash when tab changes (so refresh/bookmark keeps current tab)
    watch(activeTab, (newTab) => {
      autoSwitchAgent(newTab)
      if (window.location.hash !== '#' + newTab) {
        history.replaceState(null, '', '#' + newTab)
      }
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
        activeTab.value = 'exam'; examSubTab.value = 'seating'
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
        activeTab.value = 'teaching'; teachingSubTab.value = 'lesson'
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
      await Promise.all([loadGroupVc(), loadAlignments(), loadGoalTree()])
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
        await loadDecisions(id)
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


    // v2.1 W6a: Graduation / Capability / Decision
    const capabilityLabels = {
      modeling: '建模', experiment: '实验', writing: '写作', coding: '编程',
      presentation: '表达', literature: '文献', independence: '独立性'
    }
    const newDecision = ref({ text: '', rationale: '' })

    async function saveGraduation() {
      if (!selectedVcStudent.value) return
      try {
        const id = selectedVcStudent.value.student_id
        const gs = selectedVcStudent.value.graduation_state
        const r = await fetch(`/api/valuecycle/${id}/graduation`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gs)
        })
        if (r.ok) { selectedVcStudent.value = (await r.json()).valuecycle; await loadAlignments() }
      } catch (e) { console.error('saveGraduation:', e.message) }
    }

    async function saveCapability() {
      if (!selectedVcStudent.value) return
      try {
        const id = selectedVcStudent.value.student_id
        const cap = selectedVcStudent.value.capability
        const r = await fetch(`/api/valuecycle/${id}/capability`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cap)
        })
        if (r.ok) { selectedVcStudent.value = (await r.json()).valuecycle; await loadAlignments() }
      } catch (e) { console.error('saveCapability:', e.message) }
    }

    async function addDecision() {
      if (!selectedVcStudent.value || !newDecision.value.text) return
      try {
        const id = selectedVcStudent.value.student_id
        const r = await fetch(`/api/decisions/${id}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision: newDecision.value.text, rationale: newDecision.value.rationale })
        })
        if (r.ok) {
          const data = await r.json()
          if (data.valuecycle?.decision_log) selectedVcStudent.value.decision_log = data.valuecycle.decision_log
          await loadDecisions(id)
          newDecision.value = { text: '', rationale: '' }
        }
      } catch (e) { console.error('addDecision:', e.message) }
    }

    const decisionsList = ref([])
    const decisionsStats = ref(null)

    async function loadDecisions(studentId) {
      try {
        const r = await fetch(`/api/decisions/${studentId}`)
        if (r.ok) {
          const data = await r.json()
          decisionsList.value = data.decisions || []
          decisionsStats.value = data.stats || null
        }
      } catch (e) { console.error('loadDecisions:', e.message) }
    }

    async function deleteDecision(decisionId) {
      if (!selectedVcStudent.value) return
      const id = selectedVcStudent.value.student_id
      try {
        const r = await fetch(`/api/decisions/${id}/${decisionId}`, { method: 'DELETE' })
        if (r.ok) { await loadDecisions(id) }
      } catch (e) { console.error('deleteDecision:', e.message) }
    }

    async function updateDecisionOutcome(decisionId, outcome) {
      if (!selectedVcStudent.value) return
      const id = selectedVcStudent.value.student_id
      try {
        const r = await fetch(`/api/decisions/${id}/${decisionId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outcome })
        })
        if (r.ok) { await loadDecisions(id) }
      } catch (e) { console.error('updateDecisionOutcome:', e.message) }
    }
   // --- Agent 面板 ---
  const agents = ref([])

  function switchToAgents() {
    activeTab.value = 'agents'
    window.location.hash = 'agents'
  }

  // ===== Agent 管理 (创建/编辑) =====
  const showAgentModal = ref(false)
  const newAgent = ref({ name: '', role: '', description: '', icon: '🤖', capabilitiesStr: '' })
  function createAgent() {
    const a = newAgent.value
    if (!a.name.trim()) return
   const caps = a.capabilitiesStr.split(',').map(s => s.trim()).filter(Boolean)
    const existing = a.id ? agents.value.find(x => x.id === a.id) : null
    if (existing) {
      existing.icon = a.icon || '🤖'
      existing.shortName = a.name
      existing.name = a.name
      existing.role = a.role || '自定义'
      existing.description = a.description || ''
      existing.capabilities = caps
    } else {
      agents.value.push({
        id: 'custom-' + Date.now(),
        icon: a.icon || '🤖',
        shortName: a.name,
        name: a.name,
        role: a.role || '自定义',
        description: a.description || '',
        color: 'gray',
        status: 'idle',
        capabilities: caps
      })
    }
    fetch('/api/agents/save', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(agents.value)}).catch(()=>{})
   showAgentModal.value = false
    newAgent.value = { name: '', role: '', description: '', icon: '🤖', capabilitiesStr: '' }
  }

  // ===== 知识库 (文件管理) =====
  const kbFiles = ref([])
  const kbLoading = ref(false)
  const kbPath = ref('')
  async function loadKbFiles() {
    kbLoading.value = true
    try {
      const r = await api('/api/kb/list')
      kbFiles.value = r.files || []
      kbPath.value = r.path || ''
    } catch(e) { console.error('KB load error:', e) }
    kbLoading.value = false
  }

    // ===== 会议 sub-tabs =====
    const meetingSubTab = ref('minutes')

    // ===== STT (实时转写) =====
    const sttRecording = ref(false)
    const sttTranscript = ref('')
    const sttError = ref('')
    const sttSummarizing = ref(false)
    let sttWS = null
    let sttRecognition = null

    async function startSTT() {
      sttError.value = ''
      sttTranscript.value = ''
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        sttRecording.value = true
        stream.getTracks().forEach(t => t.stop())
        // 尝试 WebSocket (FunASR)，降级到 Web Speech API
        try {
          sttWS = new WebSocket((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/api/stt')
          sttWS.onmessage = (ev) => { if (ev.data) sttTranscript.value += ev.data }
          sttWS.onerror = () => { sttError.value = 'FunASR 未连接，使用浏览器语音识别'; fallbackWebSpeech() }
        } catch { fallbackWebSpeech() }
      } catch (e) { sttError.value = '麦克风访问失败: ' + e.message }
    }

    function fallbackWebSpeech() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SR) { sttError.value = '浏览器不支持语音识别，请用 Chrome/Edge'; return }
      sttRecognition = new SR()
      sttRecognition.continuous = true
      sttRecognition.interimResults = true
      sttRecognition.lang = 'zh-CN'
      sttRecognition.onresult = (ev) => {
        let txt = ''
        for (let i = 0; i < ev.results.length; i++) txt += ev.results[i][0].transcript
        sttTranscript.value = txt
      }
      sttRecognition.onerror = (e) => { sttError.value = '语音识别错误: ' + e.error }
      sttRecognition.start()
    }

    function stopSTT() {
      sttRecording.value = false
      if (sttWS) { try { sttWS.close() } catch {} sttWS = null }
      if (sttRecognition) { try { sttRecognition.stop() } catch {} sttRecognition = null }
    }

    async function sttSummarize() {
      if (!sttTranscript.value) return
      sttSummarizing.value = true
      try {
        const r = await fetch('/api/meeting/upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ date: new Date().toISOString().slice(0, 10), content: sttTranscript.value })
        })
        const d = await r.json()
        if (d.ok) { showToast('已上传会议纪要并触发 AI 解析,切换到"组会"子页查看结果'); meetingSubTab.value = 'minutes'; await loadMeetings() }
      } catch (e) { showToast('总结失败: ' + e.message) }
      sttSummarizing.value = false
    }

   // ===== ToDo =====
   const todoItems = ref([])
   const newTodoText = ref('')
   const newTodoPriority = ref('medium')
   const todoCount = computed(() => todoItems.value.filter(t => t.status !== 'done').length)

   // ===== 总览 today tasks + date =====
   const todayTasks = ref([])
   const todayDateStr = computed(() => {
     const d = new Date()
     return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
   })
   const todayWeekday = computed(() => {
     const w = ['周日','周一','周二','周三','周四','周五','周六']
     return w[new Date().getDay()]
   })
   async function loadTodayTasks() {
     try {
       const data = await api('/api/tasks?status=todo,in_progress')
       todayTasks.value = (data.tasks || []).filter(t => {
         if (!t.deadline) return true
         return t.deadline <= todayDateStr.value + ' 23:59'
       }).slice(0, 8)
     } catch { todayTasks.value = [] }
   }

   async function switchToTodo() {
      activeTab.value = 'todo'; window.location.hash = 'todo'
      await loadTodo()
    }
    async function loadTodo() {
      try {
        const data = await api('/api/tasks?status=todo,in_progress')
        todoItems.value = (data.tasks || []).filter(t => t.owner_student_id === user.value.id)
      } catch { todoItems.value = [] }
    }
    async function addTodo() {
      if (!newTodoText.value.trim()) return
      try {
        await api('/api/tasks', 'POST', { title: newTodoText.value, priority: newTodoPriority.value, source: 'manual', owner_student_id: user.value.id, owner_name: user.value.name })
        newTodoText.value = ''
        await loadTodo()
      } catch (e) { showToast('添加失败: ' + e.message) }
    }
    async function toggleTodo(t) {
      const newStatus = t.status === 'done' ? 'todo' : 'done'
      await api('/api/tasks/' + t.task_id, 'PUT', { status: newStatus })
      await loadTodo()
    }

    // ===== 通知 =====
    const emails = ref([])
    const emailSyncing = ref(false)
    const unreadCount = computed(() => emails.value.length)
    async function switchToNotify() {
      activeTab.value = 'notify'; window.location.hash = 'notify'
      await loadEmails()
    }
    async function loadEmails() {
      try { const d = await api('/api/email/unread'); emails.value = d.emails || [] } catch { emails.value = [] }
    }
    async function syncEmail() {
      emailSyncing.value = true
      try { await api('/api/email/sync', 'POST'); await loadEmails(); showToast('邮件同步完成') }
      catch (e) { showToast('同步失败: ' + e.message) }
      emailSyncing.value = false
    }

    // ===== 项目管理 =====
    const projectList = ref([])
    async function switchToProjects() {
      activeTab.value = 'projects'; window.location.hash = 'projects'
      await loadProjects()
    }
    async function loadProjects() {
      try {
        const d = await api('/api/dashboard')
        const map = {}
        for (const s of (d.students || [])) {
          const proj = s.project || '未分类'
          if (!map[proj]) map[proj] = { name: proj, members: [], tasks: [], expanded: false }
          map[proj].members.push({ id: s.id, name: s.name })
        }
        const tasks = await api('/api/tasks')
        for (const t of (tasks.tasks || [])) {
          const student = (d.students || []).find(s => s.id === t.owner_student_id)
          const proj = student?.project || '未分类'
          if (map[proj]) map[proj].tasks.push(t)
        }
        projectList.value = Object.values(map).map(p => ({ ...p, taskCount: p.tasks.length }))
      } catch (e) { projectList.value = [] }
    }

    // ===== 修改 (论文/专利/报告) =====
    const revisionMessages = ref([])
    const revisionInput = ref('')
    const revisionStreaming = ref(false)
    const revisionStreamText = ref('')
    const revisionDoc = ref('')
    function switchToRevision() { activeTab.value = 'revision'; window.location.hash = 'revision' }
    async function sendRevisionChat() {
      const msg = revisionInput.value.trim()
      if (!msg || revisionStreaming.value) return
      revisionInput.value = ''
      const ctx = revisionDoc.value.slice(0, 4000)
      revisionMessages.value.push({ role: 'user', content: msg })
      revisionStreaming.value = true
      revisionStreamText.value = ''
      try {
        const resp = await fetch('/api/skills/paper-polish', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'include', body: JSON.stringify({ input: msg + '\n\n--- 文档内容 ---\n' + ctx })
        })
        const reader = resp.body.getReader()
        const dec = new TextDecoder()
        let buf = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          const lines = buf.split('\n'); buf = lines.pop()
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.slice(5).trim()
              if (data === '[DONE]') break
              try { revisionStreamText.value += JSON.parse(data).content || '' } catch { revisionStreamText.value += data }
            }
          }
        }
        if (revisionStreamText.value) revisionMessages.value.push({ role: 'ai', content: revisionStreamText.value })
      } catch (e) { revisionMessages.value.push({ role: 'ai', content: '请求失败: ' + e.message }) }
      revisionStreaming.value = false
      revisionStreamText.value = ''
    }

    // ===== 审稿 =====
    const reviewInput = ref('')
    const reviewStreaming = ref(false)
    const reviewStreamText = ref('')
    const reviewOutput = computed(() => reviewStreamText.value)
    const reviewOutputHtml = computed(() => { try { return marked.parse(reviewOutput.value) } catch { return reviewOutput.value } })
    function switchToReview() { activeTab.value = 'review'; window.location.hash = 'review' }
    async function runReview() {
      if (!reviewInput.value.trim() || reviewStreaming.value) return
      reviewStreaming.value = true
      reviewStreamText.value = ''
      try {
        const resp = await fetch('/api/skills/pre-submission-reviewer', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'include', body: JSON.stringify({ input: reviewInput.value })
        })
        const reader = resp.body.getReader()
        const dec = new TextDecoder()
        let buf = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          const lines = buf.split('\n'); buf = lines.pop()
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.slice(5).trim()
              if (data === '[DONE]') break
              try { reviewStreamText.value += JSON.parse(data).content || '' } catch { reviewStreamText.value += data }
            }
          }
        }
      } catch (e) { reviewStreamText.value = '请求失败: ' + e.message }
      reviewStreaming.value = false
    }

    // ===== 考试/教学 sub-tabs =====
    const examSubTab = ref('seating')
    const teachingSubTab = ref('lesson')
    const examSubTabLabel = computed(() => ({ scoring: '登分', obe: 'OBE', invigilation: '监考', question: '出题' }[examSubTab.value] || ''))
    const teachingSubTabLabel = computed(() => ({ learning: '学情', questionbank: '题库', experience: '经验' }[teachingSubTab.value] || ''))
    function switchToExam() { activeTab.value = 'exam'; window.location.hash = 'exam'; switchToSeating() }
    function switchToTeaching() { activeTab.value = 'teaching'; window.location.hash = 'teaching'; switchToLesson() }

    // ===== 团队动态 feed =====
    const teamFeed = ref([])
    const todayMeetings = ref(0)
    const overdueCount = computed(() => dashboardData.value?.stats?.overdue_tasks || 0)
    async function loadTeamFeed() {
      const feed = []
      try {
        const d = await api('/api/dashboard')
        for (const s of (d.students || [])) {
          if (s.report_submitted) feed.push({ time: s.report_date || '', icon: '📝', text: s.name + ' 提交了周报' })
          if (s.overdue_tasks > 0) feed.push({ time: '', icon: '⚠', text: s.name + ' 有 ' + s.overdue_tasks + ' 个逾期任务' })
        }
      } catch {}
      try {
        const m = await api('/api/meeting')
        for (const mt of (m.meetings || []).slice(0, 3)) feed.push({ time: mt.date, icon: '🗓️', text: '会议 ' + mt.date })
      } catch {}
      teamFeed.value = feed.slice(0, 15)
    }

    // --- 日历 ---
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
      // Monday = 0
      let startWeekday = firstDay.getDay() - 1
      if (startWeekday < 0) startWeekday = 6
      const days = []
      // Previous month padding
      const prevLast = new Date(y, m - 1, 0).getDate()
      for (let i = startWeekday - 1; i >= 0; i--) {
        days.push({ num: prevLast - i, inMonth: false, isToday: false, events: [] })
      }
      // Current month
      const today = new Date()
      const todayStr = today.toISOString().slice(0, 10)
      for (let d = 1; d <= lastDay.getDate(); d++) {
        const dateStr = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0')
        const evs = calendarEvents.value.filter(e => e.date === dateStr)
        days.push({ num: d, inMonth: true, isToday: dateStr === todayStr, events: evs })
      }
      // Next month padding to fill 6 rows
      const remaining = 42 - days.length
      for (let d = 1; d <= remaining; d++) {
        days.push({ num: d, inMonth: false, isToday: false, events: [] })
      }
      return days
    })

    async function switchToCalendar() {
      activeTab.value = 'calendar'
      window.location.hash = 'calendar'
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


    
  // KB search + file viewer
  const kbSearch = ref('');
  const kbViewingFile = ref(false);
  const kbViewingFileName = ref('');
  const kbFileContent = ref('');
  const kbFilteredFiles = computed(() => {
    if (!kbSearch.value) return kbFiles.value;
    const q = kbSearch.value.toLowerCase();
    return kbFiles.value.filter(f => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
  });
  async function viewKbFile(path) {
    kbViewingFile.value = true;
    kbViewingFileName.value = path.split('/').pop();
    kbFileContent.value = '加载中...';
    try {
      const r = await fetch('/api/kb/file?path=' + encodeURIComponent(path));
      const d = await r.json();
      kbFileContent.value = d.content || d.error || '无内容';
    } catch(e) { kbFileContent.value = '加载失败: ' + e.message; }
  }

  // Agent management
  const agentSubTab = ref('agents');
  function editAgent(a) { showAgentModal.value = true; newAgent.value = {...a, capabilitiesStr: (a.capabilities||[]).join(',')}; }
  function deleteAgent(id) {
    if (!confirm('确定删除此 Agent?')) return;
    agents.value = agents.value.filter(a => a.id !== id);
    // Save to file
    fetch('/api/agents/save', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(agents.value)});
  }

  // MCP config
  const mcpConfig = ref({url:'', tools:'', forbidden:''});
  const mcpSaved = ref(false);
  function saveMcpConfig() {
    mcpSaved.value = true;
    setTimeout(() => mcpSaved.value = false, 3000);
  }



  // ===== 知识库 (TF-IDF) =====
  const kbSearchQuery = ref('')
  const kbSearchResults = ref([])
  const kbSemLoading = ref(false)
  const kbStats = ref(null)
  const kbDocuments = ref([])
  const kbPage = ref(1)
  const kbPerPage = ref(20)
  const kbTotalDocs = ref(0)
  const kbTotalPages = computed(() => Math.ceil(kbTotalDocs.value / kbPerPage.value) || 1)
  const kbShowDocs = ref(false)
  const kbRebuilding = ref(false)

  async function switchToKnowledge() {
    activeTab.value = 'knowledge'
    await loadKbStats()
    await loadKbDocuments()
  }
  async function loadKbStats() {
    try { const r = await api('/api/kb/stats'); kbStats.value = r } catch(e) { console.error('KB stats:', e) }
  }
  async function loadKbDocuments() {
    try { const r = await api('/api/kb/documents?page=' + kbPage.value + '&per_page=' + kbPerPage.value); kbDocuments.value = r.documents || []; kbTotalDocs.value = r.total || 0 } catch(e) { console.error('KB docs:', e) }
  }
  async function searchKb() {
    const q = kbSearchQuery.value.trim()
    if (!q) { kbSearchResults.value = []; return }
    kbSemLoading.value = true
    try { const r = await api('/api/kb/search?q=' + encodeURIComponent(q) + '&limit=20'); kbSearchResults.value = r.results || [] } catch(e) { showToast('搜索失败: ' + e.message) }
    kbSemLoading.value = false
  }
  async function rebuildKbIndex() {
    kbRebuilding.value = true
    try { const r = await api('/api/kb/index', { method: 'POST' }); showToast('重建完成: ' + (r.indexed?.docs||0) + ' docs'); await loadKbStats(); await loadKbDocuments() } catch(e) { showToast('重建失败') }
    kbRebuilding.value = false
  }
  function kbNextPage() { if (kbPage.value < kbTotalPages.value) { kbPage.value++; loadKbDocuments() } }
  function kbPrevPage() { if (kbPage.value > 1) { kbPage.value--; loadKbDocuments() } }

    // Task status to percentage for progress bar
    function taskStatusPct(status) {
      const map = { todo: 0, in_progress: 50, done: 100, blocked: 30 }
      return map[status] || 0
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

    async function updateCourseWeek() {
      if (!courseData.value) return
      try {
        const updated = await api('/api/course/电力系统基础/week', {
          method: 'PUT',
          body: JSON.stringify({ week: courseData.value.current_week })
        })
        if (updated) courseData.value = updated
      } catch(e) {
        console.error('Update week error:', e)
      }
    }



    // --- Daily Brief + Goal Tree + Ideas ---
    const dailyBrief = ref(null)
    const goalTree = ref(null)
    const ideaList = ref([])
    const ideaInput = ref('')
    const ideaStreaming = ref(false)
    const ideaStreamText = ref('')

    async function switchToDailyBrief() {
      activeTab.value = 'daily'
      await loadDailyBrief()
    }

    async function loadDailyBrief() {
      try { dailyBrief.value = await api('/api/daily-brief') }
      catch(e) { console.error('dailyBrief:',
e
) }
    }

    async function switchToIdeas() {
      activeTab.value = 'ideas'
      await Promise.all([loadIdeas(), loadGoalTree(), loadSharedIdeas(), loadNews()])
    }

    async function loadGoalTree() {
      try { goalTree.value = await api('/api/goal-tree') }
      catch(e) { console.error('goalTree:',
e
) }
    }

    async function loadIdeas() {
      try { const r = await api('/api/ideas');
ideaList.value
= r.ideas || [] }
      catch(e) { console.error('ideas:',
e
) }
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
        const sharedIdeas = ref([])
    async function loadSharedIdeas() {
      try { const r = await api('/api/ideas?shared=true'); sharedIdeas.value = r.ideas || [] }
      catch(e) { console.error('sharedIdeas:', e) }
    }
    async function likeIdea(id) {
      try {
        const r = await api('/api/ideas/' + id + '/like', { method: 'POST' })
        const idx = sharedIdeas.value.findIndex(i => i.id === id)
        if (idx >= 0) sharedIdeas.value[idx] = r
      } catch(e) { showToast('Like failed: ' + e.message) }
    }
    function likedByMe(idea) {
      return idea.liked_by && idea.liked_by.includes(user.value.id)
    }

    // ===== C-Level Agents (global chat bar dropdown) =====
const cAgents = [
  { id: 'ceo', icon: '👨‍⚖️', shortName: 'CEO', name: '首席执行官', role: '战略决策', gradient: 'linear-gradient(135deg,#1e3a5f,#2980b9)' , status: 'active', capabilities: ['战略决策', '资源分配', '优先级判断', '全局视角']},
  { id: 'cfo', icon: '💰', shortName: 'CFO', name: '首席财务官', role: '经费管理', gradient: 'linear-gradient(135deg,#27ae60,#2ecc71)' , status: 'active', capabilities: ['经费管理', '预算分配', '成本控制', '经费效率']},
  { id: 'cto', icon: '🔧', shortName: 'CTO', name: '首席技术官', role: '技术方向', gradient: 'linear-gradient(135deg,#8e44ad,#9b59b6)' , status: 'active', capabilities: ['技术方向', '研究方法', '工具选型', '技术风险']},
  { id: 'cmo', icon: '📢', shortName: 'CMO', name: '首席营销官', role: '学术影响', gradient: 'linear-gradient(135deg,#e74c3c,#c0392b)' , status: 'active', capabilities: ['投稿策略', '期刊选择', '学术影响', '成果推广']},
  { id: 'caio', icon: '🤖', shortName: 'CAIO', name: '首席AI官', role: 'AI策略', gradient: 'linear-gradient(135deg,#16a085,#1abc9c)' , status: 'active', capabilities: ['AI工具选型', '模型策略', '自动化方案', '智能体编排']},
  { id: 'cbo', icon: '🤝', shortName: 'CBO', name: '首席商务官', role: '产学研', gradient: 'linear-gradient(135deg,#d35400,#e67e22)' , status: 'active', capabilities: ['产学研合作', '专利转化', '商业化', '企业对接']},
  { id: 'cho', icon: '🎓', shortName: 'CHO', name: '首席人才官', role: '学生培养', gradient: 'linear-gradient(135deg,#2c3e50,#34495e)' , status: 'active', capabilities: ['学生培养', '梯队建设', '能力评估', '毕业跟踪']},
]
const tabAgentMap = {
  dashboard:'ceo', todo:'ceo', notify:'ceo', calendar:'ceo', projects:'cto',
  valuecycle:'ceo', knowledge:'caio', cockpit:'cho', meeting:'ceo',
  kanban:'cto', revision:'cmo', graduation:'cho', agents:'caio',
  ideas:'caio', skills:'cto', submissions:'cmo', review:'cmo',
  exam:'cho', teaching:'cho', course:'cho', invoice:'cfo',
  workload:'cho', interview:'cho', profile:'cho', dailybrief:'ceo',
}
const globalChatAgentId = ref('ceo')
const globalChatAgent = computed(() => cAgents.find(a => a.id === globalChatAgentId.value) || cAgents[0])
function autoSwitchAgent(tab) {
  const a = tabAgentMap[tab] || 'ceo'
  globalChatAgentId.value = a
}
    function selectCLevelAgent(id) {
      globalChatAgentId.value = id
      globalChatExpanded.value = true
      nextTick(() => {
        const el = document.querySelector('.global-chat-bar')
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      })
    }

// ===== Global Chat Bar =====
    const globalChatExpanded = ref(false)
function onChatMouseLeave() {
  // Don't collapse if user is typing in the chat input
  const active = document.activeElement;
  if (active && active.classList && active.classList.contains('global-chat-input')) return;
  globalChatExpanded.value = false;
}
    const globalChatMessages = ref([])
    const globalChatInput = ref('')
    const globalChatStreaming = ref(false)
    const globalChatEl = ref(null)

    async function sendGlobalChat() {
      const msg = globalChatInput.value.trim()
      if (!msg || globalChatStreaming.value) return
      globalChatInput.value = ''
      globalChatStreaming.value = true
      globalChatMessages.value.push({ role: 'user', content: msg })
      globalChatMessages.value.push({ role: 'assistant', content: '', _streaming: true })
      try {
        await streamChat('/api/global-chat', { message: msg, agent_id: globalChatAgentId.value }, (chunk) => {
          const last = globalChatMessages.value[globalChatMessages.value.length - 1]
          if (last && last.role === 'assistant' && last._streaming) {
            last.content += chunk
          }
        }, () => {
          const last = globalChatMessages.value[globalChatMessages.value.length - 1]
          if (last && last._streaming) delete last._streaming
        })
      } catch (e) {
        globalChatMessages.value.push({ role: 'assistant', content: 'Error: ' + e.message })
      }
      globalChatStreaming.value = false
      await nextTick()
      if (globalChatEl.value) globalChatEl.value.scrollTop = globalChatEl.value.scrollHeight
    }


    return {
      // Daily Brief + Goal Tree + Ideas
      dailyBrief, goalTree, ideaList, ideaInput, ideaStreaming, ideaStreamText,
      sharedIdeas, likeIdea, likedByMe, loadSharedIdeas,
      switchToDailyBrief, switchToIdeas, sparkIdeas,
      gradStudentId, gradSummary, switchToGraduation, loadGraduation, updateGradReq, updateGradNotes, seedGraduation,
      user, students, selectedStudentId, report, summary, chatMessages,
      // 价值链
      groupVc, alignments, selectedVcStudent, vcSaving,
      switchToValueCycle, loadGroupVc, loadAlignments, selectVcStudent, saveVcAssessment,
      // v2.1 W6a
      capabilityLabels, newDecision, saveGraduation, saveCapability, addDecision,
      decisionsList, decisionsStats, loadDecisions, deleteDecision, updateDecisionOutcome,
     chatInput, chatStreaming, loadingReport, reportHtml, chatMessagesEl,
     reportContext,
     onStudentChange, sendChat, logout,
     formatMessage, globalChatExpanded, globalChatMessages, globalChatInput, globalChatStreaming, globalChatEl, sendGlobalChat,
     cAgents, globalChatAgentId, globalChatAgent, autoSwitchAgent, selectCLevelAgent,
     switchToCockpit,
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
     switchToKanban,
      taskStatusPct, loadTasks, loadBoardStats, loadNews, tasksByStatus,
     isOverdue, openTaskModal, createTask, updateTaskStatus, deleteTask, promoteToKanban,
     taskDetail, showTaskDetail, taskDetailLoading, openTaskDetail, closeTaskDetail,
     // Phase 4: Promise Ledger
     promiseStats, consistencyData, overduePromises, upcomingPromises, showPromisePanel,
     // Phase 5: Student Profile
     profileFilter, profileList, profileLoading, profileDetail, showProfileDetail, profileDetailLoading,
     labProgress, filteredProfiles,
     switchToProfile, loadProfileList, openProfile, closeProfileDetail, loadLabProgress,
     loadPromiseData, fulfillPromiseAction,
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
     lessonHistory,
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
     // Agent + Calendar
     agents, switchToAgents,
      showAgentModal, newAgent, createAgent,
      agentSubTab, editAgent, deleteAgent, mcpConfig, mcpSaved, saveMcpConfig,
      kbFiles, kbLoading, kbPath, loadKbFiles,
      kbSearch, kbFilteredFiles, kbViewingFile, kbViewingFileName, kbFileContent, viewKbFile,
      // Knowledge Navigator
      // 会议 sub-tabs + STT
      meetingSubTab, sttRecording, sttTranscript, sttError, sttSummarizing,
      startSTT, stopSTT, sttSummarize,
      // ToDo
     todoItems, newTodoText, newTodoPriority, todoCount,
     switchToTodo, addTodo, toggleTodo,
     todayTasks, todayDateStr, todayWeekday, loadTodayTasks,
      // 通知
      emails, emailSyncing, unreadCount, switchToNotify, syncEmail,
      // 项目管理
      projectList, switchToProjects,
      // 修改
      revisionMessages, revisionInput, revisionStreaming, revisionStreamText,
      revisionDoc, switchToRevision, sendRevisionChat,
      // 审稿
      reviewInput, reviewStreaming, reviewStreamText,
      reviewOutput, reviewOutputHtml, switchToReview, runReview,
      // 考试/教学 sub-tabs
      examSubTab, teachingSubTab, examSubTabLabel, teachingSubTabLabel,
      switchToExam, switchToTeaching,
      // 团队动态
      teamFeed, todayMeetings, overdueCount,
      calendarMonth, calendarWeekdays, calendarEvents, calendarDays, calendarLabel,
      switchToCalendar, prevMonth, nextMonth,
      // 知识库
      kbSearchQuery, kbSearchResults, kbSemLoading, kbStats, kbDocuments,
      kbPage, kbTotalPages, kbShowDocs, kbRebuilding,
      switchToKnowledge, loadKbStats, loadKbDocuments, searchKb, rebuildKbIndex,
      kbNextPage, kbPrevPage,
      // 课程
      courseData, courseLoading, courseSubTab, switchToCourse, updateCourseWeek,
      // 全局AI底栏
      globalChatExpanded, globalChatMessages, globalChatInput,
      globalChatStreaming, globalChatEl, sendGlobalChat,
    }
  },
}).mount('#app')
