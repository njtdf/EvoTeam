#!/usr/bin/env node
// cli.js - LabOS LabBrief CLI (Phase 1)
// Usage: node cli.js [generate|watch]

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { load as parseYaml } from 'js-yaml'
 import { parseReport, scanReportFiles } from './packages/lab-brief/lib/parser.js'
 import { evaluateRisks } from './packages/lab-brief/lib/risk.js'
 import { generateBrief, renderBriefMarkdown, writeBriefFiles } from './packages/lab-brief/lib/brief.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadConfig() {
  const configPath = join(__dirname, 'labos', 'cordis.yml')
  if (!existsSync(configPath)) {
    console.error(`Config not found: ${configPath}`)
    process.exit(1)
  }
  const raw = readFileSync(configPath, 'utf-8')
  const parsed = parseYaml(raw)
  const plugin = parsed.plugins?.find(p => p.id === 'lab-brief')
  if (!plugin) {
    console.error('lab-brief plugin config not found in cordis.yml')
    process.exit(1)
  }
  return plugin.config
}

function loadStudents(config) {
  const path = join(__dirname, config.students_file)
  if (!existsSync(path)) return []
  const raw = readFileSync(path, 'utf-8')
  const parsed = parseYaml(raw)
  return (parsed.students || []).filter(s => s.active)
}

function detectPeriod() {
  const now = new Date()
  const end = now.toISOString().slice(0, 10)
  const start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return { start, end }
}

function scanReports(config, students) {
  const reportsDir = join(__dirname, config.reports_dir)
  const results = []
  for (const student of students) {
    const files = scanReportFiles(reportsDir, student.id)
    if (files.length > 0) {
      const report = parseReport(files[0])
      results.push(report)
      if (report.parse_errors.length > 0) {
        console.warn(`[${student.id}] Parse errors: ${report.parse_errors.join('; ')}`)
      }
    }
  }
  return results
}

function runGenerate() {
  const config = loadConfig()
  const students = loadStudents(config)
  const reports = scanReports(config, students)
  const period = detectPeriod()
  const risks = evaluateRisks(reports, students, period.start, period.end)
  const brief = generateBrief(reports, risks, students, period.start, period.end)
  const markdown = renderBriefMarkdown(brief)
  writeBriefFiles(brief, markdown, join(__dirname, config.output_dir))
  console.log(`LabBrief generated: ${reports.length} reports, ${risks.length} risks, ${brief.summary.not_submitted.length} not submitted`)
  console.log(`Output: ${join(__dirname, config.output_dir, 'LabBrief.md')}`)
}

const cmd = process.argv[2]
if (cmd === 'generate' || !cmd) {
  runGenerate()
} else if (cmd === 'watch') {
  console.log('Watch mode: starting...')
  runGenerate()
  // Simple watch using fs.watch
  const { watch } = await import('fs')
  const config = loadConfig()
  const reportsDir = join(__dirname, config.reports_dir)
  watch(reportsDir, { recursive: true }, (eventType, filename) => {
    if (!filename?.endsWith('.md')) return
    console.log(`Change detected: ${filename}`)
    setTimeout(() => runGenerate(), config.debounce_ms || 2000)
  })
  console.log(`Watching ${reportsDir} for changes...`)
} else {
  console.error(`Unknown command: ${cmd}`)
  console.error('Usage: node cli.js [generate|watch]')
  process.exit(1)
}
