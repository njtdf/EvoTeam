import { readFileSync, writeFileSync } from 'fs'
const lines = readFileSync('lib/ai-context.js', 'utf-8').split('\n')

// Replace lines 229-262 (0-indexed 228-261) with W9 enhanced version
const startIdx = lines.findIndex(l => l.includes('export async function writeBackFromSummary'))
const endIdx = lines.findIndex((l, i) => i > startIdx + 5 && l.trim() === '}')

if (startIdx === -1 || endIdx === -1) {
  console.error('FATAL: could not find writeBackFromSummary boundaries. start=' + startIdx + ' end=' + endIdx)
  process.exit(1)
}

console.log('Replacing lines', startIdx + 1, 'to', endIdx + 1)

const newFunc = `export async function writeBackFromSummary(studentId, summary) {
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
}`

// Replace the function
lines.splice(startIdx, endIdx - startIdx + 1, newFunc)
writeFileSync('lib/ai-context.js', lines.join('\n'), 'utf-8')
console.log('OK: writeBackFromSummary replaced for W9')
