const flowColors = {
  applications: '#64748b',
  interviewed: '#31766b',
  offer: '#5f965e',
  pending: '#7b8fa1',
  rejected: '#bd5d67',
  rejectedBeforeInterview: '#d97745',
}

export function getLocalDateKey(date) {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export function getDateFromKey(dateKey) {
  if (typeof dateKey !== 'string' || !/^\d{4,6}-\d{2}-\d{2}$/.test(dateKey)) return null
  const [year, month, day] = dateKey.split('-').map(Number)
  // setFullYear avoids JavaScript's special interpretation of years 00-99.
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(0, 0, 0, 0)
  return getLocalDateKey(date) === dateKey ? date : null
}

export function getDateKey(value) {
  if (typeof value !== 'string') return ''
  const key = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || key.startsWith('0000-')) return ''
  // Preserve ISO timestamp-prefix compatibility, without accepting arbitrary suffixes.
  if (value !== key && (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value)))) return ''
  return getDateFromKey(key) ? key : ''
}

export function getWeekKey(date) {
  const weekStart = new Date(date)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  return getLocalDateKey(weekStart)
}

export function shiftWeek(weekKey, offset) {
  const weekDate = getDateFromKey(weekKey)
  weekDate.setDate(weekDate.getDate() + offset * 7)
  return getWeekKey(weekDate)
}

export function buildCalendarDays(weekKey, eventsByDate) {
  const weekStart = getDateFromKey(weekKey)
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    const dateKey = getLocalDateKey(date)
    return { events: eventsByDate.get(dateKey) || [], date, dateKey }
  })
}

export function buildCalendarEvents(applications) {
  const groupedEvents = new Map()
  function addEvent(value, application, type) {
    const dateKey = getDateKey(value)
    if (!dateKey) return
    const events = groupedEvents.get(dateKey) || []
    events.push({ application, key: `${application.id}-${type.toLowerCase()}`, type })
    groupedEvents.set(dateKey, events)
  }
  applications.forEach((application) => {
    addEvent(application.date, application, 'Applied')
    // F08 persistence semantics remain behind the RF-12 approval gate.
    if (application.status === 'Rejected') addEvent(application.lastUpdated, application, 'Rejected')
  })
  groupedEvents.forEach((events) => events.sort((first, second) =>
    first.application.company.localeCompare(second.application.company) ||
    first.application.role.localeCompare(second.application.role) ||
    first.type.localeCompare(second.type),
  ))
  return groupedEvents
}

export function getLatestEventWeek(eventsByDate, today = new Date()) {
  const latestDateKey = [...eventsByDate.keys()].sort().at(-1)
  return getWeekKey(latestDateKey ? getDateFromKey(latestDateKey) : today)
}

function getInterviewRounds(application) {
  const count = Number(application.interviewCount || 0)
  return Number.isFinite(count) ? Math.max(0, count) : 0
}

export function buildProgressData(applications) {
  const nodes = [{ name: 'Applications', count: applications.length, color: flowColors.applications }]
  const links = []
  function addBranch(source, name, count, color) {
    if (count === 0) return null
    const target = nodes.length
    nodes.push({ name, count, color })
    links.push({ source, target, value: count })
    return target
  }
  const hasInterview = (application) =>
    getInterviewRounds(application) > 0 || application.status === 'Interview' || application.status === 'Offer'
  const interviewedApplications = applications.filter(hasInterview)
  const rejectedBeforeInterview = applications.filter(
    (application) => application.status === 'Rejected' && !hasInterview(application),
  ).length
  const awaitingInterview = applications.length - interviewedApplications.length - rejectedBeforeInterview
  const offers = interviewedApplications.filter((application) => application.status === 'Offer').length
  const rejectedAfterInterview = interviewedApplications.filter((application) => application.status === 'Rejected').length
  const activeAfterInterview = interviewedApplications.length - offers - rejectedAfterInterview
  const interviewedNode = addBranch(0, 'Reached interview', interviewedApplications.length, flowColors.interviewed)
  if (interviewedNode !== null) {
    addBranch(interviewedNode, 'Offers', offers, flowColors.offer)
    addBranch(interviewedNode, 'Rejected after interview', rejectedAfterInterview, flowColors.rejected)
    addBranch(interviewedNode, 'Still in progress', activeAfterInterview, flowColors.pending)
  }
  addBranch(0, 'No interview yet', awaitingInterview, flowColors.pending)
  addBranch(0, 'Rejected before interview', rejectedBeforeInterview, flowColors.rejectedBeforeInterview)
  return {
    data: { nodes, links },
    summary: {
      applications: applications.length,
      interviewEvents: applications.reduce((total, application) => total + getInterviewRounds(application), 0),
      interviewedApplications: interviewedApplications.length,
      offers,
    },
  }
}
