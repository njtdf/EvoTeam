// lib/valuecycle.js - ValueCycle data layer
// Per-student value chain + group value chain
// Storage: labos/valuecycles/sXX.json + labos/valuecycles/group.json

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load as parseYaml } from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORAGE = join(__dirname, '..', 'labos', 'valuecycles');

function ensureDir() {
  if (!existsSync(STORAGE)) mkdirSync(STORAGE, { recursive: true });
}

function vcPath(studentId) {
  return join(STORAGE, studentId + '.json');
}

// --- Group value chain ---

export function loadGroupValueCycle() {
  ensureDir();
  const p = join(STORAGE, 'group.json');
  if (!existsSync(p)) {
    const seed = {
      outputs: ['paper', 'patent', 'platform', 'industry_solution', 'social_value'],
      research_directions: [
        '电力系统韧性',
        '分布式算电协同',
        '电动汽车与电网互动(V2G)',
        '氢基综合能源系统韧性',
        '移动储能',
        'AI datacenter'
      ],
      industry_partners: [],
      active_projects: [],
      updated_at: new Date().toISOString()
    };
    saveGroupValueCycle(seed);
    return seed;
  }
  try {
    return JSON.parse(readFileSync(p, 'utf-8'));
  } catch {
    return { outputs: [], research_directions: [], industry_partners: [], active_projects: [] };
  }
}

export function saveGroupValueCycle(data) {
  ensureDir();
  data.updated_at = new Date().toISOString();
  writeFileSync(join(STORAGE, 'group.json'), JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

// --- Student value chain ---

export function loadValueCycle(studentId) {
  ensureDir();
  const p = vcPath(studentId);
  if (!existsSync(p)) return ensureValueCycle(studentId);
  try {
    return JSON.parse(readFileSync(p, 'utf-8'));
  } catch {
    return ensureValueCycle(studentId);
  }
}

export function saveValueCycle(studentId, data) {
  ensureDir();
  data.student_id = studentId;
  data.updated_at = new Date().toISOString();
  writeFileSync(vcPath(studentId), JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

export function updateValueCycle(studentId, patch) {
  const vc = loadValueCycle(studentId);
  const merged = { ...vc };
  for (const [key, val] of Object.entries(patch)) {
    if (val && typeof val === 'object' && !Array.isArray(val) && typeof merged[key] === 'object' && !Array.isArray(merged[key])) {
      merged[key] = { ...merged[key], ...val };
    } else {
      merged[key] = val;
    }
  }
  return saveValueCycle(studentId, merged);
}

// Create empty value cycle from students.yaml
export function ensureValueCycle(studentId) {
  ensureDir();
  const rosterPath = join(__dirname, '..', 'labos', 'students.yaml');
  let student = null;
  if (existsSync(rosterPath)) {
    try {
      const parsed = parseYaml(readFileSync(rosterPath, 'utf-8'));
      student = (parsed.students || []).find(s => s.id === studentId);
    } catch {}
  }

  const seed = {
    student_id: studentId,
    student_name: student?.name || '',
    role: student?.role || 'grad',
    filled: false,
    personal_goals: {
      primary: '',
      secondary: [],
      career_note: ''
    },
    research: {
      project: student?.project || '',
      stage: 'topic_selection',
      artifacts: []
    },
    alignment: {
      group_outputs: [],
      contribution: '',
      misalignments: []
    },
    advisor_assessment: {
      value_score: 0,
      readiness: 'not_ready',
      notes: ''
    },
    domain_tags: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (!existsSync(vcPath(studentId))) {
    writeFileSync(vcPath(studentId), JSON.stringify(seed, null, 2), 'utf-8');
  }
  return seed;
}

// Batch ensure for all students
export function ensureAllValueCycles() {
  const rosterPath = join(__dirname, '..', 'labos', 'students.yaml');
  if (!existsSync(rosterPath)) return [];
  let parsed;
  try {
    parsed = parseYaml(readFileSync(rosterPath, 'utf-8'));
  } catch {
    return [];
  }
  const students = (parsed.students || []).filter(s => s.role !== 'teacher' && s.active !== false);
  return students.map(s => ensureValueCycle(s.id));
}

// Overview of all students' alignment
export function getAllAlignments() {
  ensureDir();
  ensureAllValueCycles();
  const files = readdirSync(STORAGE).filter(f => /^s\d+\.json$/.test(f));
  return files.map(f => {
    try {
      const vc = JSON.parse(readFileSync(join(STORAGE, f), 'utf-8'));
      return {
        student_id: vc.student_id,
        student_name: vc.student_name,
        role: vc.role,
        filled: vc.filled,
        primary_goal: vc.personal_goals?.primary || '',
        research_stage: vc.research?.stage || '',
        project: vc.research?.project || '',
        group_outputs: vc.alignment?.group_outputs || [],
        misalignments: vc.alignment?.misalignments || [],
        value_score: vc.advisor_assessment?.value_score || 0,
        readiness: vc.advisor_assessment?.readiness || 'not_ready',
        domain_tags: vc.domain_tags || []
      };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

// --- Cordis shape (W3 deferred) ---
export function apply(ctx, config = {}) {
  const ns = config.namespace || 'valuecycle';
  if (ctx.reflect?.provide) {
    ctx.reflect.provide(ns, {
      loadValueCycle, saveValueCycle, updateValueCycle,
      loadGroupValueCycle, saveGroupValueCycle,
      ensureValueCycle, ensureAllValueCycles, getAllAlignments
    });
  }
  ctx.effect(() => () => {});
}

export default {
  loadValueCycle, saveValueCycle, updateValueCycle,
  loadGroupValueCycle, saveGroupValueCycle,
  ensureValueCycle, ensureAllValueCycles, getAllAlignments, apply
};
