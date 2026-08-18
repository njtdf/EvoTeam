// lib/lesson.js - F15 Lesson Plan / Lecture Notes Generator
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { chatStream, hasApiKey } from './ai.js';

const STORAGE = join(import.meta.dirname, '..', 'labos', 'lessons');

function ensureDir() {
  if (!existsSync(STORAGE)) mkdirSync(STORAGE, { recursive: true });
}

const SYSTEM_PROMPT = `You are an expert university professor creating a lesson plan. Generate a structured Chinese lesson plan in Markdown format with these sections:

## 教学目标
- 知识目标 (knowledge goals)
- 能力目标 (skill goals)
- 素养目标 (attitude goals)

## 教学重难点
- 重点 (key points)
- 难点 (difficulties)

## 时间分配
| 环节 | 时间 | 内容 |
|---|---|---|

## 教学过程
### 导入 (5 min)
### 新课讲授 (60 min)
### 练习/讨论 (15 min)
### 小结 (5 min)

## 板书设计

## 作业布置

## 演讲稿大纲
(A bullet-point lecture script outline, conversational tone)

Be specific and practical. Use Chinese. Total class time is 90 minutes.`;

export async function generateLesson({ course, chapter, topic, textbook = '', extra = '' }, onChunk) {
  if (!hasApiKey()) {
    return { content: generateTemplate(course, chapter, topic), source: 'no_api_key' };
  }

  const userMsg = `课程: ${course}
章节: ${chapter}
主题: ${topic}
${textbook ? '教材参考: ' + textbook : ''}
${extra ? '补充说明: ' + extra : ''}

请生成完整的教案和演讲稿大纲。`;

  let fullContent = '';
  await chatStream(
    [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg }],
    (chunk) => { fullContent += chunk; if (onChunk) onChunk(chunk); }
  );

  ensureDir();
  const safeName = (course + '-' + chapter).replace(/[^\u4e00-\u9fa5a-zA-Z0-9-]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = safeName + '-' + dateStr + '.md';
  writeFileSync(join(STORAGE, filename), fullContent, 'utf-8');

  return { content: fullContent, source: 'ai', filename };
}

function generateTemplate(course, chapter, topic) {
  return `## 教学目标
- 知识目标:
- 能力目标:
- 素养目标:

## 教学重难点
- 重点:
- 难点:

## 时间分配
| 环节 | 时间 | 内容 |
|---|---|---|
| 导入 | 5 min | |
| 新课讲授 | 60 min | |
| 练习讨论 | 15 min | |
| 小结 | 5 min | |
| 作业 | 5 min | |

## 教学过程
### 导入 (5 min)
### 新课讲授 (60 min)
### 练习/讨论 (15 min)
### 小结 (5 min)

## 板书设计

## 作业布置

## 演讲稿大纲
`;
}

export function listLessons() {
  ensureDir();
  const files = readdirSync(STORAGE).filter(f => f.endsWith('.md'));
  return files.map(f => {
    const stat = readFileSync(join(STORAGE, f), 'utf-8');
    return { filename: f, size: stat.length, preview: stat.slice(0, 100) };
  }).sort((a, b) => b.filename.localeCompare(a.filename));
}

export function loadLesson(filename) {
  const p = join(STORAGE, filename);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf-8');
}

export function deleteLesson(filename) {
  const p = join(STORAGE, filename);
  if (existsSync(p)) { unlinkSync(p); return true; }
  return false;
}

export function apply(ctx, config) {
  ctx.lesson = { generateLesson, listLessons, loadLesson, deleteLesson };
}
