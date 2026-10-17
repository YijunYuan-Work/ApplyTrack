import { getDateFromKey, getDateKey, getWeekKey, shiftWeek } from './progress.js'

export const progressStages = [
  ['Reached interview', 'var(--color-terracotta)'],
  ['No interview yet', 'var(--color-sea-glass)'],
  ['Rejected before interview', 'var(--color-peach)'],
  ['Offers', 'var(--color-deep-teal)'],
  ['Still in progress', 'var(--flow-pending)'],
  ['Rejected after interview', 'var(--color-peach)'],
]

export function percentage(count, total) {
  return total ? Math.round((count / total) * 100) : 0
}

export function buildProgressPresentation(applications, { data, summary }, today = new Date()) {
  const counts = new Map(data.nodes.map((node) => [node.name, node.count]))
  const outcomes = progressStages.map(([name, color]) => ({
    name,
    color,
    count: counts.get(name) || 0,
    percentage: percentage(counts.get(name) || 0, summary.applications),
  }))
  const conversions = [
    {
      label: 'Applied to interview',
      count: summary.interviewedApplications,
      total: summary.applications,
      color: progressStages[0][1],
    },
    {
      label: 'Interview to offer',
      count: summary.offers,
      total: summary.interviewedApplications,
      color: progressStages[3][1],
    },
    {
      label: 'Interview or decision',
      count: summary.interviewedApplications + (counts.get('Rejected before interview') || 0),
      total: summary.applications,
      color: progressStages[2][1],
    },
  ]
  // Anchor to the latest valid application date, never an inferred status event.
  const dates = applications.map((row) => getDateKey(row.date)).filter(Boolean)
  const latest = dates.reduce((last, date) => (date > last ? date : last), '')
  const lastWeek = getWeekKey(latest ? getDateFromKey(latest) : today)
  const weeklyCounts = new Map()
  dates.forEach((date) => {
    const week = getWeekKey(getDateFromKey(date))
    weeklyCounts.set(week, (weeklyCounts.get(week) || 0) + 1)
  })
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const date = shiftWeek(lastWeek, i - 5)
    return { date, count: weeklyCounts.get(date) || 0 }
  })
  return { outcomes, conversions, weeks }
}
