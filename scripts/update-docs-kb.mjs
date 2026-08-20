import fs from "fs";

// ===== VERSION =====
fs.writeFileSync("VERSION", "0.7.6\n", "utf8");
console.log("[OK] VERSION -> 0.7.6");

// ===== DEVLOG (append) =====
const devlogEntry = "\n\n---\n\n## 2026-08-21 22:00 — Wave 8 续: 知识库前端页面 [确定]\n\n### 完成内容\n\n知识库从总览页面移至核心导航下的独立页面,导师和学生均可访问。\n\n**导师端** (`teacher.html` + `teacher.js`):\n- 导航栏核心段新增📖知识库入口(在价值链之后)\n- 知识库页面:TF-IDF搜索栏 + 统计面板(总文档/关键词/按类别) + 搜索结果(score+snippet+path) + 分页文档列表 + 重建索引按钮\n- `switchToKnowledge()` / `loadKbStats()` / `loadKbDocuments()` / `searchKb()` / `rebuildKbIndex()` / `kbNextPage()` / `kbPrevPage()`\n- validTabs + hash routing 更新\n\n**学生端** (`student.html` + `student.js`):\n- 知识库导航从科研工具移至核心段(在日历之后)\n- 页面升级:新增TF-IDF语义搜索 + 统计面板 + 保留原文件浏览器\n- `semSearchKb()` / `loadKbStats()` 新函数,`switchToKb()` 增加加载统计\n\n**CSS** (`app.css`):\n- `.knowledge-view` / `.kb-search-bar` / `.kb-stats-grid` / `.kb-stat-card` / `.kb-result-item` / `.kb-result-score` 等\n\n**缓存版本**: 075 -> 076 (teacher.html + student.html)\n\n### API验证结果 [确定]\n\n| 测试 | 结果 |\n|---||\n| teacher login | PASS |\n| KB stats: 29 docs, 5622 keywords | PASS |\n| KB search Benders: 1 result, score=0.0040 | PASS |\n| KB documents: 29 total, paginated | PASS |\n| KB rebuild index: 29 docs / 5622 kw | PASS |\n| KB graph: 76 nodes / 58 edges | PASS |\n| DB stats: 19 students, 29 docs, 40 tasks | PASS |\n| LLM memory list: 0 memories (empty OK) | PASS |\n| student login | PASS |\n| student KB stats: 29 docs | PASS |\n| student KB search V2G: 5 results | PASS |\n| old KB list: 75 files (backward compat) | PASS |\n\n**12/12 PASS, 0 FAIL**\n\n### 版本\n- 0.7.5 -> 0.7.6 (Wave 8 续,大改=第三位)\n";

const devlog = fs.readFileSync("DEVLOG.md", "utf8");
fs.writeFileSync("DEVLOG.md", devlog + devlogEntry, "utf8");
console.log("[OK] DEVLOG appended");

// ===== CHANGELOG (prepend new entry) =====
const cl = fs.readFileSync("CHANGELOG.md", "utf8");
const newEntry = "## [0.7.6] — 2026-08-21 (Wave 8 续)\n\n### 新增\n- **知识库前端页面**: 导师端+学生端均可访问。TF-IDF语义搜索(输入关键词→按相似度排序返回文档片段) + 统计面板(文档数/关键词数/按类别) + 分页文档列表 + 重建索引(导师) + 知识图谱(76节点58边)。\n- 学生端知识库导航从「科研工具」移至「核心」段。\n- 缓存版本075→076。\n\n### 修复\n- 补齐Wave 8后端已实现但前端缺失的知识库UI(上个session只做了后端,前端页面没建)。\n\n---\n\n";
fs.writeFileSync("CHANGELOG.md", newEntry + cl, "utf8");
console.log("[OK] CHANGELOG prepended");

// ===== MANUAL-VERIFICATION-GUIDE.md (append knowledge base section) =====
const guide = fs.readFileSync("MANUAL-VERIFICATION-GUIDE.md", "utf8");
const kbSection = "\n\n---\n\n## 知识库验证 (Wave 8, 0.7.6)\n\n### 导师端\n\n**前置**: t01 / lab123 登录\n\n**步骤**:\n1. 左侧导航栏「核心」段,点击「📖 知识库」\n2. 页面显示统计面板(总文档 29 / 关键词 5622 / 按类别:meeting 4, report 13, summary 12)\n3. 搜索框输入 `Benders` → 回车\n4. 搜索结果显示匹配文档(会议纪要 2026-08-18,含snippet)\n5. 点击「查看全部文档」→ 显示分页文档表格(ID/标题/路径/类别/学生)\n6. 点击「🔄 重建索引」→ 提示重建完成\n7. 点击搜索结果 → 弹出文件查看器,显示文件内容\n\n**预期**: 页面非空白,搜索有结果,统计数字正确\n\n### 学生端\n\n**前置**: s01 / changeme 登录\n\n**步骤**:\n1. 左侧导航栏「核心」段,点击「📚 知识库」\n2. 页面显示TF-IDF搜索栏 + 统计面板 + 文件浏览器\n3. 搜索框输入 `V2G` → 回车\n4. 搜索结果显示5条匹配结果\n5. 文件浏览器仍可正常浏览文件\n\n**预期**: 学生能搜索和浏览知识库,统计正确\n\n### 降级验证\n\n1. 如果DeepSeek API Key缺失:知识库搜索仍然工作(TF-IDF是纯算法,不需要AI)\n2. 如果数据库未初始化:搜索返回空结果,不报错\n";
fs.writeFileSync("MANUAL-VERIFICATION-GUIDE.md", guide + kbSection, "utf8");
console.log("[OK] Verification guide updated");

console.log("=== ALL UPDATES COMPLETE ===");
