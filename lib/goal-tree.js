// lib/goal-tree.js - Value Goal Tree
// Every student's topic on a branch, everyone sees dependencies.
// Trunk = group research directions -> Branches = student projects -> Leaves = tasks

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load as parseYaml } from 'js-yaml';
import { loadTasks } from './kanban.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getRoster() {
  const p = join(__dirname, '..', 'labos', 'students.yaml');
  if (!existsSync(p)) return [];
  return (parseYaml(readFileSync(p, 'utf8')).students || []);
}

function getGroupDirections() {
  try {
    const g = JSON.parse(readFileSync(join(__dirname,'..','labos','valuecycles','group.json'),'utf8'));
    return g.research_directions || [];
  } catch { return []; }
}

function matchDirection(project, directions) {
  if (!project) return null;
  const p = project.toLowerCase();
  for (const d of directions) {
    const dl = d.toLowerCase().replace(/[（）()]/g,'');
    if (dl.includes(p.slice(0,4)) || p.includes(dl.slice(0,4))) return d;
  }
  if (p.includes('韧性') || p.includes('可靠性')) return directions.find(d=>d.includes('韧性')) || null;
  if (p.includes('v2g') || p.includes('电动汽车') || p.includes('ev') || p.includes('充电')) return directions.find(d=>d.includes('电网互动')) || null;
  if (p.includes('微电网') || p.includes('分布式') || p.includes('算电')) return directions.find(d=>d.includes('算电')) || null;
  if (p.includes('氢')) return directions.find(d=>d.includes('氢')) || null;
  if (p.includes('储能') && p.includes('移动')) return directions.find(d=>d.includes('移动储能')) || null;
  if (p.includes('datacenter') || p.includes('ai ')) return directions.find(d=>d.includes('datacenter')||d.includes('AI')) || null;
  return null;
}

function getVc(studentId) {
  try {
    return JSON.parse(readFileSync(join(__dirname,'..','labos','valuecycles',studentId+'.json'),'utf8'));
  } catch { return null; }
}

export function buildValueGoalTree() {
  const directions = getGroupDirections();
  const roster = getRoster().filter(s => s.role !== 'teacher');
  const taskData = loadTasks();
  const allTasks = taskData.tasks || [];

  const tree = directions.map(dir => ({
    type: 'direction',
    name: dir,
    students: [],
    task_count: 0,
    done_count: 0,
    expanded: false,
  }));

  const unassigned = { type: 'direction', name: '未分类', students: [], task_count: 0, done_count: 0, expanded: false };
  const crossCutting = { type: 'direction', name: '论文/投稿（跨方向）', students: [], task_count: 0, done_count: 0, expanded: false };
  const today = new Date().toISOString().slice(0,10);

  for (const s of roster) {
    const vc = getVc(s.id);
    const myTasks = allTasks.filter(t => t.owner_student_id === s.id);
    const doneCount = myTasks.filter(t => t.status === 'done').length;
    const overdueCount = myTasks.filter(t => t.status !== 'done' && t.deadline && t.deadline < today).length;

    const studentNode = {
      type: 'student',
      id: s.id,
      name: s.name,
      project: s.project || '未指定',
      role: s.role,
      research_stage: vc?.research?.stage || 'unknown',
      artifacts: vc?.research?.artifacts || [],
      primary_goal: vc?.personal_goals?.primary || '',
      alignment_score: vc?.alignment?.value_score || 0,
      readiness: vc?.alignment?.readiness || 'not_set',
      task_count: myTasks.length,
      done_count: doneCount,
      overdue_count: overdueCount,
      progress_pct: myTasks.length ? Math.round(doneCount / myTasks.length * 100) : 0,
      tasks: myTasks.slice(0, 8).map(t => ({
        id: t.task_id,
        title: t.title,
        status: t.status,
        deadline: t.deadline,
        priority: t.priority,
      })),
      dependencies: [],
    };

    const dir = matchDirection(s.project, directions);
    if (s.project && (s.project.includes('论文') || s.project.includes('投稿') || s.project.includes('SCI'))) {
      crossCutting.students.push(studentNode);
      crossCutting.task_count += myTasks.length;
      crossCutting.done_count += doneCount;
    } else if (dir) {
      const branch = tree.find(b => b.name === dir);
      if (branch) {
        branch.students.push(studentNode);
        branch.task_count += myTasks.length;
        branch.done_count += doneCount;
      } else {
        unassigned.students.push(studentNode);
        unassigned.task_count += myTasks.length;
        unassigned.done_count += doneCount;
      }
    } else {
      unassigned.students.push(studentNode);
      unassigned.task_count += myTasks.length;
      unassigned.done_count += doneCount;
    }
  }

  for (const branch of [...tree, crossCutting, unassigned]) {
    for (const s of branch.students) {
      const peers = branch.students.filter(p => p.id !== s.id);
      s.dependencies = peers.slice(0, 5).map(p => ({
        student_id: p.id,
        student_name: p.name,
        relation: '同方向协作',
      }));
    }
  }

  const allBranches = [...tree];
  if (crossCutting.students.length) allBranches.push(crossCutting);
  if (unassigned.students.length) allBranches.push(unassigned);

  return {
    root: '课题组价值目标树',
    directions: allBranches,
    stats: {
      total_directions: directions.length,
      total_students: roster.length,
      total_tasks: allTasks.length,
      total_done: allTasks.filter(t => t.status === 'done').length,
      total_overdue: allTasks.filter(t => t.status !== 'done' && t.deadline && t.deadline < today).length,
    },
    updated_at: new Date().toISOString(),
  };
}

export function getDependencyMap() {
  const tree = buildValueGoalTree();
  const links = [];
  for (const branch of tree.directions) {
    for (const s of branch.students) {
      for (const dep of s.dependencies) {
        links.push({ from: s.id, to: dep.student_id, label: dep.relation, direction: branch.name });
      }
    }
  }
  return {
    nodes: tree.directions.flatMap(b => b.students.map(s => ({ id: s.id, name: s.name, direction: b.name }))),
    links,
  };
}

export function apply(ctx, config) {
  ctx.goalTree = { build: buildValueGoalTree, deps: getDependencyMap };
}
