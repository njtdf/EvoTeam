import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const COURSE_DIR = join(__dirname, '..', 'labos', 'courses')

/** Load a course by file name (without extension) */
export function loadCourse(courseName) {
  const path = join(COURSE_DIR, courseName + '.json')
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** List all courses */
export function listCourses() {
  if (!existsSync(COURSE_DIR)) return []
  return readdirSync(COURSE_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const name = f.replace('.json', '')
      const data = loadCourse(name)
      return {
        name,
        title: data?.name_cn || name,
        code: data?.code || '',
        semester: data?.semester || '',
        credits: data?.credits || 0,
        instructors: data?.instructors || [],
        current_week: data?.current_week || 1,
        total_weeks: data?.schedule?.length || 0
      }
    })
}

/** Get a specific course with full detail + computed fields */
export function getCourseDetail(courseName) {
  const data = loadCourse(courseName)
  if (!data) return null

  const currentWeek = data.current_week || 1
  const totalWeeks = data.schedule ? data.schedule.length : 17
  const progressPct = Math.round((currentWeek / totalWeeks) * 100)

  const schedule = (data.schedule || []).map(w => ({
    ...w,
    chapter_titles: (w.chapters || []).map(ch => {
      const c = (data.chapters || []).find(c => c.ch === ch)
      return c ? c.title : ''
    }),
    is_current: w.week === currentWeek,
    is_past: w.week < currentWeek,
    is_future: w.week > currentWeek
  }))

  return {
    ...data,
    schedule,
    progress_pct: progressPct,
    total_weeks: totalWeeks,
    completed_hours: schedule.filter(w => w.is_past).reduce((s, w) => s + w.hours, 0),
    total_hours_done: schedule.filter(w => !w.is_future).reduce((s, w) => s + w.hours, 0)
  }
}

/** Update current week (teacher only) */
export function updateCurrentWeek(courseName, week) {
  const data = loadCourse(courseName)
  if (!data) return null
  data.current_week = week
  writeFileSync(join(COURSE_DIR, courseName + '.json'), JSON.stringify(data, null, 2), 'utf8')
  return getCourseDetail(courseName)
}

/** Get course progress summary */
export function getCourseProgress(courseName) {
  const data = loadCourse(courseName)
  if (!data) return null
  const totalWeeks = data.schedule ? data.schedule.length : 17
  return {
    name: data.name_cn,
    current_week: data.current_week || 1,
    total_weeks: totalWeeks,
    progress_pct: Math.round(((data.current_week || 1) / totalWeeks) * 100)
  }
}

/** Cordis apply form */
export function apply(ctx, config) {
  ctx.course = { loadCourse, listCourses, getCourseDetail, updateCurrentWeek, getCourseProgress }
}
