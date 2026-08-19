// meeting-live.js - Feature 2 语音模式: 实时 STT + AI 抽取行动
// FunASR 不可用时降级到 Chrome/Edge Web Speech API (webkitSpeechRecognition)
const { createApp, ref, computed, onMounted } = Vue

createApp({
  setup() {
    const sttStatus = ref({ available: false, engine: 'none', fallback: 'web-speech-api' })
    const sttAvailable = computed(() => sttStatus.value.available)
    const recording = ref(false)
    const transcript = ref('')
    const interim = ref('')
    const extracting = ref(false)
    const actions = ref(null)
 const meetingDate = ref('')
 const pollCount = ref(0)
 const manualText = ref('')
 let recognition = null

    const statusText = computed(() => {
      if (extracting.value) return 'AI 抽取中 (' + pollCount.value + '/30)'
      if (recording.value) return '录音中'
      if (actions.value) return '已抽取 ' + (actions.value.actions?.length || 0) + ' 行动项'
      return '就绪'
    })

    onMounted(async () => {
      // 检查服务端 STT 引擎状态
      try {
        sttStatus.value = await api('/api/stt/status')
      } catch {}
      // 初始化 Web Speech API (降级路径)
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SR) {
        recognition = new SR()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'zh-CN'
        recognition.onresult = (e) => {
          let finalText = ''
          let interimText = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript
            if (e.results[i].isFinal) finalText += t
            else interimText += t
          }
          if (finalText) transcript.value += finalText
          interim.value = interimText
        }
        recognition.onerror = (e) => {
          if (e.error !== 'no-speech' && e.error !== 'aborted') {
            showToast('语音识别错误: ' + e.error)
          }
        }
        recognition.onend = () => {
          // 浏览器会自动断开,continuous 模式下重连
          if (recording.value) {
            try { recognition.start() } catch {}
          }
        }
      }
    })

    function startMeeting() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!sttAvailable.value && !SR) {
        showToast('请使用 Chrome/Edge 浏览器,或安装 FunASR')
        return
      }
      recording.value = true
      transcript.value = ''
      interim.value = ''
      actions.value = null
      meetingDate.value = new Date().toISOString().slice(0, 10)
      if (!sttAvailable.value && recognition) {
        try { recognition.start() } catch {}
      }
      showToast('会议录音已开始')
    }

    function stopMeeting() {
      recording.value = false
      interim.value = ''
      if (recognition) {
        try { recognition.stop() } catch {}
      }
      showToast('录音已结束,可点击 AI 抽取行动')
    }

   async function generateActions() {
      // Use transcript from STT, or fall back to manual text input
      // Merge STT transcript + manual text (manual text supplements STT)
      let content = transcript.value.trim()
      if (manualText.value.trim()) {
        content += (content ? '\n\n' : '') + manualText.value.trim()
      }
      if (!content) {
        showToast('无文本内容。请在下方手动输入会议纪要，再点击此按钮')
        return
      }
      extracting.value = true
      pollCount.value = 0
      actions.value = null
      const date = meetingDate.value || new Date().toISOString().slice(0, 10)
      meetingDate.value = date
      try {
        // 复用 Feature 2 文本管线: 上传纪要 → 异步 AI 抽取
        await api('/api/meeting/upload', {
          method: 'POST',
          body: JSON.stringify({ date, content }),
        })
        // 轮询直到 actions 就绪 (或检测到 error/no_api_key 状态)
        let attempts = 0
        let result = null
        while (attempts < 30) {
          await new Promise(r => setTimeout(r, 2000))
          pollCount.value = attempts + 1
          result = await api(`/api/meeting/${date}`)
          if (result.actions) break
          attempts++
        }
        if (result && result.actions) {
          // 标记 promoted 状态
          result.actions.actions = (result.actions.actions || []).map(a => ({ ...a, promoted: false }))
          actions.value = result.actions
          const cnt = result.actions.actions?.length || 0
          if (result.actions.status === 'error') {
            showToast('AI 抽取失败: ' + (result.actions.error || '未知错误'))
          } else if (result.actions.status === 'no_api_key') {
            showToast('未配置 DeepSeek API Key')
          } else {
            showToast('抽取完成: ' + cnt + ' 行动项')
          }
        } else {
          showToast('AI 抽取超时,请检查 .env API Key')
        }
      } catch (e) {
        showToast('抽取失败: ' + e.message)
      } finally {
        extracting.value = false
      }
    }

    async function promoteToKanban(action) {
      try {
        await api('/api/tasks/from-meeting', {
          method: 'POST',
          body: JSON.stringify({ date: meetingDate.value, task_id: action.task_id }),
        })
        action.promoted = true
        showToast('已推送到看板')
      } catch (e) {
        showToast('推送失败: ' + e.message)
      }
    }

    return {
      sttStatus, sttAvailable, recording, transcript, interim,
      extracting, actions, meetingDate, statusText, pollCount, manualText,
      startMeeting, stopMeeting, generateActions, promoteToKanban, logout,
    }
  },
}).mount('#app')
