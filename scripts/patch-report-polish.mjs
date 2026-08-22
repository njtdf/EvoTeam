import { readFileSync, writeFileSync } from 'fs'

const R = 'D:/OneDrive/7-SideWork/AutoProf/cordis-main'
const rd = p => readFileSync(`${R}/${p}`, 'utf-8')
const wr = (p, t) => writeFileSync(`${R}/${p}`, t, 'utf-8')

// Helper: replace first occurrence
function rep(text, find, repl) {
  if (!text.includes(find)) { console.log(`  WARN not found: ${find.slice(0,50)}`); return text }
  return text.replace(find, repl)
}

// ============================================================
// 1. server.js — Add /api/reports/:id list endpoint
// ============================================================
function patchServer() {
  let t = rd('server.js')
  const old = '  res.json({ report })\n})\n\n// --- API: Submit ---'
  const neu = [
    '  res.json({ report })',
    '})',
    '',
    '// --- API: List all reports for a student ---',
    "app.get('/api/reports/:id', requireAuth, (req, res) => {",
    '  const config = loadConfig()',
    '  const reportsDir = join(__dirname, config.reports_dir)',
    '  const files = scanReportFiles(reportsDir, req.params.id)',
    '  const list = files.reverse().map(f => {',
    '    const report = parseReport(f)',
    "    const body = (report.raw || '').replace(/^---[\\s\\S]*?---/, '').trim()",
    '    return {',
    "      filename: f.split(/[\\\\/]/).pop(),",
    "      period_start: report.meta?.period_start || '',",
    "      period_end: report.meta?.period_end || '',",
    "      submitted_at: report.meta?.submitted_at || '',",
    "      status: report.meta?.status || 'on_track',",
    '      excerpt: body.slice(0, 150),',
    '    }',
    '  })',
    '  res.json({ reports: list })',
    '})',
    '',
    '// --- API: Submit ---',
  ].join('\n')
  if (t.includes(old)) { t = t.replace(old, neu); wr('server.js', t); console.log('OK server.js') }
  else console.log('SKIP server.js')
}

