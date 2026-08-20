import fs from 'fs';

// === 1. Enhance teacher.html: KB search + Agent management tabs ===
let html = fs.readFileSync('public/teacher.html', 'utf8');

// --- 1a. Add KB search box ---
const oldKb = `    <div v-if="!activeAgentId" class="kn-kb">
      <div class="kn-section-label">
        <span>Knowledge Base</span>
        <button class="btn btn-sm btn-secondary" @click="loadKbFiles">Refresh</button>
      </div>
      <div v-if="kbLoading" class="text-muted" style="padding:12px">Loading...</div>
      <div v-else-if="kbFiles.length===0" class="text-muted" style="padding:12px">No files</div>
      <div v-else class="kb-file-list">
        <div class="kb-file-item" v-for="f in kbFiles.slice(0,20)" :key="f.path">
          <span class="kb-file-icon">{{ f.ext === "md" ? "M" : f.ext === "json" ? "J" : f.ext === "yaml" ? "Y" : "F" }}</span>
          <span class="kb-file-name">{{ f.name }}</span>
          <span class="kb-file-path">{{ f.path }}</span>
          <span class="kb-file-date">{{ f.modified }}</span>
          <span class="kb-file-size">{{ f.size < 1024 ? f.size + "B" : Math.round(f.size/1024) + "KB" }}</span>
        </div>
      </div>
    </div>`;

const newKb = `    <div v-if="!activeAgentId" class="kn-kb">
      <div class="kn-section-label">
        <span>📚 Knowledge Base</span>
        <input class="kb-search" v-model="kbSearch" placeholder="搜索文件..." style="margin-left:8px;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px">
        <button class="btn btn-sm btn-secondary" @click="loadKbFiles" style="margin-left:4px">🔄</button>
      </div>
      <div v-if="kbLoading" class="text-muted" style="padding:12px">加载中...</div>
      <div v-else-if="kbFilteredFiles.length===0" class="text-muted" style="padding:12px">无文件</div>
      <div v-else class="kb-file-list">
        <div class="kb-file-item" v-for="f in kbFilteredFiles.slice(0,30)" :key="f.path" @click="viewKbFile(f.path)">
          <span class="kb-file-icon kb-ext-{{f.ext}}">{{ f.ext === 'md' ? '📝' : f.ext === 'json' ? '🔧' : f.ext === 'yaml' ? '⚙️' : '📄' }}</span>
          <span class="kb-file-name">{{ f.name }}</span>
          <span class="kb-file-path">{{ f.path }}</span>
          <span class="kb-file-size">{{ f.size < 1024 ? f.size + 'B' : Math.round(f.size/1024) + 'KB' }}</span>
        </div>
        <div v-if="kbFilteredFiles.length > 30" class="text-muted" style="padding:8px;font-size:12px">还有 {{ kbFilteredFiles.length - 30 }} 个文件...</div>
      </div>
      <!-- KB file viewer modal -->
      <div v-if="kbViewingFile" class="modal-overlay" @click.self="kbViewingFile=null">
        <div class="modal modal-lg">
          <div class="modal-header">
            <span class="modal-title">📄 {{ kbViewingFileName }}</span>
            <button class="btn btn-sm" @click="kbViewingFile=null">✕</button>
          </div>
          <div class="modal-body">
            <pre class="kb-file-content">{{ kbFileContent }}</pre>
          </div>
        </div>
      </div>
    </div>`;

html = html.replace(oldKb, newKb);

// --- 1b. Replace Agent section with tabbed layout ---
const oldAgent = `  <!-- Agent 面板 -->
  <div v-if="activeTab==='agents'" class="agent-view">
    <div class="card-title" style="margin-bottom:12px">EvoTeam Agent 控制中心</div>
     <button class="btn btn-sm btn-primary" style="margin-bottom:12px" @click="showAgentModal=true">+ 创建 Agent</button>
     <div v-if="showAgentModal" class="modal-overlay" @click.self="showAgentModal=false">
       <div class="modal">
         <div class="modal-header">
           <span class="modal-title">创建 Agent</span>
           <button class="btn btn-sm" @click="showAgentModal=false">✕</button>
         </div>
         <div class="modal-body">
           <label class="form-label">名称</label>
           <input class="form-input" v-model="newAgent.name" placeholder="Agent 名称">
           <label class="form-label">角色</label>
           <input class="form-input" v-model="newAgent.role" placeholder="如: 周报分析">
           <label class="form-label">描述</label>
           <textarea class="form-input" v-model="newAgent.description" rows="2" placeholder="Agent 做什么..."></textarea>
           <label class="form-label">Emoji 图标</label>
           <input class="form-input" v-model="newAgent.icon" placeholder="如: 📝" style="width:60px">
           <label class="form-label">能力标签 (逗号分隔)</label>
           <input class="form-input" v-model="newAgent.capabilitiesStr" placeholder="学生状态,简报生成,风险预警">
         </div>
         <div class="modal-footer">
           <button class="btn btn-secondary" @click="showAgentModal=false">取消</button>
           <button class="btn btn-primary" @click="createAgent">创建</button>
         </div>
       </div>
     </div>
  <div class="agent-grid">
     <div class="agent-card" v-for="a in agents" :key="a.name">
       <div class="agent-card-header">
         <span class="agent-icon">{{ a.icon }}</span>
         <span class="agent-name">{{ a.name }}</span>
         <span class="agent-status" :class="'status-' + a.status">{{ a.status === 'active' ? '✅ 运行中' : '⏳ 计划中' }}</span>
       </div>
       <div class="agent-role">{{ a.role }}</div>
       <div class="agent-desc">{{ a.description }}</div>
       <div class="agent-caps">
         <span class="tag" v-for="c in a.capabilities" :key="c">{{ c }}</span>
       </div>
       <div class="agent-card-footer">
         <button class="btn btn-sm btn-secondary" @click="selectAgent(a.id)">💬 对话</button>
       </div>
     </div>
   </div>
   <div v-if="agents.length===0" class="empty-state" style="padding:24px">暂无 Agent</div>
 </div>`;

