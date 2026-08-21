import { readFileSync } from 'fs'

const html = readFileSync('public/teacher.html', 'utf8')
const js = readFileSync('public/js/teacher.js', 'utf8')

const tabsMatch = js.match(/validTabs\s*=\s*\[([^\]]+)\]/)
const tabs = tabsMatch ? tabsMatch[1].match(/'(\w+)'/g).map(t => t.replace(/'/g, '')) : []

console.log('Tab               Block  Size    Placeholder')
console.log('─'.repeat(55))

for (const tab of tabs) {
  // Find v-if block for this tab
  const regex = new RegExp("v-if=\"activeTab==='" + tab + "'\"[\\s\\S]*?(?=v-if=\"activeTab===|$)")
  const blockMatch = html.match(regex)
  const blockSize = blockMatch ? blockMatch[0].length : 0
  const hasBlock = blockSize > 0
  const isPlaceholder = blockMatch ? (blockMatch[0].includes('即将上线') || blockMatch[0].includes('empty-state') || blockSize < 200) : true
  const status = !hasBlock ? 'MISSING' : (isPlaceholder ? 'PLACEHOLDER' : 'MVP')
  console.log(tab.padEnd(18) + String(hasBlock).padEnd(7) + String(blockSize).padEnd(8) + status)
}
