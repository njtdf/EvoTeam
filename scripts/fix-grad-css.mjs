import { readFileSync, writeFileSync } from 'fs'
const css = readFileSync('public/css/app.css', 'utf-8')

// 1. Fix: graduation-view student-select visibility
const fix1 = `
/* v0.7.11 Fix: graduation select visible on light background */
.graduation-view .student-select,
.graduation-header .student-select {
  background: #fff !important;
  color: #333 !important;
  border: 1px solid #d9d9d9 !important;
  box-shadow: 0 2px 4px rgba(0,0,0,0.06);
}
.graduation-view .student-select:focus {
  border-color: #07C160 !important;
  box-shadow: 0 0 0 2px rgba(7,193,96,0.15);
}
.graduation-view .student-select option {
  color: #333 !important;
}

/* Fix: graduation bar class name mismatch */
.graduation-bar-container {
  width: 100%; height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden; margin: 8px 0;
}
.graduation-bar-fill {
  height: 100%; border-radius: 10px; transition: width 0.3s; min-width: 2%;
}

/* Fix: risk badge */
.risk-badge {
  display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 13px; font-weight: 600;
  margin: 4px 0;
}
.risk-badge.risk-low { background: #e8f5e9; color: #2e7d32; }
.risk-badge.risk-medium { background: #fff3e0; color: #e65100; }
.risk-badge.risk-high { background: #ffebee; color: #c62828; }
.risk-badge.risk-critical { background: #fce4ec; color: #880e4f; }
.risk-badge.risk-unknown { background: #f5f5f5; color: #616161; }

/* Graduation requirement items */
.grad-req-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0; font-size: 14px;
}
.grad-req-item.done { color: #4caf50; }
.grad-req-item.in_progress { color: #ff9800; }
.grad-req-status-select {
  border: 1px solid #d9d9d9; border-radius: 4px; padding: 2px 6px; font-size: 12px;
  background: #fff; color: #333;
}
`

const insertBefore = '/* v2.1 W6a: Graduation / Capability / Decision */'
if (!css.includes(insertBefore)) { console.error('FATAL: marker not found'); process.exit(1) }
writeFileSync('public/css/app.css', css.replace(insertBefore, fix1 + '\n' + insertBefore), 'utf-8')
console.log('OK: app.css graduation fixes')
