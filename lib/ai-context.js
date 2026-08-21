// lib/ai-context.js - AI through-line: builds shared context for all AI calls
// Reads from: valuecycle + summary + kanban + meeting + memory
// This is the "贯穿全局" layer — every AI call reads this, breaking function silos

import { loadValueCycle, loadGroupValueCycle, updateValueCycle } from './valuecycle.js';
import { loadSummary } from './summary.js';
import { getTasksByStudent } from './kanban.js';
import { listMeetings, loadActions } from './meeting.js';
import { loadMemory, updateMemory, getContextString as getMemoryContext } from './memory.js';
import { buildMemoryContext } from './llm-memory.js';
import { getEntityGraph } from './ontology.js'

// Get meeting actions assigned to a specific student
function getStudentMeetingActions(studentId) {
  const meetings = listMeetings();
  const actions = [];
  for (const m of meetings) {
    if (!m.has_actions) continue;
    const data = loadActions(m.date);
    if (!data?.actions) continue;
    for (const a of data.actions) {
      if (a.owner_student_id === studentId) {
        actions.push({
          task: a.task || '',
          owner_name: a.owner_name || '',
          deadline: a.deadline || '',
          status: a.status || 'pending',
          date: m.date,
          source_section: a.source_section || ''
        });
      }
    }
  }
  return actions;
}

// Stage labels for readability
const STAGE_LABELS = {
  topic_selection: '选题',
  literature: '文献调研',
  modeling: '建模',
  experimentation: '实验',
  drafting: '撰写',
  submitted: '已投稿',
  revision: '返修',
  published: '已发表'
};

const GOAL_LABELS = {
  graduation: '毕业',
  state_grid: '国网',
  academia: '学术',
  enterprise: '企业',
  startup: '创业'
};

const READINESS_LABELS = {
  not_ready: '未就绪',
  approaching: '接近就绪',
  ready: '就绪'
};

