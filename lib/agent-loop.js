// agent-loop.js - Waku-style agent loop (observe -> reason -> act -> repeat)
// ~70 lines of core logic. Pure function, no state, no classes.
// DeepSeek API supports function calling (tools parameter).

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

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

/**
 * Run the agent loop: observe -> reason -> act -> repeat
 * @param {object} opts
 * @param {string} opts.system - system prompt
 * @param {Array} opts.messages - initial messages [{role, content}]
 * @param {object} opts.tools - tool registry {name: {description, parameters, execute}}
 * @param {number} opts.maxIter - max iterations (default 5)
 * @param {function} opts.onChunk - (text) => void, called for each text chunk
 * @param {function} opts.onToolCall - (toolName, args, result) => void, called when a tool is executed
 * @returns {string} full text response
 */
export async function runAgentLoop({ system, messages, tools, maxIter = 5, onChunk = () => {}, onToolCall = () => {} }) {
  const apiKey = getApiKey()
  if (!apiKey) {
    const msg = '(AI 功能未配置 - 缺少 DEEPSEEK_API_KEY)'
    onChunk(msg)
    return msg
  }

  // Build tool definitions for DeepSeek API
  const toolDefs = Object.entries(tools).map(([name, t]) => ({
    type: 'function',
    function: {
      name,
      description: t.description,
      parameters: t.parameters,
    }
  }))

  // Working memory: messages array (mutable, like Waku)
  const workMessages = [
    { role: 'system', content: system },
    ...messages,
  ]

  for (let i = 0; i < maxIter; i++) {
    // 1. Reason: call LLM with tools
    const body = {
      model: 'deepseek-chat',
      messages: workMessages,
      tools: toolDefs.length > 0 ? toolDefs : undefined,
      temperature: 0.5,
      max_tokens: 3000,
    }

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
    const choice = data.choices?.[0]
    const message = choice?.message

    if (!message) {
      throw new Error('No message in response')
    }

    // 2. Guard: no tool calls -> reply to user
    const toolCalls = message.tool_calls || []
    if (toolCalls.length === 0) {
      const text = message.content || ''
      // Stream the final response (send as single chunk for simplicity)
      onChunk(text)
      return text
    }

    // 3. Act: execute tools, observe results
    // Add assistant message with tool calls
    workMessages.push({
      role: 'assistant',
      content: message.content || '',
      tool_calls: toolCalls,
    })

    for (const call of toolCalls) {
      const toolName = call.function.name
      const toolArgs = JSON.parse(call.function.arguments || '{}')
      const tool = tools[toolName]

      let result
      try {
        result = await tool.execute(toolArgs)
      } catch (e) {
        result = `Error executing ${toolName}: ${e.message}`
      }

      onToolCall(toolName, toolArgs, result)

      // Observe: feed tool result back to LLM
      workMessages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: typeof result === 'string' ? result : JSON.stringify(result),
      })
    }
    // 4. Repeat: loop back to step 1, LLM now sees tool results
  }

  // Guard: max iterations exceeded
  const msg = '(Agent 达到最大迭代次数，请重试或简化请求)'
  onChunk(msg)
  return msg
}

// Default export for Cordis-style apply (W3 compatibility, zero change now)
export function apply(ctx, config = {}) {
  const ns = config.namespace || 'agent-loop'
  if (ctx.reflect?.provide) ctx.reflect.provide(ns, { runAgentLoop })
  ctx.effect(() => () => {})
}

export default { runAgentLoop, apply }