// ============================================================
// 2. student.js — Chinese template + toasts + history functions
// ============================================================
function patchStudentJs() {
  let t = rd('public/js/student.js')

  // --- Chinese template sections ---
  t = rep(t, 'title: "Bi-Weekly Report"', 'title: "\u53cc\u5468\u62a5"')
  t = rep(t, '## 1. Progress', '## 1. \u672c\u5468\u8fdb\u5c55')
  t = rep(t, '## 2. Comments and Concerns', '## 2. \u95ee\u9898\u4e0e\u56f0\u96be')
  t = rep(t, '## 3. Activities', '## 3. \u672c\u5468\u6d3b\u52a8')
  t = rep(t, '## 4. Work Planned Next Two Weeks', '## 4. \u4e0b\u4e24\u5468\u8ba1\u5212')
  t = rep(t, '## 5. Service Work Done', '## 5. \u670d\u52a1\u5de5\u4f5c')
  t = rep(t, '## 6. Attachments', '## 6. \u9644\u4ef6')
  t = rep(t, '- (none)', '- (\u65e0)')

  // --- Chinese toast messages ---
  t = rep(t, "'Report is empty'", "'\u5468\u62a5\u5185\u5bb9\u4e0d\u80fd\u4e3a\u7a7a'")
  t = rep(t, "'Report submitted! AI is generating summary...'", "'\u63d0\u4ea4\u6210\u529f\uff01AI \u6b63\u5728\u751f\u6210\u603b\u7ed3...'")
  t = rep(t, "'No Codex history found. Using template.'", "'\u672a\u627e\u5230 Codex \u5386\u53f2\uff0c\u4f7f\u7528\u6a21\u677f\u3002'")
  t = rep(t, "'No API key. Using template.'", "'\u672a\u914d\u7f6e API key\uff0c\u4f7f\u7528\u6a21\u677f\u3002'")
  t = rep(t, '`Draft generated from ${data.excerpts_found} Codex sessions.`', '`AI \u8349\u7a3f\u5df2\u751f\u6210\uff08\u57fa\u4e8e ${data.excerpts_found} \u6761 Codex \u5386\u53f2\uff09`')
  t = rep(t, "'AI summary taking too long. Check back later.'", "'AI \u603b\u7ed3\u751f\u6210\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u67e5\u770b\u3002'")

  // --- Add new refs after showActions ref ---
  t = rep(t,
    "const actionsLoading = ref(false)",
    "const actionsLoading = ref(false)\n  // --- \u5468\u62a5\u5386\u53f2 ---\n  const reportHistory = ref([])\n  const showHistory = ref(false)\n  const historyViewReport = ref(null) // {raw, meta} or null"
  )

  // --- Add history functions before onMounted ---
  // Find a marker to insert before
  const histFuncs = [
    '',
    '    // ===== \u5468\u62a5\u5386\u53f2 =====',
    '    async function loadReportHistory() {',
    '      try {',
    '        const data = await api(`/api/reports/${user.value.id}`)',
    '        reportHistory.value = data.reports || []',
    '      } catch (e) { console.error(\u0027report history load failed:\u0027, e.message) }',
    '    }',
    '',
    '    function toggleHistory() {',
    '      if (showHistory.value) { showHistory.value = false; return }',
    '      loadReportHistory(); showHistory.value = true',
    '    }',
    '',
    '    async function viewHistoryReport(filename) {',
    '      try {',
    '        const data = await api(`/api/report/${user.value.id}?file=${encodeURIComponent(filename)}`)',
    '        historyViewReport.value = data.report',
    '      } catch (e) { showToast(\u0027\u52a0\u8f7d\u5386\u53f2\u5468\u62a5\u5931\u8d25: \u0027 + e.message) }',
    '    }',
    '',
    '    function closeHistoryView() { historyViewReport.value = null }',
    '',
    '    function startNewReport() {',
    '      historyViewReport.value = null',
    '      showHistory.value = false',
    '      loadTemplate()',
    '    }',
    '',
  ].join('\n')

  // Insert before onMounted
  t = rep(t, '   onMounted(async () => {', histFuncs + '   onMounted(async () => {')

  // --- Load report history in onMounted ---
  t = rep(t,
    '    loadReportContext(u.id)\n    loadMyVc()',
    '    loadReportContext(u.id)\n    loadMyVc()\n    loadReportHistory()'
  )

  // --- Add to return block ---
  // Find the return block and add new exports
  t = rep(t,
    'reportContext, showFeedback, loadReportContext, toggleFeedback,',
    'reportHistory, showHistory, historyViewReport,\n    loadReportHistory, toggleHistory, viewHistoryReport, closeHistoryView, startNewReport,\n    reportContext, showFeedback, loadReportContext, toggleFeedback,'
  )

  wr('public/js/student.js', t)
  console.log('OK student.js')
}

