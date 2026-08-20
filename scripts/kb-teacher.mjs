import fs from "fs";

// ===== TEACHER.HTML: nav item + page =====
{
  const f = "public/teacher.html";
  let html = fs.readFileSync(f, "utf8");

  const navOld = 'switchToValueCycle"><span class="nav-icon">🔗</span> 价值链</a>';
  const navNew = navOld + "\n        <a class=\"sidebar-nav-item\" :class=\"{active:activeTab==='knowledge'}\" @click=\"switchToKnowledge\"><span class=\"nav-icon\">📖</span> 知识库</a>";

  if (!html.includes("activeTab==='knowledge'")) {
    html = html.split(navOld).join(navNew);
    console.log("[OK] nav item added");
  } else {
    console.log("[SKIP] nav already exists");
  }

  if (!html.includes("knowledge-view")) {
    const page = "\n  <!-- 知识库 Tab -->\n  <div v-if=\"activeTab==='knowledge'\" class=\"knowledge-view\" style=\"padding:16px\">\n    <div style=\"display:flex; align-items:center; gap:12px; margin-bottom:16px\">\n      <h2 style=\"margin:0; font-size:20px\">📖 课题组知识库</h2>\n      <span class=\"spacer\" style=\"flex:1\"></span>\n      <button class=\"btn btn-secondary btn-sm\" @click=\"rebuildKbIndex\" :disabled=\"kbRebuilding\">\n        {{ kbRebuilding ? '索引重建中...' : '🔄 重建索引' }}\n      </button>\n    </div>\n    <div class=\"kb-stats-grid\" v-if=\"kbStats\">\n      <div class=\"kb-stat-card\">\n        <div class=\"kb-stat-num\">{{ kbStats.total_docs || 0 }}</div>\n        <div class=\"kb-stat-label\">总文档</div>\n      </div>\n      <div class=\"kb-stat-card\">\n        <div class=\"kb-stat-num\">{{ kbStats.total_keywords || 0 }}</div>\n        <div class=\"kb-stat-label\">关键词索引</div>\n      </div>\n      <div class=\"kb-stat-card\" v-for=\"cat in (kbStats.by_category || [])\" :key=\"cat.category\">\n        <div class=\"kb-stat-num\">{{ cat.c }}</div>\n        <div class=\"kb-stat-label\">{{ cat.category }}</div>\n      </div>\n    </div>\n    <div class=\"kb-search-bar\" style=\"margin-top:16px\">\n      <input class=\"form-input\" v-model=\"kbSearchQuery\" placeholder=\"输入关键词搜索 (TF-IDF 语义匹配)...\" style=\"flex:1\" @keyup.enter=\"searchKb\">\n      <button class=\"btn btn-primary btn-sm\" @click=\"searchKb\" :disabled=\"kbSemLoading\">{{ kbSemLoading ? '搜索中...' : '🔍 搜索' }}</button>\n      <button class=\"btn btn-secondary btn-sm\" @click=\"kbShowDocs = !kbShowDocs\">{{ kbShowDocs ? '隐藏文档列表' : '查看全部文档' }}</button>\n    </div>\n    <div v-if=\"kbSemLoading\" class=\"loading\" style=\"padding:20px\">搜索中...</div>\n    <div v-else-if=\"kbSearchResults && kbSearchResults.length > 0\" class=\"kb-search-results\">\n      <div class=\"kb-search-header\">搜索结果 ({{ kbSearchResults.length }} 条)</div>\n      <div class=\"kb-result-item\" v-for=\"(r, idx) in kbSearchResults\" :key=\"idx\" @click=\"viewKbFile(r.path)\">\n        <div class=\"kb-result-header\"><span class=\"kb-result-icon\">📄</span><span class=\"kb-result-title\">{{ r.title }}</span><span class=\"kb-result-score\">{{ r.score.toFixed(4) }}</span></div>\n        <div class=\"kb-result-snippet\">{{ r.snippet }}</div>\n        <div class=\"kb-result-path\">{{ r.path }}</div>\n      </div>\n    </div>\n    <div v-else-if=\"kbSearchQuery && !kbSemLoading && kbSearchResults && kbSearchResults.length === 0\" class=\"empty-state\" style=\"padding:20px\">无匹配结果</div>\n    <div v-if=\"kbShowDocs\" style=\"margin-top:20px\">\n      <div class=\"card-title\" style=\"margin-bottom:8px\">全部文档 ({{ kbPage }} / {{ kbTotalPages }})</div>\n      <table class=\"data-table\" v-if=\"kbDocuments.length > 0\">\n        <thead><tr><th>ID</th><th>标题</th><th>路径</th><th>类别</th><th>学生</th></tr></thead>\n        <tbody>\n          <tr v-for=\"d in kbDocuments\" :key=\"d.id\" @click=\"viewKbFile(d.path)\" style=\"cursor:pointer\">\n            <td class=\"mono\">{{ d.id }}</td><td>{{ d.title }}</td>\n            <td class=\"text-muted\" style=\"font-size:11px; max-width:300px; overflow:hidden; text-overflow:ellipsis\">{{ d.path }}</td>\n            <td><span class=\"tag\">{{ d.category }}</span></td><td>{{ d.student_id || '-' }}</td>\n          </tr>\n        </tbody>\n      </table>\n      <div v-else class=\"empty-state\" style=\"padding:16px\">暂无文档</div>\n      <div style=\"display:flex; gap:8px; margin-top:8px\" v-if=\"kbTotalPages > 1\">\n        <button class=\"btn btn-secondary btn-sm\" @click=\"kbPrevPage\" :disabled=\"kbPage <= 1\">上一页</button>\n        <span style=\"padding:4px 8px\">{{ kbPage }} / {{ kbTotalPages }}</span>\n        <button class=\"btn btn-secondary btn-sm\" @click=\"kbNextPage\" :disabled=\"kbPage >= kbTotalPages\">下一页</button>\n      </div>\n    </div>\n    <div v-if=\"kbViewingFile\" class=\"modal-overlay\" @click.self=\"kbViewingFile=null\">\n      <div class=\"modal-box\" style=\"max-width:800px; max-height:80vh; overflow-y:auto\">\n        <div class=\"modal-header\"><span class=\"modal-title\">📄 {{ kbViewingFileName }}</span><button class=\"btn btn-sm\" @click=\"kbViewingFile=null\">✕</button></div>\n        <pre style=\"padding:16px; white-space:pre-wrap; font-size:13px; line-height:1.6\">{{ kbFileContent }}</pre>\n      </div>\n    </div>\n  </div>\n";
    html = html.replace("</main>", page + "\n</main>");
    console.log("[OK] knowledge page added");
  } else {
    console.log("[SKIP] knowledge page already exists");
  }

  fs.writeFileSync(f, html, "utf8");
  console.log("teacher.html done");
}

