// lib/workload.js - F13 Teaching & Research Workload Calculator
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const STORAGE = join(import.meta.dirname, '..', 'labos', 'workload');

function ensureDir() {
  if (!existsSync(STORAGE)) mkdirSync(STORAGE, { recursive: true });
}

// Default coefficients (editable by teacher)
const DEFAULT_COEFFS = {
  teaching: {
    course_types: { theory: 1.0, experiment: 0.8, practice: 0.9, seminar: 0.7 },
    class_size_factor: { small: 1.0, medium: 1.2, large: 1.5 }, // <30, 30-60, >60
  },
  research: {
    journal_tier: { SCI1: 12, SCI2: 8, SCI3: 4, EI: 2, core: 1.5, other: 0.5 },
    project_level: { national: 20, provincial: 10, municipal: 5, university: 2 },
    student_supervision: { grad_master: 2, grad_phd: 4, undergrad_thesis: 0.5 },
  },
};

export function loadCoefficients() {
  ensureDir();
  const p = join(STORAGE, 'coefficients.json');
  if (!existsSync(p)) {
    writeFileSync(p, JSON.stringify(DEFAULT_COEFFS, null, 2), 'utf-8');
    return DEFAULT_COEFFS;
  }
  return JSON.parse(readFileSync(p, 'utf-8'));
}

export function saveCoefficients(coeffs) {
  ensureDir();
  writeFileSync(join(STORAGE, 'coefficients.json'), JSON.stringify(coeffs, null, 2), 'utf-8');
  return coeffs;
}

export function calculateWorkload({ year, courses = [], papers = [], projects = [], students_supervised = [] }) {
  const coeffs = loadCoefficients();
  let teachingPoints = 0;
  let researchPoints = 0;
  const teachingDetails = [];
  const researchDetails = [];

  // Normalize inputs: accept counts (numbers) or arrays (detailed objects)
  const papersArr = Array.isArray(papers) ? papers : (typeof papers === 'number' ? [{ tier: 'other', count: papers }] : []);
  const projectsArr = Array.isArray(projects) ? projects : (typeof projects === 'number' ? [{ level: 'university', role: 'PI', count: projects }] : []);
  const studentsArr = Array.isArray(students_supervised) ? students_supervised : (typeof students_supervised === 'number' ? [{ type: 'grad_master', count: students_supervised }] : []);

  // Teaching workload
  for (const c of courses) {
    const typeFactor = coeffs.teaching.course_types[c.type] || 1.0;
    const sizeFactor = coeffs.teaching.class_size_factor[c.size_class] || 1.0;
    const points = (c.hours || 0) * typeFactor * sizeFactor;
    teachingPoints += points;
    teachingDetails.push({ ...c, type_factor: typeFactor, size_factor: sizeFactor, points: points.toFixed(1) });
  }

  // Research: papers
  for (const p of papersArr) {
    const factor = coeffs.research.journal_tier[p.tier] || 0.5;
    const points = factor * (p.count || 1);
    researchPoints += points;
    researchDetails.push({ ...p, factor, points: points.toFixed(1) });
  }

  // Research: projects
  for (const p of projectsArr) {
    const factor = coeffs.research.project_level[p.level] || 2;
    const points = factor * (p.role === 'PI' ? 1.0 : 0.3);
    researchPoints += points;
    researchDetails.push({ ...p, factor, role_factor: p.role === 'PI' ? 1.0 : 0.3, points: points.toFixed(1) });
  }

  // Research: student supervision
  for (const s of studentsArr) {
    const factor = coeffs.research.student_supervision[s.type] || 1;
    researchPoints += factor;
    researchDetails.push({ ...s, factor, points: factor.toFixed(1) });
  }

  const total = teachingPoints + researchPoints;
  const result = {
    year,
    teaching_points: teachingPoints.toFixed(1),
    research_points: researchPoints.toFixed(1),
    total_points: total.toFixed(1),
    teaching_details: teachingDetails,
    research_details: researchDetails,
    calculated_at: new Date().toISOString(),
  };

  ensureDir();
  writeFileSync(join(STORAGE, year + '.json'), JSON.stringify(result, null, 2), 'utf-8');
  return result;
}

export function loadWorkload(year) {
  const p = join(STORAGE, year + '.json');
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf-8'));
}

export function listWorkloads() {
  ensureDir();
  const dir = STORAGE;
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => /^\d{4}\.json$/.test(f)).map(f => f.replace('.json', '')).sort().reverse();
}

export function apply(ctx, config) {
  ctx.workload = { calculateWorkload, loadWorkload, loadCoefficients, saveCoefficients };
}
