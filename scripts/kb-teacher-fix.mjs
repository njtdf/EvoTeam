import fs from "fs";
const f = "public/js/teacher.js";
let js = fs.readFileSync(f, "utf8");

// Check if functions already exist
if (js.includes("const kbSearchQuery")) {
  console.log("[SKIP] functions already exist");
} else {
  const funcBlock = "\n  // ===== 知识库 (TF-IDF) =====\n  const kbSearchQuery = ref('')\n  const kbSearchResults = ref([])\n  const kbSemLoading = ref(false)\n  const kbStats = ref(null)\n  const kbDocuments = ref([])\n  const kbPage = ref(1)\n  const kbPerPage = ref(20)\n  const kbTotalDocs = ref(0)\n  const kbTotalPages = computed(() => Math.ceil(kbTotalDocs.value / kbPerPage.value) || 1)\n  const kbShowDocs = ref(false)\n  const kbRebuilding = ref(false)\n\n  async function switchToKnowledge() {\n    activeTab.value = 'knowledge'\n    await loadKbStats()\n    await loadKbDocuments()\n  }\n  async function loadKbStats() {\n    try { const r = await api('/api/kb/stats'); kbStats.value = r } catch(e) { console.error('KB stats:', e) }\n  }\n  async function loadKbDocuments() {\n    try { const r = await api('/api/kb/documents?page=' + kbPage.value + '&per_page=' + kbPerPage.value); kbDocuments.value = r.documents || []; kbTotalDocs.value = r.total || 0 } catch(e) { console.error('KB docs:', e) }\n  }\n  async function searchKb() {\n    const q = kbSearchQuery.value.trim()\n    if (!q) { kbSearchResults.value = []; return }\n    kbSemLoading.value = true\n    try { const r = await api('/api/kb/search?q=' + encodeURIComponent(q) + '&limit=20'); kbSearchResults.value = r.results || [] } catch(e) { showToast('搜索失败: ' + e.message) }\n    kbSemLoading.value = false\n  }\n  async function rebuildKbIndex() {\n    kbRebuilding.value = true\n    try { const r = await api('/api/kb/index', { method: 'POST' }); showToast('重建完成: ' + (r.indexed?.docs||0) + ' docs'); await loadKbStats(); await loadKbDocuments() } catch(e) { showToast('重建失败') }\n    kbRebuilding.value = false\n  }\n  function kbNextPage() { if (kbPage.value < kbTotalPages.value) { kbPage.value++; loadKbDocuments() } }\n  function kbPrevPage() { if (kbPage.value > 1) { kbPage.value--; loadKbDocuments() } }\n\n";

  const returnIdx = js.indexOf("return {");
  if (returnIdx > 0) {
    js = js.slice(0, returnIdx) + funcBlock + js.slice(returnIdx);
    console.log("[OK] functions added at position", returnIdx);
  } else {
    console.log("[ERROR] return { not found");
  }
  
  fs.writeFileSync(f, js, "utf8");
}
console.log("done");
