// ai.js - DeepSeek API client (OpenAI-compatible)
// Two functions: generateSummary (non-streaming JSON) and chatStream (SSE)

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

// Load API key from .env file or environment
function getApiKey() {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY
  const envPath = join(__dirname, '..', '.env')
  if (existsSync(envPath)) {
    const raw = readFileSync(envPath, 'utf-8')
    const match = raw.match(/DEEPSEEK_API_KEY\s*=\s*(.+)/)
    if (match) return match[1].trim()
  }
  return null
}

export function hasApiKey() {
  return !!getApiKey()
}

// Generate structured summary from a student report
// Returns: { summary, risks[], suggestions[] }
export async function generateSummary(report, context = '') {
  const apiKey = getApiKey()
  if (!apiKey) {
    return {
      summary: '(AI 功能未配置 - 缺少 DEEPSEEK_API_KEY)',
      risks: [],
      suggestions: [],
    }
  }

  const systemPrompt = `You are a research lab AI assistant. Analyze the student bi-weekly report and output a JSON object with three keys:
"summary": 1-2 sentence summary of what the student accomplished.
"risks": array of risk points (empty if none). Risk dimensions: progress stalled, direction drift, technical blocker, resource shortage, data quality issue.
"suggestions": array of 2-3 discussion questions for the advisor.
Output ONLY valid JSON, no markdown fences, no extra text.`
  const fullPrompt = context
    ? systemPrompt + '\n\n--- 学生价值链上下文(贯穿全局) ---\n' + context + '\n--- 上下文结束 ---\n\n分析时请结合上述上下文:学生的进展是否与其个人目标对齐?是否与课题组价值链对齐?任务和会议行动项是否在推进?判断 risks 时重点关注价值链不对齐的风险。'
    : systemPrompt


  const reportText = formatReportForAI(report)

  const body = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: fullPrompt },
      { role: 'user', content: reportText },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 800,
  }

  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`DeepSeek API error ${resp.status}: ${text}`)
    }
    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)
    return {
      summary: parsed.summary || '',
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    }
  } catch (e) {
    console.error('[ai.js] generateSummary error:', e.message)
    return {
      summary: `(AI 总结生成失败: ${e.message})`,
      risks: [],
      suggestions: [],
    }
  }
}

// Streaming chat via SSE callback
// messages: [{role, content}]
// onChunk: (text) => void, called for each text delta
// Returns: full text string
// === Feature 2: meeting minutes → action items ===
// transcript: full meeting MD; roster: [{id, name}]
// Returns: { decisions[], actions[{task,owner_name,deadline,context,source_section}], status }
export async function extractActions(transcript, roster) {
  const apiKey = getApiKey()
  if (!apiKey) {
    return { decisions: [], actions: [], status: 'no_api_key' }
  }

  const rosterList = (roster || []).map(r => `- ${r.name} (${r.id})`).join('\n')

  const systemPrompt = `你是科研组会 AI 助手。从会议纪要中抽取"决议"和"行动项"。

学生名单(行动项负责人 owner_name 必须从此名单按姓名精确指派;若纪要未明确指派或姓名不在名单,owner_name 留空字符串):
${rosterList}

输出 JSON 对象:
{
  "decisions": ["会议达成的决议,1-5条,每条一句话"],
  "actions": [
    {
      "task": "具体要做的事,动词开头",
      "owner_name": "负责人姓名,必须是名单内姓名的精确匹配,否则空字符串",
      "deadline": "截止日期 YYYY-MM-DD,不确定则空字符串",
      "context": "相关背景一句话",
      "source_section": "该行动项出自纪要的哪个议题或标题"
    }
  ]
}

规则:
1. 只抽取真正的行动项(谁要做什么),不抽取纯讨论或已完成事项
2. owner_name 必须是名单内姓名的精确匹配;不确定负责人时留空字符串,不要编造
3. deadline 不确定时留空字符串,不要编造日期
4. 输出纯 JSON,无 markdown 代码围栏,无额外文字`

  const body = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: transcript },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 2000,
  }

  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`DeepSeek API error ${resp.status}: ${text}`)
    }
    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)
    return {
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      status: 'ok',
    }
  } catch (e) {
    console.error('[ai.js] extractActions error:', e.message)
    return { decisions: [], actions: [], status: 'error', error: e.message }
  }
}

