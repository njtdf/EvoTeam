// lib/ideas.js - Inspiration Factory
// AGENT reads daily info + student/teacher ideas -> sparks new research ideas
// Storage: labos/ideas/YYYY-MM-DD-{n}.json

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildValueGoalTree } from './goal-tree.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORAGE = join(__dirname, '..', 'labos', 'ideas');
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

function ensureDir() {
  if (!existsSync(STORAGE)) mkdirSync(STORAGE, { recursive: true });
}

function getApiKey() {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY;
  const envPath = join(__dirname, '..', '.env');
  if (existsSync(envPath)) {
    const raw = readFileSync(envPath, 'utf-8');
    const match = raw.match(/DEEPSEEK_API_KEY\s*=\s*(.+)/);
    if (match) return match[1].trim();
  }
  return null;
}

export function storeIdea({ author_id, author_name, author_role, title, content, tags, source }) {
  ensureDir();
  const now = new Date();
  const date = now.toISOString().slice(0,10);
  const prefix = date + '-';
  let max = 0;
  try {
    for (const f of readdirSync(STORAGE)) {
      if (f.startsWith(prefix) && f.endsWith('.json')) {
        const m = f.match(/-(\d+)\.json$/);
        if (m) max = Math.max(max, parseInt(m[1]));
      }
    }
  } catch {}
  const seq = max + 1;
  const idea = {
    id: date + '-' + String(seq).padStart(3,'0'),
    author_id: author_id || 'unknown',
    author_name: author_name || '',
    author_role: author_role || 'student',
    title: title || '',
    content: content || '',
    tags: Array.isArray(tags) ? tags : [],
    source: source || 'manual',
    status: 'raw',
    created_at: now.toISOString(),
  };
  writeFileSync(join(STORAGE, idea.id + '.json'), JSON.stringify(idea, null, 2), 'utf8');
  return idea;
}

export function listIdeas({ author_id, limit } = {}) {
  ensureDir();
  let files;
  try { files = readdirSync(STORAGE).filter(f => f.endsWith('.json')).sort().reverse(); }
  catch { return []; }
  let ideas = files.map(f => {
    try { return JSON.parse(readFileSync(join(STORAGE, f), 'utf8')); }
    catch { return null; }
  }).filter(Boolean);
  if (author_id) ideas = ideas.filter(i => i.author_id === author_id);
  if (limit) ideas = ideas.slice(0, limit);
  return ideas;
}

export function deleteIdea(id) {
  const path = join(STORAGE, id + '.json');
  if (!existsSync(path)) return false;
  try { unlinkSync(path); return true; } catch { return false; }
}

export function updateIdeaStatus(id, status) {
  const path = join(STORAGE, id + '.json');
  if (!existsSync(path)) return null;
  const idea = JSON.parse(readFileSync(path, 'utf8'));
  idea.status = status;
  idea.updated_at = new Date().toISOString();
  writeFileSync(path, JSON.stringify(idea, null, 2), 'utf8');
  return idea;
}

export function buildSparkContext(dailyBrief) {
  const tree = buildValueGoalTree();
  let ctx = "课题组价值目标树:\n";
  ctx += "研究方向: " + tree.directions.map(d => d.name + "(" + d.students.length + ")").join(", ") + "\n\n";
  ctx += "学生课题分布:\n";
  for (const dir of tree.directions) {
    if (!dir.students.length) continue;
    ctx += dir.name + ":\n";
    for (const s of dir.students) {
      ctx += "  " + s.name + "(" + s.id + ") - " + s.project + " [" + s.research_stage + "] " + s.task_count + "/" + s.done_count + "\n";
    }
  }
  if (dailyBrief) {
    ctx += "\n今日动态:\n";
    if (dailyBrief.overdue_tasks?.length) ctx += "逾期: " + dailyBrief.overdue_tasks.slice(0,5).map(t=>t.title).join("; ") + "\n";
    if (dailyBrief.events?.length) ctx += "外部动态: " + dailyBrief.events.slice(0,5).map(e=>e.title||e.summary||"").join("; ") + "\n";
    if (dailyBrief.news?.length) ctx += "SOTA: " + dailyBrief.news.slice(0,5).map(n=>n.title||"").join("; ") + "\n";
  }
  return ctx;
}

export async function sparkIdeasStream(userIdea, dailyBrief, onChunk, signal) {
  const apiKey = getApiKey();
  if (!apiKey) { onChunk("(AI 未配置 - 缺少 DEEPSEEK_API_KEY)"); return; }
  const ctx = buildSparkContext(dailyBrief);
  const prompt = "你是课题组的灵感工厂 Agent。根据以下课题组价值目标树和今日动态，结合用户输入的灵感，生成 3 个创新的研究想法。每个想法包含: 标题、理由、新颖性、可行性、建议关联的学生。\n\n" + ctx + "\n用户灵感: " + (userIdea || "无") + "\n\n输出 JSON: {ideas:[{title,rationale,novelty,feasibility,related_students}]}";
  const body = {
    model: 'deepseek-chat',
    messages: [
      { role: "system", content: "你是电力系统韧性领域的资深科学家，专注产出可执行、有新意的研究想法。" },
      { role: "user", content: prompt },
    ],
    stream: true,
    temperature: 0.9,
    max_tokens: 2000,
  };
  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify(body),
      signal,
    });
    if (!resp.ok) { onChunk("API error " + resp.status); return; }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          const json = JSON.parse(data);
          const chunk = json.choices?.[0]?.delta?.content;
          if (chunk) onChunk(chunk);
        } catch {}
      }
    }
  } catch(e) {
    if (e.name !== "AbortError") onChunk("Error: " + e.message);
  }
}

export function apply(ctx, config) {
  ctx.ideas = { store: storeIdea, list: listIdeas, spark: sparkIdeasStream, context: buildSparkContext, status: updateIdeaStatus, delete: deleteIdea };
}
