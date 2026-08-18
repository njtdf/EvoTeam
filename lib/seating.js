// lib/seating.js - F11 Exam Seating Arrangement
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';

const STORAGE = join(import.meta.dirname, '..', 'labos', 'exam-seating');

function ensureDir() {
  if (!existsSync(STORAGE)) mkdirSync(STORAGE, { recursive: true });
}

export function generateSeating({ rows, cols, student_names, mode = 'snake', exam_name = '' }) {
  const names = [...student_names];
  const capacity = rows * cols;
  const students = names.slice(0, capacity);
  while (students.length < capacity) students.push('');

  let arrangement = [];
  if (mode === 'random') {
    for (let i = students.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [students[i], students[j]] = [students[j], students[i]];
    }
  }

  if (mode === 'snake') {
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push({ row: r + 1, col: c + 1, name: students[idx] || '', seat: idx + 1 });
        idx++;
      }
      if (r % 2 === 1) row.reverse();
      arrangement.push(row);
    }
  } else {
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push({ row: r + 1, col: c + 1, name: students[idx] || '', seat: idx + 1 });
        idx++;
      }
      arrangement.push(row);
    }
  }

  const examId = 'exam-' + new Date().toISOString().slice(0, 10) + '-' + Math.random().toString(36).slice(2, 6);
  const data = {
    exam_id: examId,
    exam_name,
    rows, cols, mode,
    capacity,
    assigned: names.length,
    arrangement,
    created_at: new Date().toISOString(),
  };

  ensureDir();
  writeFileSync(join(STORAGE, examId + '.json'), JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

export function loadSeating(examId) {
  const p = join(STORAGE, examId + '.json');
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf-8'));
}

export function listSeatings() {
  ensureDir();
  const files = readdirSync(STORAGE).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      const d = JSON.parse(readFileSync(join(STORAGE, f), 'utf-8'));
      return { exam_id: d.exam_id, exam_name: d.exam_name, rows: d.rows, cols: d.cols, assigned: d.assigned, created_at: d.created_at };
    } catch { return null; }
  }).filter(Boolean).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function deleteSeating(examId) {
  const p = join(STORAGE, examId + '.json');
  if (existsSync(p)) { unlinkSync(p); return true; }
  return false;
}

export function apply(ctx, config) {
  ctx.seating = { generateSeating, loadSeating, listSeatings, deleteSeating };
}