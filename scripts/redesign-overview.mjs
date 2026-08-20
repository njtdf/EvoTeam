import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const htmlPath = join(__dirname, '..', 'public', 'teacher.html')
let html = readFileSync(htmlPath, 'utf8')

const oldStart = '  <!-- 总览: Knowledge Navigator -->'
const oldEnd = '  <!-- 周报 Cockpit Tab -->'

const startIdx = html.indexOf(oldStart)
const endIdx = html.indexOf(oldEnd)
if (startIdx === -1 || endIdx === -1) {
  console.error('Cannot find dashboard section markers')
  process.exit(1)
}

const newDashboard = `  <!-- 总览: Welcome + Knowledge Navigator -->
  <div v-if="activeTab==='dashboard'" class="kn-view">
    <!-- 欢迎栏: 日期 + 简要统计 -->
    <div class="kn-welcome-bar">
      <div class="kn-date-block">
        <div class="kn-date-day">{{ todayDateStr }}</div>
        <div class="kn-date-weekday">{{ todayWeekday }}</div>
      </div>
      <div class="kn-welcome-stats">
        <span class="stat-pill">✅ {{ todoCount }} 待办</span>
        <span class="stat-pill">🔔 {{ unreadCount }} 未读</span>
        <span class="stat-pill">👥 {{ dashboardData?.stats?.total || 0 }} 学生</span>
        <span class="stat-pill" :class="{missing: (dashboardData?.stats?.missing||0) > 0}">❌ {{ dashboardData?.stats?.missing || 0 }} 未交周报</span>
        <span class="stat-pill stat-overdue" v-if="overdueCount > 0">⚠ {{ overdueCount }} 逾期</span>
      </div>
    </div>

    <!-- 可滚动主区域 -->
    <div class="kn-scroll-area">

      <!-- 分区1: 今日任务 (compact) -->
      <div class="kn-section" v-if="!activeAgentId">
        <div class="kn-section-label">📋 今日任务</div>
        <div class="kn-todo-mini">
          <div v-for="t in todayTasks.slice(0,5)" :key="t.task_id" class="kn-todo-row" @click="toggleTodo(t)">
            <span class="kn-todo-check" :class="{done: t.status==='done'}">{{ t.status === 'done' ? '✓' : '○' }}</span>
            <span class="kn-todo-prio" :class="'prio-' + (t.priority || 'medium')"></span>
            <span class="kn-todo-text" :class="{done: t.status==='done'}">{{ t.title }}</span>
            <span class="kn-todo-owner" v-if="t.owner_name">{{ t.owner_name }}</span>
          </div>
          <div v-if="todayTasks.length===0" class="kn-todo-empty">今日无待办 — 喝杯咖啡 ☕</div>
        </div>
      </div>

      <!-- 分区2: Agent 网格 -->
      <div class="kn-section">
        <div class="kn-section-label">🤖 Agent 团队 — 点击对话</div>
        <div class="agent-grid">
          <div v-for="a in agents" :key="a.id"
               class="agent-avatar-card" :class="{selected: activeAgentId===a.id}"
               @click="selectAgent(a.id)">
            <div class="agent-avatar" :class="'avatar-' + a.color"
                 :style="a.gradient ? {background: a.gradient} : {}">
              <span class="agent-emoji">{{ a.icon }}</span>
              <span class="agent-status-dot" :class="'dot-' + a.status"></span>
            </div>
            <div class="agent-avatar-name">{{ a.shortName || a.name }}</div>
            <div class="agent-avatar-role">{{ a.role }}</div>
          </div>
        </div>
      </div>

      <!-- Agent 对话面板 -->
      <div v-if="activeAgentId" class="agent-chat-panel">
        <div class="agent-chat-header">
          <span class="agent-chat-title">{{ activeAgent.icon }} {{ activeAgent.name }}</span>
          <span class="agent-chat-desc">{{ activeAgent.description }}</span>
          <button class="btn btn-sm btn-secondary" @click="activeAgentId=null">✕ 关闭</button>
        </div>
        <div class="chat-messages agent-chat-messages" ref="agentChatEl">
          <div v-if="agentChatMessages.length === 0" class="text-muted text-center" style="padding:30px">
            与 {{ activeAgent.name }} 对话 — {{ activeAgent.description }}
          </div>
          <div v-for="(msg, i) in agentChatMessages" :key="i"
               class="chat-bubble" :class="msg.role">
            <div v-html="formatMessage(msg.content)"></div>
          </div>
          <div v-if="agentStreaming" class="chat-bubble ai">
            <span class="streaming-cursor">{{ agentStreamText }}</span><span class="cursor-blink">▍</span>
          </div>
        </div>
        <div class="chat-input-row">
          <textarea class="chat-input" v-model="agentChatInput"
            @keydown.enter.exact.prevent="sendAgentChat"
            :placeholder="'向 ' + (activeAgent?.shortName || activeAgent?.name) + ' 提问...'">
          </textarea>
          <button class="btn btn-primary btn-sm" :disabled="agentStreaming" @click="sendAgentChat">
            {{ agentStreaming ? '...' : '发送' }}
          </button>
        </div>
      </div>

      <!-- 分区3: 团队动态 -->
      <div class="kn-section" v-if="!activeAgentId">
        <div class="kn-section-label">📡 团队动态</div>
        <div class="kn-feed-mini">
          <div class="kn-feed-row" v-for="f in teamFeed" :key="f.time + f.text">
            <span class="feed-icon">{{ f.icon }}</span>
            <span class="feed-text">{{ f.text }}</span>
            <span class="feed-time" v-if="f.time">{{ f.time }}</span>
          </div>
          <div v-if="teamFeed.length===0" class="kn-todo-empty">暂无动态</div>
        </div>
      </div>

    </div>
  </div>

`

html = html.slice(0, startIdx) + newDashboard + html.slice(endIdx)
writeFileSync(htmlPath, html, 'utf8')
console.log('Overview redesigned. KB widget removed. Welcome bar + scroll area added.')
console.log('New size:', html.length, 'bytes')
