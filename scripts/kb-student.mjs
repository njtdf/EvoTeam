import fs from "fs";

// ===== STUDENT.HTML: move nav + upgrade page =====
{
  const f = "public/student.html";
  let html = fs.readFileSync(f, "utf8");

  // 1. Remove old nav item from 科研工具
  const oldNav = '<a class="sidebar-nav-item" :class="{active:activeTab==='+"'"+'kb'+"'"+'}" @click="switchToKb"><span class="nav-icon">📚</span> 知识库</a>';
  
  // Check if already moved (i.e., kb nav in 核心 section)
  const coreSection = html.indexOf("核心");
  const kbNavIdx = html.indexOf("switchToKb");
  const sciToolsIdx = html.indexOf("科研工具");
  
  if (kbNavIdx > 0 && sciToolsIdx > 0 && kbNavIdx > sciToolsIdx) {
    // kb is still in 科研工具, move it
    // Remove from 科研工具
    html = html.replace(oldNav + "\n", "");
    html = html.replace(oldNav, "");
    
    // Add to 核心 section (after 日历 line)
    const calNav = '<a class="sidebar-nav-item" :class="{active:activeTab==='+"'"+'calendar'+"'"+'}" @click="switchToCalendar"><span class="nav-icon">📅</span> 日历</a>';
    const kbNav = calNav + '\n        <a class="sidebar-nav-item" :class="{active:activeTab==='+"'"+'kb'+"'"+'}" @click="switchToKb"><span class="nav-icon">📚</span> 知识库</a>';
    
    if (html.includes(calNav)) {
      html = html.replace(calNav, kbNav);
      console.log("[OK] nav moved to 核心");
    }
  } else {
    console.log("[SKIP] nav already in 核心 or not found");
  }

  // 2. Upgrade the knowledge base page to include TF-IDF search + stats
  const oldPage = '<!-- 知识库 Tab -->\n  <div v-if="activeTab==='+"'"+'kb'+"'"+'" class="kb-view" style="padding:12px">';
  const newPage = '<!-- 知识库 Tab -->\n  <div v-if="activeTab==='+"'"+'kb'+"'"+'" class="knowledge-view" style="padding:12px">';
  
  if (!html.includes("knowledge-view")) {
    html = html.replace(oldPage, newPage);
    
    // Insert search bar + stats before the file list
    const searchInsert = '    <div style="display:flex; gap:8px; margin-bottom:12px">\n      <input class="kb-search form-input" v-model="kbSearch" placeholder="搜索文件..." style="flex:1">\n      <button class="btn btn-secondary btn-sm" @click="loadKb">🔄 刷新</button>\n    </div>';
    const newSearchBlock = '    <!-- TF-IDF Semantic Search -->\n    <div class="kb-search-bar" style="margin-bottom:12px">\n      <input class="form-input" v-model="kbSemQuery" placeholder="语义搜索 (TF-IDF)..." style="flex:1" @keyup.enter="semSearchKb">\n      <button class="btn btn-primary btn-sm" @click="semSearchKb" :disabled="kbSemLoading">{{ kbSemLoading ? "搜索中..." : "🔍 搜索" }}</button>\n    </div>\n    <div v-if="kbSemResults && kbSemResults.length > 0" style="margin-bottom:16px">\n      <div class="kb-search-header">搜索结果 ({{ kbSemResults.length }} 条)</div>\n      <div class="kb-result-item" v-for="(r, idx) in kbSemResults" :key="idx" @click="viewKbFile(r.path)">\n        <div class="kb-result-header"><span class="kb-result-icon">📄</span><span class="kb-result-title">{{ r.title }}</span><span class="kb-result-score">{{ r.score.toFixed(4) }}</span></div>\n        <div class="kb-result-snippet">{{ r.snippet }}</div>\n        <div class="kb-result-path">{{ r.path }}</div>\n      </div>\n    </div>\n    <div v-else-if="kbSemQuery && !kbSemLoading && kbSemResults && kbSemResults.length === 0" class="empty-state" style="padding:12px">无匹配结果</div>\n\n    <!-- Stats -->\n    <div class="kb-stats-grid" v-if="kbSemStats" style="margin-bottom:12px">\n      <div class="kb-stat-card"><div class="kb-stat-num">{{ kbSemStats.total_docs || 0 }}</div><div class="kb-stat-label">总文档</div></div>\n      <div class="kb-stat-card"><div class="kb-stat-num">{{ kbSemStats.total_keywords || 0 }}</div><div class="kb-stat-label">关键词</div></div>\n    </div>\n\n    <!-- File Browser -->\n    <div style="display:flex; gap:8px; margin-bottom:12px">\n      <input class="form-input" v-model="kbSearch" placeholder="文件名搜索..." style="flex:1">\n      <button class="btn btn-secondary btn-sm" @click="loadKb">🔄 刷新</button>\n    </div>';
    
    html = html.replace(searchInsert, newSearchBlock);
    console.log("[OK] page upgraded with TF-IDF search");
  } else {
    console.log("[SKIP] page already upgraded");
  }

  fs.writeFileSync(f, html, "utf8");
  console.log("student.html done");
}