// ===== TEACHER.JS: validTabs + routing + refs + functions + return =====
{
  const f = "public/js/teacher.js";
  let js = fs.readFileSync(f, "utf8");

  // validTabs
  const vtOld = "'calendar']";
  const vtNew = "'calendar','knowledge']";
  if (js.includes("'knowledge'") === false) {
    js = js.replace(vtOld, vtNew);
    console.log("[OK] validTabs updated");
  }

  // hash routing
  const hashOld = "else if (hash === 'valuecycle') await switchToValueCycle()";
  const hashNew = hashOld + "\n      else if (hash === 'knowledge') await switchToKnowledge()";
  if (!js.includes("hash === 'knowledge'")) {
    js = js.replace(hashOld, hashNew);
    console.log("[OK] hash routing added");
  }

  // refs + functions before return
  const funcBlock = "\n  // ===== 知识库 (TF-IDF) =====\n  const kbSearchQuery = ref('')\n  const kbSearchResults = ref([])\n  const kbSemLoading = ref(false)\n  const kbStats = ref(null)\n  const kbDocuments = ref([])\n  const kbPage = ref(1)\n  const kbPerPage = ref(20)\n  const kbTotalDocs = ref(0)\n  const kbTotalPages = computed(() => Math.ceil(kbTotalDocs.value / kbPerPage.value) || 1)\n  const kbShowDocs = ref(false)\n  const kbRebuilding = ref(false)\n\n  async function switchToKnowledge() {\n    activeTab.value = 'knowledge'\n    await loadKbStats()\n    await loadKbDocuments()\n  }\n  async function loadKbStats() {\n    try { const r = await api('/api/kb/stats'); kbStats.value = r } catch(e) { console.error('KB stats:', e) }\n  }\n  async function loadKbDocuments() {\n    try { const r = await api('/api/kb/documents?page=' + kbPage.value + '&per_page=' + kbPerPage.value); kbDocuments.value = r.documents || []; kbTotalDocs.value = r.total || 0 } catch(e) { console.error('KB docs:', e) }\n  }\n  async function searchKb() {\n    const q = kbSearchQuery.value.trim()\n    if (!q) { kbSearchResults.value = []; return }\n    kbSemLoading.value = true\n    try { const r = await api('/api/kb/search?q=' + encodeURIComponent(q) + '&limit=20'); kbSearchResults.value = r.results || [] } catch(e) { showToast('搜索失败: ' + e.message) }\n    kbSemLoading.value = false\n  }\n  async function rebuildKbIndex() {\n    kbRebuilding.value = true\n    try { const r = await api('/api/kb/index', { method: 'POST' }); showToast('重建完成: ' + (r.indexed?.docs||0) + ' docs'); await loadKbStats(); await loadKbDocuments() } catch(e) { showToast('重建失败') }\n    kbRebuilding.value = false\n  }\n  function kbNextPage() { if (kbPage.value < kbTotalPages.value) { kbPage.value++; loadKbDocuments() } }\n  function kbPrevPage() { if (kbPage.value > 1) { kbPage.value--; loadKbDocuments() } }\n\n";

  if (!js.includes("switchToKnowledge")) {
    const returnIdx = js.indexOf("return {");
    if (returnIdx > 0) {
      js = js.slice(0, returnIdx) + funcBlock + js.slice(returnIdx);
      console.log("[OK] refs + functions added");
    }
  }

  // return statement
  if (!js.includes("kbSearchQuery")) {
    const retOld = "      switchToCalendar, prevMonth, nextMonth,";
    const retNew = retOld + "\n      // 知识库\n      kbSearchQuery, kbSearchResults, kbSemLoading, kbStats, kbDocuments,\n      kbPage, kbTotalPages, kbShowDocs, kbRebuilding,\n      switchToKnowledge, loadKbStats, loadKbDocuments, searchKb, rebuildKbIndex,\n      kbNextPage, kbPrevPage,";
    js = js.replace(retOld, retNew);
    console.log("[OK] return statement updated");
  }

  fs.writeFileSync(f, js, "utf8");
  console.log("teacher.js done");
}

console.log("=== TEACHER SIDE COMPLETE ===");