// ============================================================
// 3. student.html — New toolbar + history + fix summary card
// ============================================================
function patchStudentHtml() {
  let t = rd('public/student.html')

  // --- Replace toolbar ---
  const oldToolbar = `    <div style="padding:12px; display:flex; gap:8px; align-items:center;">
      <button class="btn btn-secondary btn-sm" @click="loadTemplate">\u6a21\u677f</button>
      <button class="btn btn-secondary btn-sm" @click="clearEditor">\u6e05\u7a7a</button>
      <button class="btn btn-secondary btn-sm" @click="toggleActions">\u6211\u7684\u4f1a\u8bae\u884c\u52a8<span v-if="myActions.length"> ({{ myActions.length }})</span></button>
      <button class="btn btn-secondary btn-sm" @click="toggleFeedback">\u4e0a\u6b21\u53cd\u9988<span v-if="reportContext"> ({{ (reportContext.open_tasks?.length||0) + (reportContext.meeting_actions?.length||0) }})</span></button>
      <button class="btn btn-primary btn-sm" :disabled="draftLoading" @click="generateDraft">
        {{ draftLoading ? 'AI \u751f\u6210\u4e2d...' : '\ud83e\udd16 AI \u8f85\u52a9\u586b\u5199' }}
      </button>
      <span class="spacer" style="flex:1"></span>
      <button class="btn btn-primary btn-sm" :disabled="submitting" @click="doSubmit">
        {{ submitting ? '\u63d0\u4ea4\u4e2d...' : '\u63d0\u4ea4\u5468\u62a5' }}
      </button>
    </div>`

  const newToolbar = `    <div class="report-toolbar">
      <div class="report-toolbar-left">
        <button class="btn btn-primary" @click="startNewReport">
          \u270f\ufe0f {{ markdown ? '\u7ee7\u7eed\u7f16\u8f91' : '\u5199\u5468\u62a5' }}
        </button>
        <button class="btn btn-secondary btn-sm" @click="toggleHistory">
          \ud83d\udccb \u5386\u53f2\u5468\u62a5<span v-if="reportHistory.length"> ({{ reportHistory.length }})</span>
        </button>
        <button class="btn btn-secondary btn-sm" @click="toggleFeedback">\u4e0a\u6b21\u53cd\u9988<span v-if="reportContext"> ({{ (reportContext.open_tasks?.length||0) + (reportContext.meeting_actions?.length||0) }})</span></button>
        <button class="btn btn-secondary btn-sm" @click="toggleActions">\u4f1a\u8bae\u884c\u52a8<span v-if="myActions.length"> ({{ myActions.length }})</span></button>
      </div>
      <div class="report-toolbar-right">
        <button class="btn btn-secondary btn-sm" :disabled="draftLoading" @click="generateDraft">
          {{ draftLoading ? 'AI \u751f\u6210\u4e2d...' : '\ud83e\udd16 AI \u8349\u7a3f' }}
        </button>
        <button class="btn btn-secondary btn-sm" @click="clearEditor">\u6e05\u7a7a</button>
        <button class="btn btn-success" :disabled="submitting" @click="doSubmit">
          {{ submitting ? '\u63d0\u4ea4\u4e2d...' : '\ud83d\udce4 \u63d0\u4ea4' }}
        </button>
      </div>
    </div>`

  t = rep(t, oldToolbar, newToolbar)

  // --- Insert history panel before split-pane ---
  const historyPanel = `    <!-- \u5468\u62a5\u5386\u53f2\u5217\u8868 -->
    <div v-if="showHistory && !historyViewReport" class="card" style="margin:0 12px 12px">
      <div class="card-title">\ud83d\udccb \u5468\u62a5\u5386\u53f2 <span class="tag" v-if="reportHistory.length">{{ reportHistory.length }}</span></div>
      <div v-if="reportHistory.length === 0" class="empty-state" style="padding:16px">\u8fd8\u6ca1\u6709\u5386\u53f2\u5468\u62a5\uff0c\u5199\u5b8c\u63d0\u4ea4\u540e\u4f1a\u663e\u793a\u5728\u8fd9\u91cc\u3002</div>
      <div v-else class="report-history-list">
        <div v-for="r in reportHistory" :key="r.filename" class="report-history-item" @click="viewHistoryReport(r.filename)">
          <div class="rh-left">
            <span class="rh-filename mono">{{ r.filename }}</span>
            <span class="rh-period text-muted" v-if="r.period_start">{{ r.period_start }} ~ {{ r.period_end }}</span>
          </div>
          <div class="rh-right">
            <span class="tag" :class="'tag-' + (r.status || 'on_track').replace('_','-')">{{ r.status }}</span>
          </div>
          <div class="rh-excerpt" v-if="r.excerpt">{{ r.excerpt }}</div>
        </div>
      </div>
    </div>
    <!-- \u5386\u53f2\u5468\u62a5\u67e5\u770b -->
    <div v-if="historyViewReport" class="card" style="margin:0 12px 12px">
      <div class="card-title">
        \ud83d\udccd {{ historyViewReport.meta?.name || '' }} - {{ historyViewReport.file_path?.split(/[\\\\/]/).pop() || '' }}
        <button class="btn btn-secondary btn-sm" style="float:right" @click="closeHistoryView">\u8fd4\u56de</button>
      </div>
      <div class="md-preview" v-html="formatHistoryReport()"></div>
    </div>`

  // Insert before split-pane
  t = rep(t, '    <div class="split-pane" style="height:calc(100vh - 100px)">', historyPanel + '\n    <div class="split-pane" style="height:calc(100vh - 100px)" v-if="!historyViewReport && !showHistory">')

  // --- Fix summary card: remove position:fixed ---
  t = rep(t,
    'style="position:fixed; bottom:0; left:0; right:0; max-height:40%; overflow-y:auto; z-index:200"',
    'style="margin:0 12px 12px; max-height:300px; overflow-y:auto"'
  )

  wr('public/student.html', t)
  console.log('OK student.html')
}

