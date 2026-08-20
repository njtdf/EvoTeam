import { readFileSync, writeFileSync } from 'fs'

let s = readFileSync('public/js/student.js', 'utf8')

// ============================================================
// 1. Add brandName computed before roleLabel
// ============================================================
s = s.replace(
  `    const roleLabel = computed(() => {`,
  `    const brandName = computed(() => {
      if (!user.value) return 'EvoTeam'
      const map = { grad: 'AutoGrad', undergrad: 'AutoUngrad', teacher: 'AutoProf' }
      return map[user.value.role] || 'EvoTeam'
    })

    const roleLabel = computed(() => {`
)

// ============================================================
// 2. Add calendar + AI assistant + knowledge base sections
//    before onMounted
// ============================================================
s = s.replace(
  `   onMounted(async () => {`,
  `    // ===== 日历 (复用 teacher 端逻辑) =====
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

   onMounted(async () => {`
)

// ============================================================
// 3. Update validTabs to include new tabs
// ============================================================
s = s.replace(
  `    const validTabs = ['report', 'kanban', 'skills', 'interview']`,
  `    const validTabs = ['report', 'kanban', 'calendar', 'assistant', 'kb', 'skills', 'interview']`
)

// ============================================================
// 4. Add hash restoration for new tabs
// ============================================================
s = s.replace(
  `      if (hash === 'kanban') switchToKanban()`,
  `      if (hash === 'kanban') switchToKanban()
      else if (hash === 'calendar') switchToCalendar()
      else if (hash === 'assistant') switchToAssistant()
      else if (hash === 'kb') switchToKb()`
)

// ============================================================
// 5. Expand return block with all new refs/functions
// ============================================================
s = s.replace(
  `      // 面试练习
      interviewScenario, interviewTopic, interviewContext,
      interviewHistory, interviewAnswer, interviewStreaming, interviewStreamText,
      switchToInterview, startInterview, sendInterviewAnswer, sendInterviewCoach,
    }`,
  `      // 面试练习
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
      kbViewingFile, kbViewingFileName, kbFileContent,
      loadKb, viewKbFile, switchToKb,
    }`
)

writeFileSync('public/js/student.js', s)
console.log('student.js rebuilt successfully')
console.log('New size:', s.length, 'bytes')
