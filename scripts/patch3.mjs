import { readFileSync, writeFileSync } from 'fs'
const html = readFileSync('public/teacher.html', 'utf8')
const old = `          <div class="decision-item" v-for="(d, i) in selectedVcStudent.decision_log" :key="i">
            <span class="decision-date">{{ d.date }}</span>
            <span class="decision-text">{{ d.decision }}</span>
            <span class="decision-outcome" :class="'outcome-' + d.outcome">{{ d.outcome }}</span>
          </div>
        </div>
        <div class="form-row" style="margin-top:8px">
          <input type="text" v-model="newDecision.text" placeholder="决策内容..." class="form-input" style="flex:1" />
          <input type="text" v-model="newDecision.rationale" placeholder="理由..." class="form-input" style="flex:1" />
          <button class="btn btn-sm btn-primary" @click="addDecision">+决策</button>
        </div>`

const replacement = `          <div class="decision-item" v-for="d in decisionsList" :key="d.decision_id" style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #eee">
            <span class="decision-date" style="font-size:12px;color:#888;min-width:80px">{{ d.date }}</span>
            <span class="decision-text" style="flex:1">{{ d.decision }}</span>
            <span v-if="d.rationale" style="font-size:12px;color:#999">({{ d.rationale }})</span>
            <select v-if="user.role==='teacher'" :value="d.outcome" @change="updateDecisionOutcome(d.decision_id, $event.target.value)" class="form-input" style="width:auto;font-size:12px;padding:2px 4px">
              <option value="pending">待定</option>
              <option value="positive">正向</option>
              <option value="neutral">中性</option>
              <option value="negative">负向</option>
            </select>
            <span v-else class="decision-outcome" :class="'outcome-' + d.outcome">{{ d.outcome }}</span>
            <button v-if="user.role==='teacher'" class="btn btn-sm" style="padding:2px 6px;font-size:12px" @click="deleteDecision(d.decision_id)">删除</button>
          </div>
          <div v-if="decisionsStats" style="margin-top:8px;font-size:12px;color:#888">
            共 {{ decisionsStats.total }} 条 | {{ decisionsStats.outcome_breakdown?.positive || 0 }} 正向 / {{ decisionsStats.outcome_breakdown?.negative || 0 }} 负向
          </div>
        </div>
        <div v-if="user.role==='teacher'" class="form-row" style="margin-top:8px">
          <input type="text" v-model="newDecision.text" placeholder="决策内容..." class="form-input" style="flex:1" />
          <input type="text" v-model="newDecision.rationale" placeholder="理由..." class="form-input" style="flex:1" />
          <button class="btn btn-sm btn-primary" @click="addDecision">+决策</button>
        </div>`

if (!html.includes(old)) { console.error('NOT FOUND'); process.exit(1) }
writeFileSync('public/teacher.html', html.replace(old, replacement))
console.log('OK teacher.html')
