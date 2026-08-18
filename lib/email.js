// email.js - Feature 18: 邮箱→看板
// IMAP 读取未读邮件 → AI 抽取待办 → 创建看板任务
// Cordis-shaped: apply(ctx, config)

import { ImapFlow } from 'imapflow'
import { extractActions } from './ai.js'
import { createTask, getRoster } from './kanban.js'

// --- 配置(.env: IMAP_HOST / IMAP_USER / IMAP_PASS / IMAP_PORT) ---
function getConfig() {
  return {
    host: process.env.IMAP_HOST || '',
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    secure: parseInt(process.env.IMAP_PORT || '993', 10) === 993,
    auth: {
      user: process.env.IMAP_USER || '',
      pass: process.env.IMAP_PASS || '',
    },
  }
}

export function hasImapConfig() {
  const c = getConfig()
  return !!(c.host && c.auth.user && c.auth.pass)
}

// --- 从原始邮件源提取纯文本 ---
function extractPlainText(rawSource) {
  if (!rawSource) return ''
  const text = typeof rawSource === 'string' ? rawSource : rawSource.toString('utf-8')

  // 尝试找 text/plain 部分
  const plainMatch = text.match(/Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n\.)/i)
  if (plainMatch) {
    return plainMatch[1].replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).trim()
  }

  // 兜底:去 HTML 标签 + 取前 3000 字符
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000)
}

// --- 连接 IMAP → 拉取未读邮件 ---
export async function fetchUnread(limit = 20) {
  if (!hasImapConfig()) return []
  const config = getConfig()
  const client = new ImapFlow({ ...config, logger: false })

  try {
    await client.connect()
  } catch (e) {
    console.error('[email] IMAP connect failed:', e.message)
    return []
  }

  try {
    const lock = await client.getMailboxLock('INBOX')
    const emails = []
    try {
      const uids = await client.search({ seen: false })
      if (!uids.length) return []

      // 取最近的 limit 封(UID 倒序)
      const recent = uids.slice(-limit).reverse()

      for (const uid of recent) {
        try {
          const msg = await client.fetchOne(uid, { envelope: true, source: true })
          if (!msg) continue
          const env = msg.envelope || {}
          const body = extractPlainText(msg.source)
          emails.push({
            uid: String(uid),
            subject: env.subject || '(no subject)',
            from: env.from?.[0]?.address || env.from?.[0]?.name || 'unknown',
            date: env.date || new Date().toISOString(),
            body: body.slice(0, 2000),
          })
        } catch (e) {
          console.error(`[email] fetch uid=${uid} failed:`, e.message)
        }
      }
      return emails
    } finally {
      lock.release()
    }
  } catch (e) {
    console.error('[email] fetch failed:', e.message)
    return []
  } finally {
    await client.logout().catch(() => {})
  }
}

// --- AI 抽取邮件中的待办 → 创建看板任务 ---
export async function createTasksFromEmails() {
  const emails = await fetchUnread()
  if (!emails.length) return { emails: [], tasks: [], status: 'no_emails' }

  const roster = getRoster()
  const tasks = []

  for (const email of emails) {
    // 构造 transcript:邮件作为"会议纪要"传给 extractActions
    const transcript = `邮件主题: ${email.subject}\n发件人: ${email.from}\n日期: ${email.date}\n\n${email.body}`

    const result = await extractActions(transcript, roster)
    if (result.status === 'no_api_key') continue

    for (const action of (result.actions || [])) {
      const task = createTask({
        title: action.task || email.subject,
        description: action.context || `From: ${email.from}`,
        owner_name: action.owner_name || '',
        deadline: action.deadline || '',
        source: 'email',
        source_ref: email.uid,
        priority: 'medium',
        status: 'todo',
      })
      tasks.push(task)
    }
  }

  return {
    emails: emails.map(e => ({ uid: e.uid, subject: e.subject, from: e.from, date: e.date })),
    tasks,
    status: tasks.length ? 'ok' : 'no_tasks_extracted',
  }
}

// --- Cordis 形态 ---
export function apply(ctx, config = {}) {
  ctx.service('email', {
    unread: (limit) => fetchUnread(limit),
    sync: () => createTasksFromEmails(),
    configured: () => hasImapConfig(),
  })
  ctx.on('ready', () => {
    ctx.logger?.info?.('email plugin ready')
  })
}

export default { fetchUnread, createTasksFromEmails, hasImapConfig, apply }