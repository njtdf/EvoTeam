const BASE = "http://localhost:3001";

async function test() {
  let pass = 0, fail = 0;
  function ok(name) { console.log("[PASS] " + name); pass++; }
  function ko(name, err) { console.log("[FAIL] " + name + ": " + err); fail++; }

  // --- Teacher login ---
  const tr = await fetch(BASE + "/api/login", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({role:"teacher", student_id:"t01", password:"lab123"})
  });
  const tcookie = tr.headers.get("set-cookie").split(";")[0];
  const TH = {Cookie: tcookie};
  if (tr.status === 200) ok("teacher login"); else ko("teacher login", "status " + tr.status);

  // --- KB Stats ---
  const sr = await fetch(BASE + "/api/kb/stats", {headers: TH});
  const sd = await sr.json();
  if (sd.total_docs > 0) ok("KB stats: " + sd.total_docs + " docs, " + sd.total_keywords + " keywords");
  else ko("KB stats", JSON.stringify(sd));

  // --- KB Search ---
  const sr2 = await fetch(BASE + "/api/kb/search?q=Benders&limit=5", {headers: TH});
  const sd2 = await sr2.json();
  if (sd2.results && sd2.results.length > 0) ok("KB search 'Benders': " + sd2.results.length + " results, top score=" + sd2.results[0].score.toFixed(4));
  else ko("KB search", JSON.stringify(sd2));

  // --- KB Documents ---
  const sr3 = await fetch(BASE + "/api/kb/documents?page=1&per_page=5", {headers: TH});
  const sd3 = await sr3.json();
  if (sd3.total > 0 && sd3.documents.length > 0) ok("KB documents: " + sd3.total + " total, page has " + sd3.documents.length);
  else ko("KB documents", JSON.stringify(sd3));

  // --- KB Rebuild Index ---
  const sr4 = await fetch(BASE + "/api/kb/index", {method:"POST", headers: TH});
  const sd4 = await sr4.json();
  if (sd4.ok) ok("KB rebuild: " + (sd4.indexed?.docs||0) + " docs, " + (sd4.indexed?.keywords||0) + " keywords");
  else ko("KB rebuild", JSON.stringify(sd4));

  // --- KB Graph ---
  const sr5 = await fetch(BASE + "/api/kb/graph", {headers: TH});
  const sd5 = await sr5.json();
  if (sd5.nodes && sd5.edges !== undefined) ok("KB graph: " + sd5.nodes.length + " nodes, " + sd5.edges.length + " edges");
  else ko("KB graph", JSON.stringify(sd5).substring(0,200));

  // --- DB Stats ---
  const dr = await fetch(BASE + "/api/db/stats", {headers: TH});
  const dd = await dr.json();
  if (dd.students > 0) ok("DB stats: " + dd.students + " students, " + dd.kb_documents + " docs, " + dd.tasks + " tasks");
  else ko("DB stats", JSON.stringify(dd));

  // --- LLM Memory (empty but should not error) ---
  const mr = await fetch(BASE + "/api/llm-memory/steward", {headers: TH});
  const md = await mr.json();
  if (md.memories !== undefined) ok("LLM memory list: " + md.memories.length + " memories");
  else ko("LLM memory list", JSON.stringify(md).substring(0,200));

  // --- Student login ---
  const str = await fetch(BASE + "/api/login", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({role:"student", student_id:"s01", password:"changeme"})
  });
  const scoop = str.headers.get("set-cookie").split(";")[0];
  const SH = {Cookie: scoop};
  if (str.status === 200) ok("student login"); else ko("student login", "status " + str.status);

  // --- Student KB access ---
  const ssr = await fetch(BASE + "/api/kb/stats", {headers: SH});
  const ssd = await ssr.json();
  if (ssd.total_docs > 0) ok("student KB stats: " + ssd.total_docs + " docs");
  else ko("student KB stats", JSON.stringify(ssd));

  // --- Student KB search ---
  const ssr2 = await fetch(BASE + "/api/kb/search?q=V2G&limit=5", {headers: SH});
  const ssd2 = await ssr2.json();
  if (ssd2.results) ok("student KB search 'V2G': " + ssd2.results.length + " results");
  else ko("student KB search", JSON.stringify(ssd2));

  // --- Old KB routes still work ---
  const okr = await fetch(BASE + "/api/kb/list", {headers: SH});
  const okd = await okr.json();
  if (okd.files) ok("old KB list: " + okd.files.length + " files");
  else ko("old KB list", JSON.stringify(okd).substring(0,200));

  console.log("\n=== RESULTS: " + pass + " PASS, " + fail + " FAIL ===");
}
test().catch(e => console.log("FATAL:", e.message));
