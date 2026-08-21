import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const parent = join(__dirname, '..', '..')
const cordis = join(__dirname, '..')

const files = ['CHANGELOG.md', 'DEVLOG.md', 'MANUAL-VERIFICATION-GUIDE.md']

for (const f of files) {
  const parentPath = join(parent, f)
  const cordisPath = join(cordis, f)

  const parentContent = existsSync(parentPath) ? readFileSync(parentPath, 'utf8') : ''
  const cordisContent = existsSync(cordisPath) ? readFileSync(cordisPath, 'utf8') : ''

  let merged = ''

  if (f === 'CHANGELOG.md') {
    if (cordisContent) {
      merged = cordisContent.replace(/\n# Changelog\n/, '\n')
      if (!merged.startsWith('# AutoProf')) {
        merged = '# AutoProf LabOS — Changelog\n\n' + merged.replace(/^# Changelog\s*\n/, '')
      }
    } else {
      merged = parentContent
    }
  } else {
    merged = parentContent || cordisContent
  }

  writeFileSync(parentPath, merged, 'utf8')
  console.log(f + ': merged into AutoProf/ (' + merged.length + ' chars)')

  if (existsSync(cordisPath)) {
    unlinkSync(cordisPath)
    console.log(f + ': deleted from cordis-main/')
  }
}

console.log('Done. All docs now live only in AutoProf/.')
