import fs from 'fs';
const css = fs.readFileSync('public/css/app.css', 'utf8');
const newCss = `

/* === Wave 7.2: KB + Agent Management + UI Polish === */

.kb-search { width: 180px; }
.kb-file-list { display: flex; flex-direction: column; gap: 2px; max-height: 300px; overflow-y: auto; }
.kb-file-item {
  display: flex; align-items: center; gap: 8px; padding: 6px 8px;
  border-radius: 6px; cursor: pointer; transition: background 0.15s, transform 0.15s;
}
.kb-file-item:hover { background: #e8f5e9; transform: translateX(2px); }
.kb-file-icon { font-size: 16px; width: 20px; text-align: center; }
.kb-file-name { font-size: 13px; font-weight: 500; min-width: 120px; }
.kb-file-path { font-size: 11px; color: #999; flex: 1; }
.kb-file-size { font-size: 11px; color: #aaa; min-width: 50px; text-align: right; }
.kb-file-content {
  max-height: 60vh; overflow: auto; background: #f7f7f7; padding: 16px;
  border-radius: 8px; font-size: 13px; white-space: pre-wrap; word-break: break-all;
  font-family: 'Consolas', 'Monaco', monospace;
}

/* Agent Management (multica-style) */
.agent-mgmt-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.sub-tab-bar {
  display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 2px solid #eee;
  padding-bottom: 0;
}
.sub-tab {
  padding: 8px 16px; font-size: 13px; border: none; background: none;
  cursor: pointer; color: #666; border-bottom: 2px solid transparent;
  margin-bottom: -2px; transition: all 0.2s; border-radius: 4px 4px 0 0;
}
.sub-tab:hover { color: #07C160; background: #f0f7f4; }
.sub-tab.active { color: #07C160; border-bottom-color: #07C160; font-weight: 600; }

.skill-mgmt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.skill-mgmt-card {
  background: #fff; border-radius: 10px; padding: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06); transition: all 0.2s;
  display: flex; flex-direction: column; gap: 6px;
}
.skill-mgmt-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); transform: translateY(-2px); }
.skill-mgmt-icon { font-size: 28px; }
.skill-mgmt-name { font-weight: 600; font-size: 14px; }
.skill-mgmt-desc { font-size: 12px; color: #888; line-height: 1.4; }
.skill-mgmt-tags { display: flex; gap: 4px; flex-wrap: wrap; }
.skill-mgmt-tags .tag { font-size: 11px; padding: 2px 6px; border-radius: 4px; }
.tag-blue { background: #e3f2fd; color: #1976d2; }

.plugin-mgmt-view, .mcp-mgmt-view { padding: 8px 0; }
.info-card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
.info-card h3 { margin: 0 0 8px; font-size: 18px; }
.info-card p { color: #666; font-size: 13px; line-height: 1.5; margin: 0 0 12px; }
.plugin-list { display: flex; flex-direction: column; gap: 8px; }
.plugin-item {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px;
  background: #f7f7f7; border-radius: 8px; font-size: 13px;
}
.plugin-icon { font-size: 20px; }
.plugin-name { font-weight: 600; min-width: 100px; }
.plugin-status { font-size: 12px; padding: 2px 8px; border-radius: 4px; }
.plugin-desc { color: #888; flex: 1; }
.mcp-config { display: flex; flex-direction: column; gap: 4px; max-width: 500px; }
.mcp-status { font-size: 13px; }

.btn-danger { background: #fee; color: #c33; border: 1px solid #fcc; }
.btn-danger:hover { background: #fdd; }
.modal-lg { width: 720px; max-width: 95vw; }
.modal-lg .modal-body { padding: 0; }

/* UI Polish (qm-style) */
.agent-card { transition: all 0.2s ease; }
.agent-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.12); transform: translateY(-2px); }
.agent-card-footer { display: flex; gap: 4px; margin-top: 8px; }
.agent-card-footer .btn { flex: 0 0 auto; }
.sidebar-nav-item { transition: all 0.15s; }
.sidebar-nav-item:hover { background: #f0f7f4; color: #07C160; }
.student-card { transition: all 0.2s; }
.student-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); transform: translateY(-1px); }
.chat-bubble { animation: fadeIn 0.2s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
.cursor-blink { animation: blink 1s step-end infinite; }
@keyframes blink { 50% { opacity: 0; } }
.task-card { transition: all 0.2s; }
.task-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.12); border-color: #07C160; }
.kn-summary-bar { background: linear-gradient(135deg, #f0f7f4 0%, #e8f5e9 100%); }
.agent-avatar-card { transition: all 0.2s; }
.agent-avatar-card:hover { transform: translateY(-2px) scale(1.05); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
`;
fs.writeFileSync('public/css/app.css', css + newCss, 'utf8');
console.log('CSS appended, total lines:', (css + newCss).split('\\n').length);