// ============================================================
// extractPromises: from meeting transcript, extract commitments
// Li Kaifu promise ledger: who promised what to whom by when
// ============================================================
export async function extractPromises(transcript, roster) {
  const apiKey = getApiKey()
  if (!apiKey) {
    return { promises: [], status: 'no_api_key' }
  }

  const rosterList = (roster || []).map(r => '- ' + r.name + ' (' + r.id + ')').join('\n')

  const systemPrompt = [
    'You are a promise extraction assistant for a research lab meeting.',
    'Extract every commitment made during the meeting: who promised what to whom by when.',
    '',
    'Student roster (promiser name MUST match exactly from this list, otherwise leave empty string):',
    rosterList,
    '',
    'Output JSON object:',
    '{',
    '  "promises": [',
    '    {',
    '      "promiser": "Name of person who made the promise, must match roster exactly",',
    '      "promise": "What they promised to do, verb-first",',
    '      "deadline": "Deadline YYYY-MM-DD, empty string if not mentioned",',
    '      "promisee": "Who the promise was made to, often the advisor, empty if unclear",',
    '      "source_section": "Which agenda item or heading this came from"',
    '    }',
    '  ]',
    '}',
    '',
    'Rules:',
    '1. Only extract real commitments (someone explicitly agreed to do something)',
    '2. promiser must be exact name from roster; if unclear leave empty string',
    '3. deadline must be YYYY-MM-DD; if not specified leave empty string',
    '4. Output pure JSON, no markdown fences, no extra text'
  ].join('\n')

  const body = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: transcript },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 2000,
  }

  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify(body),
    })
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error('DeepSeek API error ' + resp.status + ': ' + text)
    }
    const data = await resp.json()
    const c = data.choices?.[0]?.message?.content || '{}'
    const parsed = JSON.parse(c)
    return {
      promises: Array.isArray(parsed.promises) ? parsed.promises : [],
      status: 'ok',
    }
  } catch (e) {
    console.error('[ai.js] extractPromises error:', e.message)
    return { promises: [], status: 'error', error: e.message }
  }
}

export async function chatStream(messages, onChunk) {
  const apiKey = getApiKey()
  if (!apiKey) {
    const msg = '(AI 功能未配置 - 缺少 DEEPSEEK_API_KEY)'
    onChunk(msg)
    return msg
  }

  const body = {
    model: 'deepseek-chat',
    messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 2000,
  }

  let fullText = ''
  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`DeepSeek API error ${resp.status}: ${text}`)
    }

    // Parse SSE stream
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
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const jsonStr = trimmed.slice(6)
        if (jsonStr === '[DONE]') continue
        try {
          const chunk = JSON.parse(jsonStr)
          const delta = chunk.choices?.[0]?.delta?.content || ''
          if (delta) {
            fullText += delta
            onChunk(delta)
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
  } catch (e) {
    console.error('[ai.js] chatStream error:', e.message)
    const errMsg = `\n\n[Error: ${e.message}]`
    fullText += errMsg
    onChunk(errMsg)
  }

  return fullText
}

// Format a Report object into text for the AI
function formatReportForAI(report) {
  const meta = report.meta
  const lines = [
    `Student: ${meta.name} (ID: ${meta.student_id})`,
    `Project: ${meta.project}`,
    `Self-assessed status: ${meta.status}`,
    `Period: ${meta.period_start} ~ ${meta.period_end}`,
    '',
  ]
  for (const section of report.sections) {
    lines.push(`## ${section.heading}`)
    lines.push(section.content)
    lines.push('')
  }
  return lines.join('\n')
}

// Build chat context messages for a teacher conversation
export function buildChatMessages(report, summary, chatHistory, teacherMessage, context = '') {
  const systemPrompt = `You are a research lab AI assistant helping a professor evaluate student bi-weekly reports.
You have access to the student's latest report and AI-generated summary.
Answer questions, identify issues, suggest actions. Be concise and practical.
Write in Chinese unless the professor writes in English.`
  const fullSysPrompt = context
    ? systemPrompt + '\n\n--- 学生价值链上下文(贯穿全局) ---\n' + context + '\n--- 上下文结束 ---\n\n分析时请结合上述上下文回答导师的问题。判断学生进展时,请关注是否与个人价值和课题组价值链对齐。'
    : systemPrompt


  const reportContext = formatReportForAI(report)
  const summaryContext = summary
    ? `AI Summary:\n- Summary: ${summary.summary}\n- Risks: ${(summary.risks || []).join('; ')}\n- Suggestions: ${(summary.suggestions || []).join('; ')}`
    : '(No AI summary available)'

  const messages = [
    { role: 'system', content: `${fullSysPrompt}\n\n--- Student Report ---\n${reportContext}\n\n--- AI Summary ---\n${summaryContext}` },
  ]

  // Add chat history (last 50 messages)
  for (const msg of chatHistory) {
    messages.push({ role: msg.role, content: msg.content })
  }

  // Add new teacher message
  messages.push({ role: 'user', content: teacherMessage })

  return messages
}

// Extract memories from a chat conversation (for lib/memory.js)
// messages: [{role, content}]
// Returns: [{memory_type, content, importance}]
export async function extractMemories(messages) {
  const apiKey = getApiKey()
  if (!apiKey) return []

  const systemPrompt = `You are a memory extractor. Analyze the following conversation and extract information worth remembering long-term.
Output a JSON object: {"memories": [{"memory_type": "...", "content": "...", "importance": 1-10}]}
Memory types: decision, feedback, preference, progress_note, risk_alert
Only extract: decisions, advisor feedback, student preferences, progress milestones, risk warnings.
Ignore: greetings, temporary Q&A, repeated info.
Output ONLY valid JSON, no markdown fences.`

  const convoText = messages.map(m => m.role + ': ' + m.content).join('\n')

  const body = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: convoText },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 1000,
  }

  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify(body),
    })
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error('DeepSeek API error ' + resp.status + ': ' + text)
    }
    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || '{"memories":[]}'
    const parsed = JSON.parse(content)
    return Array.isArray(parsed.memories) ? parsed.memories : []
  } catch (e) {
    console.error('[ai.js] extractMemories error:', e.message)
    return []
  }
}
