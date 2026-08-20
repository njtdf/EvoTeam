// api.js - Shared API client for AutoProf frontend

// Version auto-reload: detects stale cached JS and forces reload
const APP_VERSION = '0.6.0'

async function checkVersion() {
  try {
    const resp = await fetch('/api/version', { credentials: 'same-origin' })
    const data = await resp.json()
    if (data.version && data.version !== APP_VERSION) {
      console.warn(`Version mismatch: server=${data.version} client=${APP_VERSION}, reloading...`)
      // Force reload bypassing cache
      window.location.reload()
    }
  } catch (e) {
    // Non-critical, don't block the page
  }
}

// Run version check on load
checkVersion()

async function api(path, options = {}) {
  const resp = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'same-origin',
  })
  const data = await resp.json().catch(() => ({ error: 'Network error' }))
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`)
  return data
}

// SSE stream reader for chat
async function streamChat(url, body, onChunk, onDone, onError) {
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    })

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${resp.status}`)
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        try {
          const msg = JSON.parse(trimmed.slice(6))
          if (msg.chunk) onChunk(msg.chunk)
          if (msg.done) onDone()
          if (msg.error) onError(msg.error)
        } catch {}
      }
    }
  } catch (e) {
    onError(e.message)
  }
}

function showToast(msg, duration = 3000) {
  const existing = document.querySelector('.toast')
  if (existing) existing.remove()
  const toast = document.createElement('div')
  toast.className = 'toast fade-in'
  toast.textContent = msg
  document.body.appendChild(toast)
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300) }, duration)
}

// Get current user info
async function getMe() {
  try {
    const data = await api('/api/me')
    return data.user
  } catch {
    return null
  }
}

// Logout and redirect
async function logout() {
  await api('/api/logout', { method: 'POST' })
  window.location.href = '/login'
}

// Export for other modules
window.APP_VERSION = APP_VERSION