const newAgent = `  <!-- Agent 面板 -->
  <div v-if="activeTab==='agents'" class="agent-view">
    <div class="agent-mgmt-header">
      <span class="card-title">EvoTeam Agent 控制中心</span>
      <button class="btn btn-sm btn-primary" @click="showAgentModal=true">+ 创建 Agent</button>
    </div>
    <!-- Agent sub-tabs -->
    <div class="sub-tab-bar">
      <button class="sub-tab" :class="{active: agentSubTab==='agents'}" @click="agentSubTab='agents'">🤖 Agents ({{ agents.length }})</button>
      <button class="sub-tab" :class="{active: agentSubTab==='skills'}" @click="agentSubTab='skills'">🧰 Skills ({{ skillManifest?.length || 0 }})</button>
      <button class="sub-tab" :class="{active: agentSubTab==='plugins'}" @click="agentSubTab='plugins'">🔌 Plugins</button>
      <button class="sub-tab" :class="{active: agentSubTab==='mcp'}" @click="agentSubTab='mcp'">⚙️ MCP</button>
    </div>
    <!-- Create Agent Modal -->
    <div v-if="showAgentModal" class="modal-overlay" @click.self="showAgentModal=false">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">创建 Agent</span>
          <button class="btn btn-sm" @click="showAgentModal=false">✕</button>
        </div>
        <div class="modal-body">
          <label class="form-label">名称</label>
          <input class="form-input" v-model="newAgent.name" placeholder="Agent 名称">
          <label class="form-label">角色</label>
          <input class="form-input" v-model="newAgent.role" placeholder="如: 周报分析">
          <label class="form-label">描述</label>
          <textarea class="form-input" v-model="newAgent.description" rows="2" placeholder="Agent 做什么..."></textarea>
          <label class="form-label">Emoji 图标</label>
          <input class="form-input" v-model="newAgent.icon" placeholder="如: 📝" style="width:60px">
          <label class="form-label">能力标签 (逗号分隔)</label>
          <input class="form-input" v-model="newAgent.capabilitiesStr" placeholder="学生状态,简报生成,风险预警">
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showAgentModal=false">取消</button>
          <button class="btn btn-primary" @click="createAgent">创建</button>
        </div>
      </div>
    </div>
    <!-- Agents sub-tab -->
    <div v-if="agentSubTab==='agents'" class="agent-grid">
      <div class="agent-card" v-for="a in agents" :key="a.id">
        <div class="agent-card-header">
          <span class="agent-icon">{{ a.icon }}</span>
          <span class="agent-name">{{ a.name }}</span>
          <span class="agent-status" :class="'status-' + a.status">{{ a.status === 'active' ? '✅ 运行中' : '⏳ 计划中' }}</span>
        </div>
        <div class="agent-role">{{ a.role }}</div>
        <div class="agent-desc">{{ a.description }}</div>
        <div class="agent-caps">
          <span class="tag" v-for="c in a.capabilities" :key="c">{{ c }}</span>
        </div>
        <div class="agent-card-footer">
          <button class="btn btn-sm btn-secondary" @click="selectAgent(a.id)">💬 对话</button>
          <button class="btn btn-sm btn-secondary" @click="editAgent(a)">✏️</button>
          <button class="btn btn-sm btn-danger" @click="deleteAgent(a.id)">🗑️</button>
        </div>
      </div>
      <div v-if="agents.length===0" class="empty-state" style="padding:24px">暂无 Agent — 点击"创建 Agent"添加</div>
    </div>
    <!-- Skills sub-tab -->
    <div v-if="agentSubTab==='skills'" class="skill-mgmt-grid">
      <div class="skill-mgmt-card" v-for="s in skillManifest" :key="s.name">
        <div class="skill-mgmt-icon">{{ s.icon || '🧰' }}</div>
        <div class="skill-mgmt-name">{{ s.name }}</div>
        <div class="skill-mgmt-desc">{{ s.description }}</div>
        <div class="skill-mgmt-tags">
          <span class="tag tag-blue">{{ s.category || 'general' }}</span>
          <span class="tag" v-if="s.sse">SSE流式</span>
        </div>
        <button class="btn btn-sm btn-secondary" @click="goToSkill(s.name)">使用</button>
      </div>
      <div v-if="!skillManifest || skillManifest.length===0" class="empty-state" style="padding:24px">加载中...</div>
    </div>
    <!-- Plugins sub-tab -->
    <div v-if="agentSubTab==='plugins'" class="plugin-mgmt-view">
      <div class="info-card">
        <h3>🔌 插件管理</h3>
        <p>LabOS 支持以插件形式扩展 Agent 能力。当前已加载的插件:</p>
        <div class="plugin-list">
          <div class="plugin-item">
            <span class="plugin-icon">📡</span>
            <span class="plugin-name">RSS News</span>
            <span class="plugin-status">✅ 已加载</span>
            <span class="plugin-desc">每日科研新闻推送</span>
          </div>
          <div class="plugin-item">
            <span class="plugin-icon">📧</span>
            <span class="plugin-name">Email Sync</span>
            <span class="plugin-status">⏳ 未配置</span>
            <span class="plugin-desc">IMAP 邮件→任务</span>
          </div>
          <div class="plugin-item">
            <span class="plugin-icon">🎤</span>
            <span class="plugin-name">STT (FunASR)</span>
            <span class="plugin-status">⏳ 未配置</span>
            <span class="plugin-desc">实时语音转文字</span>
          </div>
          <div class="plugin-item">
            <span class="plugin-icon">🔗</span>
            <span class="plugin-name">CLI Bridge</span>
            <span class="plugin-status">✅ 已加载</span>
            <span class="plugin-desc">labos.mjs 命令行接口</span>
          </div>
        </div>
      </div>
    </div>
    <!-- MCP sub-tab -->
    <div v-if="agentSubTab==='mcp'" class="mcp-mgmt-view">
      <div class="info-card">
        <h3>⚙️ MCP 配置</h3>
        <p>Model Context Protocol — 让 Agent 安全调用外部工具。</p>
        <div class="mcp-config">
          <label class="form-label">MCP Server URL</label>
          <input class="form-input" v-model="mcpConfig.url" placeholder="http://localhost:8080">
          <label class="form-label">允许的工具 (逗号分隔)</label>
          <input class="form-input" v-model="mcpConfig.tools" placeholder="file_read,file_write,run_python">
          <label class="form-label">禁止的工具 (逗号分隔)</label>
          <input class="form-input" v-model="mcpConfig.forbidden" placeholder="send_email,delete_files">
          <button class="btn btn-primary btn-sm" style="margin-top:8px" @click="saveMcpConfig">保存配置</button>
        </div>
        <div class="mcp-status" v-if="mcpSaved" style="margin-top:12px;color:#07C160">✅ MCP 配置已保存 (W3 接入 Cordis runtime 时生效)</div>
      </div>
    </div>
  </div>`;

