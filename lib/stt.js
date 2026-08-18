// stt.js - Feature 2 语音:实时 STT 桥接
// FunASR/SenseVoice (Python) 作为后端引擎;不可用时前端 fallback 到 Web Speech API
// Cordis-shaped: apply(ctx, config)

import { spawn } from 'child_process'

// --- 引擎状态 ---
let modelReady = false
let modelChecking = false

// --- 检查 FunASR 是否可用 ---
export function getStatus() {
  return {
    available: modelReady,
    engine: modelReady ? 'funasr-sensevoice' : 'none',
    fallback: 'web-speech-api',
    message: modelReady
      ? 'FunASR SenseVoice ready (GPU)'
      : 'FunASR not installed. Use Chrome Web Speech API fallback (browser-side).',
  }
}

// --- 尝试加载 FunASR 模型(惰性,首次 STT 请求时触发) ---
export async function ensureModel() {
  if (modelReady || modelChecking) return modelReady
  modelChecking = true

  try {
    // 通过 Python 子进程检查 funasr + torch.cuda
    const result = await runPythonCheck()
    if (result.funasr && result.cuda) {
      modelReady = true
      console.log('[stt] FunASR + CUDA ready')
    } else {
      console.log(`[stt] FunASR=${result.funasr}, CUDA=${result.cuda} — fallback to Web Speech API`)
    }
  } catch (e) {
    console.error('[stt] model check failed:', e.message)
  } finally {
    modelChecking = false
  }
  return modelReady
}

// --- Python 子进程检查 ---
function runPythonCheck() {
  return new Promise((resolve) => {
    const script = `
import json, sys
result = {"funasr": False, "cuda": False}
try:
    import torch
    result["cuda"] = torch.cuda.is_available()
except Exception:
    pass
try:
    import funasr
    result["funasr"] = True
except Exception:
    pass
print(json.dumps(result))
`
    const proc = spawn('python', ['-c', script], { timeout: 15000 })
    let stdout = ''
    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.on('close', () => {
      try {
        resolve(JSON.parse(stdout.trim()))
      } catch {
        resolve({ funasr: false, cuda: false })
      }
    })
    proc.on('error', () => resolve({ funasr: false, cuda: false }))
  })
}

// --- 会议会话状态(内存) ---
const sessions = new Map()

export function startMeetingSession(meetingId = 'default') {
  sessions.set(meetingId, {
    transcript: '',
    participants: [],
    startTime: new Date().toISOString(),
    chunks: [],
  })
  return sessions.get(meetingId)
}

export function endMeetingSession(meetingId = 'default') {
  const session = sessions.get(meetingId)
  sessions.delete(meetingId)
  return session
}

export function getTranscript(meetingId = 'default') {
  return sessions.get(meetingId)?.transcript || ''
}

export function appendTranscript(meetingId, text) {
  const session = sessions.get(meetingId)
  if (!session) return ''
  session.transcript += text + '\n'
  return session.transcript
}

// --- Cordis 形态 ---
export function apply(ctx, config = {}) {
  ctx.service('stt', {
    status: () => getStatus(),
    ensure: () => ensureModel(),
    start: (id) => startMeetingSession(id),
    end: (id) => endMeetingSession(id),
    transcript: (id) => getTranscript(id),
    append: (id, text) => appendTranscript(id, text),
  })
  ctx.on('ready', () => {
    ctx.logger?.info?.('stt plugin ready (Web Speech API fallback)')
  })
}

export default { getStatus, ensureModel, startMeetingSession, endMeetingSession, getTranscript, appendTranscript, apply }