// ============================================================
// 4. teacher.html — Remove duplicate AI Summary title
// ============================================================
function patchTeacherHtml() {
  let t = rd('public/teacher.html')
  // Remove the duplicate English "AI Summary" title line
  t = rep(t, '         <div class="card-title">AI Summary</div>\n           <div class="card-title">\ud83d\udcca AI \u603b\u7ed3</div>', '           <div class="card-title">\ud83d\udcca AI \u603b\u7ed3</div>')
  wr('public/teacher.html', t)
  console.log('OK teacher.html')
}

// ============================================================
// 5. app.css — Fix student-select + add new styles
// ============================================================
function patchCss() {
  let t = rd('public/css/app.css')

  // Fix student-select: ensure visible in all contexts
  t = rep(t,
    '.student-select {\n  padding: 6px 12px;\n  border: 1px solid var(--border);\n  border-radius: 4px;\n  font-size: 13px;\n  background: var(--card);\n  color: var(--text);\n  cursor: pointer;\n  outline: none;\n}',
    '.student-select {\n  padding: 6px 12px;\n  border: 1px solid #d1d5db;\n  border-radius: 4px;\n  font-size: 13px;\n  background: #fff;\n  color: #1f2937;\n  cursor: pointer;\n  outline: none;\n  font-weight: 500;\n}\n.student-select:focus {\n  border-color: var(--primary);\n  box-shadow: 0 0 0 2px rgba(7,193,96,0.15);\n}'
  )

  // Add new styles at end of file
  const newCss = `
/* === Report Polish (v0.7.20) === */
.report-toolbar {
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--border-light);
  flex-wrap: wrap;
}
.report-toolbar-left, .report-toolbar-right {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.btn-success {
  background: var(--primary);
  color: #fff;
  border: none;
}
.btn-success:hover { background: var(--primary-dark); }
.report-history-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 400px;
  overflow-y: auto;
}
.report-history-item {
  padding: 10px 12px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  cursor: pointer;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px;
  transition: border-color 0.15s;
}
.report-history-item:hover {
  border-color: var(--primary);
  background: var(--primary-light);
}
.rh-left { display: flex; gap: 8px; align-items: center; }
.rh-filename { font-weight: 600; font-size: 13px; }
.rh-period { font-size: 11px; }
.rh-excerpt {
  grid-column: 1 / -1;
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}`
  t = t + newCss
  wr('public/css/app.css', t)
  console.log('OK app.css')
}

// ============================================================
// Run all patches
// ============================================================
patchServer()
patchStudentJs()
patchStudentHtml()
patchTeacherHtml()
patchCss()
console.log('\nAll patches done.')
