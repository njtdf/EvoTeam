import { appendFileSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
const parentDir = join(process.cwd(), '..')

// CHANGELOG
const clPath = join(parentDir, 'CHANGELOG.md')
const cl = readFileSync(clPath, 'utf-8')
const entry = [
  '## [0.7.10] - 2026-08-21',
  '',
  '### Added',
  '- **W9 writeBackFromSummary**: real state transition — auto-update capability, trigger rewards, detect graduation progress from report content',
  '- **W10 external-events.js**: external perception layer (RSS news + email to unified events to LabState injection), 6 API routes',
  '- **W12 skill-extractor.js**: semi-auto skill extraction from trajectories (how_to + code_snippet patterns), 4 API routes',
  '- **W14 LabOS Cockpit**: /api/cockpit global aggregation endpoint (labState + boardStats + riskRadar + growth + graduation + events + rewards)',
  '- **W15 Value Cycle Dashboard**: /api/value-cycle-dashboard alignment scoring (graduation 40% + tasks 30% + reports 20% + risk-inverse 10%), team_score + per-student breakdown',
  '- 16 new API routes total across W9/W10/W12/W14/W15',
  '',
  '### Changed',
  '- ai-context.js writeBackFromSummary fully rewritten (7-step state transfer)',
  '- HTML cache params bumped to ?v=0710',
  '- APP_VERSION to 0.7.10',
  '',
  '### Roadmap 2.1 Status',
  '- W6a-W10, W12, W14-W15: Complete',
  '- W6c: deferred (requires manual data entry by PI)',
  '- W11 (AG-UI), W13 (A2A): deferred (require frontend framework rebuild + cordis runtime)',
  '',
  '',
].join('\n')

const lines = cl.split('\n')
const idx = lines.findIndex(l => l.startsWith('## [0.7.9'))
if (idx >= 0) {
  lines.splice(idx, 0, ...entry.split('\n'))
  writeFileSync(clPath, lines.join('\n'), 'utf-8')
  console.log('OK CHANGELOG')
} else {
  writeFileSync(clPath, entry + cl, 'utf-8')
  console.log('OK CHANGELOG prepended')
}
