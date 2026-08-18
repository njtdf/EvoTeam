// summary.js - AI report summarization
// Generates and caches summaries for student reports

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { generateSummary } from './ai.js'
import { parseReport } from '../packages/lab-brief/lib/parser.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function summaryPath(studentId) {
  return join(__dirname, '..', 'labos', 'summaries', `${studentId}.json`)
}

// Load cached summary for a student
export function loadSummary(studentId) {
  const path = summaryPath(studentId)
  if (!existsSync(path)) return null
  try {
    const raw = readFileSync(path, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// Generate summary and save to cache
export async function generateAndSaveSummary(reportFilePath) {
  const report = parseReport(reportFilePath)
  const studentId = report.meta.student_id
  if (!studentId) throw new Error('Report missing student_id')

  const summary = await generateSummary(report)

  const result = {
    student_id: studentId,
    student_name: report.meta.name,
    generated_at: new Date().toISOString(),
    report_file: reportFilePath.replace(/\\/g, '/'),
    ...summary,
  }

  const dir = join(__dirname, '..', 'labos', 'summaries')
  mkdirSync(dir, { recursive: true })
  writeFileSync(summaryPath(studentId), JSON.stringify(result, null, 2), 'utf-8')

  return result
}

// Check if summary is fresh (generated after report last modified)
export function isSummaryFresh(studentId, reportMtime) {
  const summary = loadSummary(studentId)
  if (!summary) return false
  const summaryTime = new Date(summary.generated_at).getTime()
  return summaryTime > reportMtime
}