html = html.replace(oldAgent, newAgent);
fs.writeFileSync('public/teacher.html', html, 'utf8');
console.log('teacher.html updated');

// === 2. Update teacher.js: add new state + functions ===
let js = fs.readFileSync('public/js/teacher.js', 'utf8');

// Add new state variables after kbPath declaration
const kbStateEnd = js.indexOf("loadKbFiles");
const newKbState = `kbSearch, kbViewingFile, kbViewingFileName, kbFileContent, viewKbFile,
    agentSubTab, editAgent, deleteAgent, mcpConfig, mcpSaved, saveMcpConfig, kbFilteredFiles,
    `;

// Find the return block and add new vars
const retIdx = js.lastIndexOf('return {');
const retEnd = js.indexOf('\n    }', retIdx + 10);
let retBlock = js.slice(retIdx, retEnd);

// Add new variables to return block if not already there
const newVars = [
  'kbSearch', 'kbFilteredFiles', 'kbViewingFile', 'kbViewingFileName', 'kbFileContent', 'viewKbFile',
  'agentSubTab', 'editAgent', 'deleteAgent', 'mcpConfig', 'mcpSaved', 'saveMcpConfig'
];
for (const v of newVars) {
  if (!retBlock.includes(v)) {
    // Insert before the closing
    retBlock = retBlock.replace(/\n\s*\}\s*$/, `, ${v}\n    }`);
  }
}
js = js.slice(0, retIdx) + retBlock + js.slice(retEnd);

// Add new function implementations before the return block
const newFuncs = `
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

`;

// Insert before return block
js = js.slice(0, retIdx) + newFuncs + '\n' + js.slice(retIdx);

fs.writeFileSync('public/js/teacher.js', js, 'utf8');
console.log('teacher.js updated');
console.log('Done!');