// ===== STUDENT.JS: add TF-IDF refs + functions =====
{
  const f = "public/js/student.js";
  let js = fs.readFileSync(f, "utf8");

  if (js.includes("kbSemQuery")) {
    console.log("[SKIP] student.js already has TF-IDF refs");
  } else {
    // Add new refs after existing kb refs
    const refAnchor = "const kbFileContent = ref('')";
    const newRefs = refAnchor + "\n    // TF-IDF search refs\n    const kbSemQuery = ref('')\n    const kbSemResults = ref([])\n    const kbSemLoading = ref(false)\n    const kbSemStats = ref(null)";
    js = js.replace(refAnchor, newRefs);

    // Add TF-IDF functions after existing viewKbFile function
    const funcAnchor = "      } catch (e) { kbFileContent.value = '加载失败: ' + e.message }\n    }";
    const newFuncs = funcAnchor + "\n\n    // TF-IDF semantic search\n    async function semSearchKb() {\n      const q = kbSemQuery.value.trim()\n      if (!q) { kbSemResults.value = []; return }\n      kbSemLoading.value = true\n      try {\n        const r = await api('/api/kb/search?q=' + encodeURIComponent(q) + '&limit=20')\n        kbSemResults.value = r.results || []\n      } catch(e) { showToast('搜索失败: ' + e.message) }\n      kbSemLoading.value = false\n    }\n\n    async function loadKbStats() {\n      try {\n        const r = await api('/api/kb/stats')\n        kbSemStats.value = r\n      } catch(e) { console.error('KB stats:', e) }\n    }";
    js = js.replace(funcAnchor, newFuncs);

    // Update switchToKb to also load stats
    const oldSwitch = "async function switchToKb() {\n      activeTab.value = 'kb'\n      await loadKb()\n    }";
    const newSwitch = "async function switchToKb() {\n      activeTab.value = 'kb'\n      await loadKb()\n      await loadKbStats()\n    }";
    js = js.replace(oldSwitch, newSwitch);

    // Add to return statement
    const retOld = "      kbViewingFile, kbViewingFileName, kbFileContent, viewKbFile";
    if (js.includes(retOld)) {
      const retNew = retOld + ",\n      kbSemQuery, kbSemResults, kbSemLoading, kbSemStats, semSearchKb, loadKbStats";
      js = js.replace(retOld, retNew);
      console.log("[OK] return updated");
    } else {
      // Try to find the return statement with these vars
      const retPattern = "kbFileContent";
      const retIdx = js.lastIndexOf(retPattern);
      console.log("[INFO] looking for return pattern...");
      // Find the return block
      const retMatch = js.match(/return\s*\{[^}]*kbFileContent[^}]*\}/s);
      if (retMatch) {
        const newRet = retMatch[0].replace("kbFileContent", "kbFileContent, kbSemQuery, kbSemResults, kbSemLoading, kbSemStats, semSearchKb, loadKbStats");
        js = js.replace(retMatch[0], newRet);
        console.log("[OK] return updated via regex");
      }
    }

    fs.writeFileSync(f, js, "utf8");
    console.log("student.js done");
  }
}

console.log("=== STUDENT SIDE COMPLETE ===");