// Build comprehensive context for a student
export function buildStudentContext(studentId) {
  const vc = loadValueCycle(studentId);
  const group = loadGroupValueCycle();
  const summary = loadSummary(studentId);
  const tasks = getTasksByStudent(studentId);
  const actions = getStudentMeetingActions(studentId);
  const memoryCtx = getMemoryContext(studentId);

  const parts = [];

  // --- Group value chain ---
  parts.push('=== 课题组价值链 ===');
  parts.push('研究方向: ' + (group.research_directions || []).join(' | '));
  parts.push('产出目标: ' + (group.outputs || []).join(' | '));
  if (group.industry_partners?.length) {
    parts.push('工业合作: ' + group.industry_partners.join(' | '));
  }

  // --- Student personal value chain ---
  parts.push('');
  parts.push('=== 学生个人价值链 ===');
  parts.push('姓名: ' + vc.student_name + ' (' + vc.student_id + ', ' + vc.role + ')');
  if (vc.filled || vc.personal_goals?.primary) {
    const primary = GOAL_LABELS[vc.personal_goals.primary] || vc.personal_goals.primary || '未填';
    parts.push('主要目标: ' + primary);
    if (vc.personal_goals.secondary?.length) {
      parts.push('次要目标: ' + vc.personal_goals.secondary.join(', '));
    }
    if (vc.personal_goals.career_note) {
      parts.push('职业备注: ' + vc.personal_goals.career_note);
    }
  } else {
    parts.push('主要目标: 未填(学生首次登录后补充)');
  }

  if (vc.research?.project) {
    parts.push('研究课题: ' + vc.research.project);
  }
  const stageLabel = STAGE_LABELS[vc.research?.stage] || vc.research?.stage || '未知';
  parts.push('研究阶段: ' + stageLabel);

  // --- Alignment ---
  parts.push('');
  parts.push('=== 价值对齐 ===');
  if (vc.alignment?.group_outputs?.length) {
    parts.push('贡献于组价值链: ' + vc.alignment.group_outputs.join(', '));
  } else {
    parts.push('贡献于组价值链: 未标注');
  }
  if (vc.alignment?.contribution) {
    parts.push('具体贡献: ' + vc.alignment.contribution);
  }
  if (vc.alignment?.misalignments?.length) {
    parts.push('不对齐项: ' + vc.alignment.misalignments.join('; '));
  } else {
    parts.push('不对齐项: 无');
  }

  // --- Advisor assessment ---
  parts.push('');
  parts.push('=== 导师评估 ===');
  const readiness = READINESS_LABELS[vc.advisor_assessment?.readiness] || '未评估';
  parts.push('就绪度: ' + readiness + ' (' + (vc.advisor_assessment?.value_score || 0) + '/100)');
 if (vc.advisor_assessment?.notes) {
   parts.push('导师备注: ' + vc.advisor_assessment.notes);
 }

  // --- Graduation state (v2.1 W6a) ---
  parts.push('');
  parts.push('=== 毕业状态 ===');
  const gs = vc.graduation_state || {};
  if (gs.degree) parts.push('学位: ' + gs.degree);
  if (gs.expected_graduation) parts.push('预计毕业: ' + gs.expected_graduation);
  parts.push('毕业进度: ' + (gs.progress_pct || 0) + '%');
  parts.push('风险等级: ' + (gs.risk_level || 'unknown'));
  if (gs.requirements?.length) {
    parts.push('毕业要求:');
    for (const r of gs.requirements) {
      parts.push('  - [' + (r.status || 'not_started') + '] ' + r.item);
    }
  }

  // --- Capability radar (v2.1 W6a) ---
  parts.push('');
  parts.push('=== 能力画像 (0-5) ===');
  const cap = vc.capability || {};
  const capLabels = { modeling: '建模', experiment: '实验', writing: '写作', coding: '编程', presentation: '表达', literature: '文献', independence: '独立性' };
  for (const [k, label] of Object.entries(capLabels)) {
    parts.push(label + ': ' + (cap[k] || 0));
  }
  const capAvg = Object.values(cap).reduce((a, b) => a + (b || 0), 0) / 7;
  parts.push('平均: ' + capAvg.toFixed(1));

  // --- Recent rewards (v2.1 W6a) ---
  if (vc.recent_rewards?.length) {
    parts.push('');
    parts.push('=== 近期奖励信号 ===');
    for (const r of vc.recent_rewards.slice(-5)) {
      parts.push('- ' + (r.timestamp || '') + ' ' + (r.signal || '') + ' (' + (r.context || '') + ')');
    }
  }

  // --- Decision log (v2.1 W6a) ---
  if (vc.decision_log?.length) {
    parts.push('');
    parts.push('=== 导师决策记录 (' + vc.decision_log.length + '条) ===');
    for (const d of vc.decision_log.slice(-5)) {
      parts.push('- ' + (d.date || '') + ': ' + (d.decision || '') + ' → ' + (d.outcome || 'pending'));
    }
  }

  // --- Latest AI summary ---
  parts.push('');
  parts.push('=== 最新 AI 总结 ===');
  if (summary) {
    parts.push('总结: ' + (summary.summary || '无'));
    if (summary.risks?.length) {
      parts.push('风险: ' + summary.risks.join('; '));
    }
    if (summary.suggestions?.length) {
      parts.push('建议: ' + summary.suggestions.join('; '));
    }
  } else {
    parts.push('无');
  }

  // --- Current tasks ---
  parts.push('');
  parts.push('=== 当前任务 (' + tasks.length + ') ===');
  if (tasks.length === 0) {
    parts.push('无');
  } else {
    for (const t of tasks.slice(0, 10)) {
      parts.push('- [' + t.status + '] ' + t.title + ' (截止' + (t.deadline || '无') + ', 优先级:' + (t.priority || 'medium') + ')');
    }
  }

  // --- Meeting action items ---
  parts.push('');
  parts.push('=== 会议行动项 (' + actions.length + ') ===');
  if (actions.length === 0) {
    parts.push('无');
  } else {
    for (const a of actions.slice(0, 10)) {
      parts.push('- [' + a.status + '] ' + a.task + ' (来自' + a.date + '会议, 截止' + (a.deadline || '无') + ')');
    }
  }

  // --- Memory context ---
  if (memoryCtx) {
    parts.push('');
    parts.push('=== 历史记忆 ===');
    parts.push(memoryCtx);
  }

  // --- LLM Memory (Wave 8: SQLite cross-session memory) ---
  const llmMemCtx = buildMemoryContext(studentId, 'steward')
  if (llmMemCtx) {
    parts.push('')
    parts.push(llmMemCtx)
  }


  // --- Ontology graph (Roadmap 2.2: AI has the "map") ---
  try {
    const graph = getEntityGraph('student', studentId);
    if (graph.entity && graph.connected.length > 0) {
      parts.push('');
      parts.push('=== 组织地图 (实体关系) ===');
      const byType = {};
      for (const c of graph.connected) {
        const t = c.entity.type;
        if (!byType[t]) byType[t] = [];
        byType[t].push(c);
      }
      for (const [type, items] of Object.entries(byType)) {
        const labels = items.slice(0, 5).map(c => {
          const e = c.entity;
          if (type === 'task') return e.id + '(' + e.status + ')';
          if (type === 'weekly_report') return e.period;
          if (type === 'meeting') return e.date;
          if (type === 'summary') return 'risks:' + (e.risks || []).length;
          if (type === 'project') return e.name;
          return e.id || e.name || e.title || '?';
        }).join(', ');
        parts.push(type + '(' + items.length + '): ' + labels + (items.length > 5 ? ' ...' : ''));
      }
    }
  } catch (e) {
    // ontology not critical, fail silently
  }

  return parts.join('\n');
}

