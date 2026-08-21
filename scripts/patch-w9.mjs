import { readFileSync, writeFileSync } from 'fs'
const js = readFileSync('lib/ai-context.js', 'utf8')

// Replace writeBackFromSummary with W9 enhanced version
const oldFunc = `export async function writeBackFromSummary(studentId, summary) {
  try {
    const vc = loadValueCycle(studentId);
    // Update misalignments from risks (lightweight, non-destructive)
    if (summary.risks?.length) {
      const existing = vc.alignment?.misalignments || [];
      const newOnes = summary.risks.filter(r =>
        !existing.some(e => e.includes(r.slice(0, 10)) || r.includes(e.slice(0, 10)))
      );
      if (newOnes.length) {
        const merged = [...existing, ...newOnes].slice(0, 10);
        updateValueCycle(studentId, {
          alignment: { ...vc.alignment, misalignments: merged }
        });
      }
    }

    // Update memory blockers from risks
    if (summary.risks?.length) {
      const mem = loadMemory(studentId);
      const existingBlockers = mem.known_blockers || [];
      const newBlockers = summary.risks.filter(r =>
        !existingBlockers.some(e => e.includes(r.slice(0, 10)) || r.includes(e.slice(0, 10)))
      );
      if (newBlockers.length) {
        const merged = [...existingBlockers, ...newBlockers].slice(0, 10);
        updateMemory(studentId, { known_blockers: merged });
      }
    }
  } catch (e) {
    console.error('[ai-context.js] writeBack error:', e.message);
  }
}`

const newFunc = `export async function writeBackFromSummary(studentId, summary) {
  try {
    const vc = loadValueCycle(studentId);
    const now = new Date().toISOString();
    const patch = {};

    // 1. Update last_report_date
    patch.last_report_date = now;

    // 2. Update misalignments from risks (lightweight, non-destructive)
    if (summary.risks?.length) {
      const existing = vc.alignment?.misalignments || [];
      const newOnes = summary.risks.filter(r =>
        !existing.some(e => e.includes(r.slice(0, 10)) || r.includes(e.slice(0, 10)))
      );
      if (newOnes.length) {
        const merged = [...existing, ...newOnes].slice(0, 10);
        patch.alignment = { ...vc.alignment, misalignments: merged };
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
        const merged = [...existingBlockers, ...newBlockers].slice(0, 10);
        updateMemory(studentId, { known_blockers: merged });
      }
    }

    // 4. W9: AI-assisted capability assessment — bump capabilities based on summary content
    if (vc.capability) {
      const capPatch = { ...vc.capability };
      const text = (summary.summary || '') + ' ' + (summary.suggestions || []).join(' ');
      // Heuristic: if no risks about writing, bump writing; if risks mention "experiment", flag experiment
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
      const { recordReward } = await import('./lab-state.js');
      // Reward: on-time submission
      recordReward(studentId, 'weekly_report_submitted', 'On-time weekly report submission');

      // Check consecutive submissions (heuristic: if last_report_date existed within 14 days before this one)
      if (vc.last_report_date) {
        const lastDate = new Date(vc.last_report_date);
        const daysSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince <= 14) {
          recordReward(studentId, 'consecutive_report_streak', daysSince <= 7 ? 'Weekly streak' : 'Bi-weekly streak');
        }
      }

      // Reward: low risk (no risks detected)
      if (!summary.risks || summary.risks.length === 0) {
        recordReward(studentId, 'low_risk_report', 'No risks detected in latest report');
      }
    } catch (e) {
      console.error('[ai-context.js] reward trigger error:', e.message);
    }

    // 6. W9: Update recent_rewards in valuecycle
    try {
      const { getRewards } = await import('./lab-state.js');
      const recentRewards = getRewards(studentId).slice(-5).map(r => ({
        timestamp: r.timestamp,
        signal: r.signal,
        context: r.context,
      }));
      patch.recent_rewards = recentRewards;
    } catch (e) {
      // Non-critical
    }

    // 7. W9: Check graduation progress — if report mentions thesis/publication, update relevant requirements
    if (vc.graduation_state?.requirements) {
      const text = (summary.summary || '').toLowerCase();
      const reqs = vc.graduation_state.requirements.map(r => {
        if (r.status === 'done') return r;
        const label = r.label.toLowerCase();
        // Heuristic: if summary mentions publication and req is about publication
        if (r.category === 'publication' && (text.includes('发表') || text.includes('投稿') || text.includes('submitted'))) {
          return { ...r, status: 'in_progress' };
        }
        // If summary mentions thesis/论文 and req is about thesis
        if (r.category === 'thesis' && (text.includes('论文') || text.includes('thesis') || text.includes('初稿'))) {
          return { ...r, status: 'in_progress' };
        }
        // If summary mentions 答辩 and req is about defense
        if (r.category === 'defense' && text.includes('答辩')) {
          return { ...r, status: 'in_progress' };
        }
        // If summary mentions 开题
        if (r.category === 'proposal' && text.includes('开题')) {
          return { ...r, status: 'in_progress' };
        }
        return r;
      });
      patch.graduation_state = { ...vc.graduation_state, requirements: reqs };
      // Recalculate progress
      try {
        const { calculateProgress } = await import('./graduation.js');
        patch.graduation_state.progress_pct = calculateProgress(reqs);
      } catch (e) {
        // Non-critical
      }
    }

    updateValueCycle(studentId, patch);
    console.log('[ai-context.js] writeBack complete for', studentId);
  } catch (e) {
    console.error('[ai-context.js] writeBack error:', e.message);
  }
}`

if (!js.includes(oldFunc)) {
  console.error('FATAL: writeBackFromSummary not found')
  process.exit(1)
}
writeFileSync('lib/ai-context.js', js.replace(oldFunc, newFunc), 'utf-8')
console.log('OK: ai-context.js writeBackFromSummary upgraded for W9')
