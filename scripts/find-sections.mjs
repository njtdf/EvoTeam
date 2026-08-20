import fs from 'fs';

const s = fs.readFileSync('public/teacher.html', 'utf8');
const lines = s.split('\n');

// Find structural markers: tab v-if lines, section comments, sidebar nav items
const re = /v-if="activeTab\s*===|<!--\s*(核心|学生|Agent|科研|教学)|nav-section|nav-item|switchTo[A-Z]|id="agentPanel"|kb-search|kb-file|dashboard-view|class="welcome|sub-tab|agentSubTab|v-if="agentSubTab/;

lines.forEach((l, i) => {
  const t = l.trim();
  if (re.test(l)) console.log(`${i + 1}: ${t}`);
});