// Write-back: update valuecycle from AI summary output
export async function writeBackFromSummary(studentId, summary) {
  try {
    const vc = loadValueCycle(studentId);
    const now = new Date().toISOString();
    const patch = {};

    // 1. Update last_report_date
    patch.last_report_date = now;

    // 2. Update misalignments from risks
    if (summary.risks?.length) {
      const existing = vc.alignment?.misalignments || [];
      const newOnes = summary.risks.filter(r =>
        !existing.some(e => e.includes(r.slice(0, 10)) || r.includes(e.slice(0, 10)))
      );
      if (newOnes.length) {
        patch.alignment = { ...vc.alignment, misalignments: [...existing, ...newOnes].slice(0, 10) };
      }
    }

    // 3. Update memory blockers from risks
    if (summary.risks?.length) {
      const mem = loadMemory(studentId);
      const existingBlockers = mem.known_blockers || [];
      const newBlockers = summary.risks.filter(r =>
        !existingBlockers.some(e => e.includes(r.slice(0, 10)) || r.includes(e.slice(0, 10)))
      );
      if (newBlockers.length) {
        updateMemory(studentId, { known_blockers: [...existingBlockers, ...newBlockers].slice(0, 10) });
      }
    }

    // 4. W9: AI-assisted capability assessment
    if (vc.capability) {
      const capPatch = { ...vc.capability };
      if (!summary.risks?.some(r => r.includes('写作') || r.includes('论文'))) {
        capPatch.writing = Math.min(5, (capPatch.writing || 0) + 0.1);
      }
      if (summary.risks?.some(r => r.includes('实验') || r.includes('仿真'))) {
        capPatch.experiment = Math.max(0, (capPatch.experiment || 0) - 0.1);
      }
      if (summary.risks?.some(r => r.includes('文献') || r.includes('阅读'))) {
        capPatch.literature = Math.max(0, (capPatch.literature || 0) - 0.1);
      }
      capPatch.independence = Math.min(5, (capPatch.independence || 0) + 0.05);
      patch.capability = capPatch;
    }

    // 5. W9: Trigger reward signals
    try {
      const { recordReward, getRewards } = await import('./lab-state.js');
      recordReward(studentId, 'weekly_report_submitted', 'On-time weekly report submission');
      if (vc.last_report_date) {
        const lastDate = new Date(vc.last_report_date);
        const daysSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince <= 14) {
          recordReward(studentId, 'consecutive_report_streak', daysSince <= 7 ? 'Weekly streak' : 'Bi-weekly streak');
        }
      }
      if (!summary.risks || summary.risks.length === 0) {
        recordReward(studentId, 'low_risk_report', 'No risks detected in latest report');
      }
      // Update recent_rewards in valuecycle
      const recentRewards = getRewards(studentId).slice(-5).map(r => ({
        timestamp: r.timestamp, signal: r.signal, context: r.context,
      }));
      patch.recent_rewards = recentRewards;
    } catch (e) { console.error('[ai-context.js] reward trigger error:', e.message); }

    // 6. W9: Check graduation progress
    if (vc.graduation_state?.requirements) {
      const text = (summary.summary || '').toLowerCase();
      const reqs = vc.graduation_state.requirements.map(r => {
        if (r.status === 'done') return r;
        if (r.category === 'publication' && (text.includes('发表') || text.includes('投稿'))) return { ...r, status: 'in_progress' };
        if (r.category === 'thesis' && (text.includes('论文') || text.includes('thesis'))) return { ...r, status: 'in_progress' };
        if (r.category === 'defense' && text.includes('答辩')) return { ...r, status: 'in_progress' };
        if (r.category === 'proposal' && text.includes('开题')) return { ...r, status: 'in_progress' };
        return r;
      });
      patch.graduation_state = { ...vc.graduation_state, requirements: reqs };
      try {
        const { calculateProgress } = await import('./graduation.js');
        patch.graduation_state.progress_pct = calculateProgress(reqs);
      } catch {}
    }

    updateValueCycle(studentId, patch);
    console.log('[ai-context.js] writeBack complete for', studentId);
  } catch (e) {
    console.error('[ai-context.js] writeBack error:', e.message);
  }
}

// Convenience: inject context into a system prompt
export function injectContextIntoPrompt(systemPrompt, studentId) {
  const ctx = buildStudentContext(studentId);
  if (!ctx) return systemPrompt;
  return systemPrompt + '\n\n--- 学生价值链上下文(贯穿全局) ---\n' + ctx + '\n--- 上下文结束 ---\n\n' +
    '分析时请结合上述上下文:学生的进展是否与其个人目标对齐?是否与课题组价值链对齐?任务和会议行动项是否在推进?\n' +
    '请特别关注学生毕业进度和风险等级:如果风险等级为high或critical,建议是否需要pivot方向或调整节奏。';
}

export default { buildStudentContext, writeBackFromSummary, injectContextIntoPrompt };
