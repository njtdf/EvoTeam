// lib/memory.js - F7-lite: Per-student context accumulator
// NOT a vector DB — lightweight JSON per student, injected into every AI prompt
// Upgrade path: W3 → ChromaDB/LanceDB, these JSON files become initial corpus
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORAGE = join(__dirname, '..', 'labos', 'memory');

function ensureDir() {
  if (!existsSync(STORAGE)) mkdirSync(STORAGE, { recursive: true });
}

export function loadMemory(studentId) {
  ensureDir();
  const p = join(STORAGE, `${studentId}.json`);
  if (!existsSync(p)) {
    return {
      student_id: studentId,
      student_name: '',
      research_direction: '',
      key_terms: [],
      recent_progress: [],
      known_blockers: [],
      skill_history: [],
      last_updated: null,
    };
  }
  try {
    return JSON.parse(readFileSync(p, 'utf-8'));
  } catch {
    return { student_id: studentId, student_name: '', research_direction: '', key_terms: [], recent_progress: [], known_blockers: [], skill_history: [], last_updated: null };
  }
}

export function saveMemory(studentId, data) {
  ensureDir();
  data.student_id = studentId;
  data.last_updated = new Date().toISOString();
  writeFileSync(join(STORAGE, `${studentId}.json`), JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

export function updateMemory(studentId, patch) {
  const mem = loadMemory(studentId);
  const merged = { ...mem, ...patch };
  return saveMemory(studentId, merged);
}

// Extract key terms from text (simple frequency-based, no NLP)
function extractKeyTerms(text, existing = []) {
  const stopWords = new Set(['的','了','是','在','和','与','或','对','为','以','及','等','个','这','那','我','你','他','她','它','们','上','下','中','后','前','到','从','被','把','给','向','于','由','按','照','根据','进行','通过','使用','利用','基于','the','a','an','is','are','was','were','to','of','in','on','for','with','and','or','not','but','this','that','we','our','can','will','be','have','has','do','does']);
  const words = text.match(/[\u4e00-\u9fa5]{2,6}|[A-Za-z]{3,20}/g) || [];
  const freq = {};
  for (const w of words) {
    if (stopWords.has(w.toLowerCase())) continue;
    freq[w] = (freq[w] || 0) + 1;
  }
  const sorted = Object.entries(freq).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
  // Merge with existing, dedupe, cap at 15
  const combined = [...new Set([...sorted, ...existing])].slice(0, 15);
  return combined;
}

// Accumulate context from a submitted weekly report + AI summary
export function accumulateFromReport(studentId, studentName, reportContent, aiSummary) {
  const mem = loadMemory(studentId);
  if (studentName) mem.student_name = studentName;

  // Extract progress from summary
  if (aiSummary && aiSummary.summary) {
    mem.recent_progress = [aiSummary.summary, ...(mem.recent_progress || [])].slice(0, 10);
  }

  // Extract blockers from risks
  if (aiSummary && aiSummary.risks) {
    mem.known_blockers = [...(aiSummary.risks || []), ...(mem.known_blockers || [])].slice(0, 10);
  }

  // Extract key terms from full report
  mem.key_terms = extractKeyTerms(reportContent || '', mem.key_terms || []);

  return saveMemory(studentId, mem);
}

// Accumulate from a chat exchange (just the gist)
export function accumulateFromChat(studentId, chatGist) {
  const mem = loadMemory(studentId);
  if (chatGist) {
    mem.recent_progress = [chatGist, ...(mem.recent_progress || [])].slice(0, 10);
  }
  return saveMemory(studentId, mem);
}

// Accumulate from a skill evaluation (e.g. idea-evaluator result)
export function accumulateFromSkill(studentId, skillName, resultSummary) {
  const mem = loadMemory(studentId);
  mem.skill_history = [
    { skill: skillName, summary: (resultSummary || '').substring(0, 500), timestamp: new Date().toISOString() },
    ...(mem.skill_history || []),
  ].slice(0, 20);
  return saveMemory(studentId, mem);
}

// Accumulate from task update (track blockers)
export function accumulateFromTask(studentId, taskTitle, taskStatus) {
  const mem = loadMemory(studentId);
  if (taskStatus === 'blocked') {
    mem.known_blockers = [taskTitle, ...(mem.known_blockers || [])].slice(0, 10);
  } else if (taskStatus === 'done') {
    // Remove from blockers if present
    mem.known_blockers = (mem.known_blockers || []).filter(b => b !== taskTitle);
  }
  return saveMemory(studentId, mem);
}

// Format memory as context string for AI system prompt
export function getContextString(studentId) {
  const mem = loadMemory(studentId);
  if (!mem.last_updated) return '';

  const parts = [];
  if (mem.student_name) parts.push(`学生姓名: ${mem.student_name}`);
  if (mem.research_direction) parts.push(`研究方向: ${mem.research_direction}`);
  if (mem.key_terms && mem.key_terms.length > 0) parts.push(`关键词: ${mem.key_terms.join(', ')}`);
  if (mem.recent_progress && mem.recent_progress.length > 0) {
    parts.push(`近期进展:\n${mem.recent_progress.slice(0, 5).map((p, i) => `  ${i + 1}. ${p}`).join('\n')}`);
  }
  if (mem.known_blockers && mem.known_blockers.length > 0) {
    parts.push(`已知障碍:\n${mem.known_blockers.slice(0, 5).map((b, i) => `  ${i + 1}. ${b}`).join('\n')}`);
  }
  if (mem.skill_history && mem.skill_history.length > 0) {
    parts.push(`技能评估历史: ${mem.skill_history.slice(0, 3).map(s => s.skill).join(', ')}`);
  }
  return parts.length > 0 ? parts.join('\n') : '';
}

// Inject memory context into a messages array (prepend to system message)
export function injectContext(messages, studentId) {
  const ctx = getContextString(studentId);
  if (!ctx || messages.length === 0) return messages;
  const sysIdx = messages.findIndex(m => m.role === 'system');
  if (sysIdx >= 0) {
    const newMessages = [...messages];
    newMessages[sysIdx] = { ...newMessages[sysIdx], content: newMessages[sysIdx].content + '\n\n【学生上下文记忆】\n' + ctx };
    return newMessages;
  }
  return [{ role: 'system', content: '【学生上下文记忆】\n' + ctx }, ...messages];
}

// Cordis form (W3 zero-change)
export function apply(ctx, config) {
  ctx.exports = ctx.exports || {};
  ctx.exports.memory = { loadMemory, saveMemory, updateMemory, accumulateFromReport, accumulateFromChat, accumulateFromSkill, accumulateFromTask, getContextString, injectContext };
}