import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ResponsiveContainer, Sankey, Tooltip } from 'recharts'
import AppLayout from '../components/AppLayout'

const flowColors = {
  applications: '#64748b',
  interviewed: '#31766b',
  offer: '#5f965e',
  pending: '#7b8fa1',
  rejected: '#bd5d67',
  rejectedBeforeInterview: '#d97745',
}

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const weekDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function getDateKey(dateValue) {
  return String(dateValue || '').slice(0, 10)
}

function getLocalDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function getDateFromKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function getWeekStart(date) {
  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  return weekStart
}

function getWeekKey(date) {
  return getLocalDateKey(getWeekStart(date))
}

function getWeekFromKey(weekKey) {
  return getDateFromKey(weekKey)
}

function shiftWeek(weekKey, offset) {
  const weekDate = getWeekFromKey(weekKey)
  weekDate.setDate(weekDate.getDate() + offset * 7)
  return getWeekKey(weekDate)
}

function getWeekRangeLabel(weekKey) {
  const weekStart = getWeekFromKey(weekKey)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  return `${weekDateFormatter.format(weekStart)} - ${weekDateFormatter.format(weekEnd)}`
}

function buildCalendarDays(weekKey, eventsByDate) {
  const weekStart = getWeekFromKey(weekKey)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    const dateKey = getLocalDateKey(date)

    return {
      events: eventsByDate.get(dateKey) || [],
      date,
      dateKey,
    }
  })
}

function sortCalendarEvents(first, second) {
  return (
    first.application.company.localeCompare(second.application.company) ||
    first.application.role.localeCompare(second.application.role) ||
    first.type.localeCompare(second.type)
  )
}

const compactNodeLabels = {
  Applications: 'Applications',
  'Reached interview': 'Interview',
  Offers: 'Offers',
  'Rejected after interview': 'Rejected after',
  'No interview yet': 'No interview',
  'Rejected before interview': 'Rejected before',
  'Still in progress': 'In progress',
}

function ProgressNode({ compact = false, height, payload, width, x, y }) {
  const nodeName = compact ? compactNodeLabels[payload.name] || payload.name : payload.name
  const labelAbove = payload.name === 'Reached interview'
  const labelOnLeft = !labelAbove && x < (compact ? 96 : 150)
  const labelX = labelAbove
    ? x + width / 2
    : labelOnLeft
      ? x - (compact ? 8 : 14)
      : x + width + (compact ? 8 : 14)
  const textAnchor = labelAbove ? 'middle' : labelOnLeft ? 'end' : 'start'
  const labelY = y + height / 2

  return (
    <g>
      <rect
        fill={payload.color}
        height={Math.max(height, 8)}
        rx="3"
        width={width}
        x={x}
        y={y}
      />
      <text
        className="progress-node-count"
        textAnchor={textAnchor}
        x={labelX}
        y={labelAbove ? y - 26 : labelY - 4}
      >
        {payload.count}
      </text>
      <text
        className="progress-node-name"
        textAnchor={textAnchor}
        x={labelX}
        y={labelAbove ? y - 7 : labelY + 18}
      >
        {nodeName}
      </text>
    </g>
  )
}

function buildProgressData(applications) {
  const nodes = [
    {
      name: 'Applications',
      count: applications.length,
      color: flowColors.applications,
    },
  ]
  const links = []

  function addBranch(source, name, count, color) {
    if (count === 0) {
      return null
    }

    const target = nodes.length
    nodes.push({ name, count, color })
    links.push({ source, target, value: count })
    return target
  }

  const hasInterview = (application) =>
    Number(application.interviewCount || 0) > 0 ||
    application.status === 'Interview' ||
    application.status === 'Offer'

  const interviewedApplications = applications.filter(hasInterview)
  const rejectedBeforeInterview = applications.filter(
    (application) => application.status === 'Rejected' && !hasInterview(application),
  ).length
  const awaitingInterview =
    applications.length - interviewedApplications.length - rejectedBeforeInterview
  const offers = interviewedApplications.filter(
    (application) => application.status === 'Offer',
  ).length
  const rejectedAfterInterview = interviewedApplications.filter(
    (application) => application.status === 'Rejected',
  ).length
  const activeAfterInterview =
    interviewedApplications.length - offers - rejectedAfterInterview

  const interviewedNode = addBranch(
    0,
    'Reached interview',
    interviewedApplications.length,
    flowColors.interviewed,
  )

  if (interviewedNode !== null) {
    addBranch(interviewedNode, 'Offers', offers, flowColors.offer)
    addBranch(
      interviewedNode,
      'Rejected after interview',
      rejectedAfterInterview,
      flowColors.rejected,
    )
    addBranch(
      interviewedNode,
      'Still in progress',
      activeAfterInterview,
      flowColors.pending,
    )
  }

  addBranch(0, 'No interview yet', awaitingInterview, flowColors.pending)
  addBranch(
    0,
    'Rejected before interview',
    rejectedBeforeInterview,
    flowColors.rejectedBeforeInterview,
  )

  return {
    data: { nodes, links },
    summary: {
      applications: applications.length,
      interviewEvents: applications.reduce(
        (total, application) => total + Number(application.interviewCount || 0),
        0,
      ),
      interviewedApplications: interviewedApplications.length,
      offers,
    },
  }
}

function useCompactViewport() {
  const [isCompactViewport, setIsCompactViewport] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia('(max-width: 640px)').matches,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 640px)')

    function handleViewportChange(event) {
      setIsCompactViewport(event.matches)
    }

    mediaQuery.addEventListener('change', handleViewportChange)

    return () => {
      mediaQuery.removeEventListener('change', handleViewportChange)
    }
  }, [])

  return isCompactViewport
}

function ProgressPage({
  applications,
  isDemo = false,
  onAddApplication,
  onDashboard,
  onImportExcel,
  onJobAgent,
  onProfile,
  onProgress,
  onSignOut,
  user,
}) {
  const [activeView, setActiveView] = useState('map')
  const [visibleWeekOverride, setVisibleWeekOverride] = useState('')
  const [expandedDays, setExpandedDays] = useState(new Set())
  const isCompactViewport = useCompactViewport()
  const latestEventWeek = useMemo(() => {
    const latestDateKey = applications
      .flatMap((application) =>
        application.status === 'Rejected'
          ? [getDateKey(application.date), getDateKey(application.lastUpdated)]
          : [getDateKey(application.date)],
      )
      .filter(Boolean)
      .sort()
      .at(-1)

    return latestDateKey ? getWeekKey(getDateFromKey(latestDateKey)) : getWeekKey(new Date())
  }, [applications])
  const visibleWeek = visibleWeekOverride || latestEventWeek

  const { data, summary } = useMemo(
    () => buildProgressData(applications),
    [applications],
  )
  const eventsByDate = useMemo(() => {
    const groupedEvents = new Map()

    function addCalendarEvent(dateKey, event) {
      if (!dateKey) {
        return
      }

      const eventsForDay = groupedEvents.get(dateKey) || []
      eventsForDay.push(event)
      groupedEvents.set(dateKey, eventsForDay.sort(sortCalendarEvents))
    }

    applications.forEach((application) => {
      addCalendarEvent(getDateKey(application.date), {
        application,
        key: `${application.id}-applied`,
        type: 'Applied',
      })

      if (application.status === 'Rejected') {
        addCalendarEvent(getDateKey(application.lastUpdated), {
          application,
          key: `${application.id}-rejected`,
          type: 'Rejected',
        })
      }
    })

    return groupedEvents
  }, [applications])
  const calendarDays = useMemo(
    () => buildCalendarDays(visibleWeek, eventsByDate),
    [eventsByDate, visibleWeek],
  )
  const visibleWeekTotal = calendarDays.reduce(
    (total, day) => total + day.events.length,
    0,
  )
  const outcomes = data.nodes.slice(1)

  function toggleExpandedDay(dateKey) {
    setExpandedDays((currentDays) => {
      const nextDays = new Set(currentDays)

      if (nextDays.has(dateKey)) {
        nextDays.delete(dateKey)
      } else {
        nextDays.add(dateKey)
      }

      return nextDays
    })
  }

  function shiftVisibleWeek(offset) {
    setExpandedDays(new Set())
    setVisibleWeekOverride((currentWeek) =>
      shiftWeek(currentWeek || visibleWeek, offset),
    )
  }

  return (
    <AppLayout
      currentPage="progress"
      isDemo={isDemo}
      onAddApplication={onAddApplication}
      onDashboard={onDashboard}
      onImportExcel={onImportExcel}
      onJobAgent={onJobAgent}
      onProfile={onProfile}
      onProgress={onProgress}
      onSignOut={onSignOut}
      user={user}
    >
      <header className="app-header compact">
        <div>
          <p className="eyebrow">Progress</p>
          <h1>Your application flow.</h1>
          <p>See how your job search is moving from application to outcome.</p>
        </div>
      </header>

      <section className="progress-section" aria-label="Application progress">
        <div className="progress-summary">
          <article>
            <span title="Every application in your tracker">Applications</span>
            <strong>{summary.applications}</strong>
          </article>
          <article>
            <span title="Total interview rounds completed across all applications">
              Interviews held
            </span>
            <strong>{summary.interviewEvents}</strong>
          </article>
          <article>
            <span title="Applications that reached at least one interview">
              Reached interview
            </span>
            <strong>{summary.interviewedApplications}</strong>
          </article>
          <article>
            <span>Offers</span>
            <strong>{summary.offers}</strong>
          </article>
        </div>

        <div className="progress-chart-panel">
          <div className="progress-view-header">
            <div className="progress-chart-heading">
              <p className="eyebrow">
                {activeView === 'map' ? 'Pipeline map' : 'Calendar'}
              </p>
              <h2>
                {activeView === 'map'
                  ? 'Applications by outcome'
                  : 'Applications by day'}
              </h2>
            </div>

            <div
              className="progress-tabs"
              aria-label="Progress views"
            >
              <button
                aria-controls="progress-map-panel"
                aria-pressed={activeView === 'map'}
                className={activeView === 'map' ? 'progress-tab-active' : ''}
                type="button"
                onClick={() => setActiveView('map')}
              >
                Pipeline map
              </button>
              <button
                aria-controls="progress-calendar-panel"
                aria-pressed={activeView === 'calendar'}
                className={activeView === 'calendar' ? 'progress-tab-active' : ''}
                type="button"
                onClick={() => setActiveView('calendar')}
              >
                Calendar
              </button>
            </div>
          </div>

          {applications.length === 0 ? (
            <div className="empty-state">
              <h3>No applications to show yet.</h3>
              <p>Add an application and your progress views will appear here.</p>
            </div>
          ) : activeView === 'map' ? (
            <div id="progress-map-panel">
              {isCompactViewport ? (
                <div
                  className="compact-progress-list"
                  aria-label="Application outcomes"
                >
                  {outcomes.map((outcome) => {
                    const percentage = summary.applications
                      ? Math.round((outcome.count / summary.applications) * 100)
                      : 0

                    return (
                      <div className="compact-progress-row" key={outcome.name}>
                        <div>
                          <span>{compactNodeLabels[outcome.name] || outcome.name}</span>
                          <strong>{outcome.count}</strong>
                        </div>
                        <span
                          aria-label={`${percentage}% of applications`}
                          className="compact-progress-bar"
                          role="img"
                        >
                          <span
                            style={{
                              backgroundColor: outcome.color,
                              width: `${percentage}%`,
                            }}
                          />
                        </span>
                        <small>{percentage}% of applications</small>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div
                  aria-label={`Application flow: ${summary.applications} applications, ${summary.interviewedApplications} reached an interview, and ${summary.offers} received an offer.`}
                  className="progress-chart-scroll"
                  role="img"
                >
                  <div className="progress-chart">
                    <ResponsiveContainer
                      height="100%"
                      initialDimension={{ height: 500, width: 760 }}
                      minHeight={360}
                      minWidth={0}
                      width="100%"
                    >
                      <Sankey
                        data={data}
                        link={{ stroke: '#94a3b8', strokeOpacity: 0.42 }}
                        linkCurvature={0.55}
                        margin={{ bottom: 48, left: 188, right: 188, top: 48 }}
                        node={<ProgressNode />}
                        nodePadding={42}
                        nodeWidth={14}
                        verticalAlign="top"
                      >
                        <Tooltip
                          formatter={(value) => [`${value} applications`, 'Flow']}
                        />
                      </Sankey>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className="progress-calendar"
              id="progress-calendar-panel"
            >
              <div className="calendar-toolbar">
                <div className="calendar-range">
                  <h3>{getWeekRangeLabel(visibleWeek)}</h3>
                  <p>{visibleWeekTotal} events this week</p>
                </div>
                <div className="calendar-actions">
                  <button
                    aria-label="Previous week"
                    className="ghost-button"
                    type="button"
                    onClick={() => shiftVisibleWeek(-1)}
                  >
                    <ChevronLeft aria-hidden="true" size={18} />
                    <span>Previous</span>
                  </button>
                  <button
                    aria-label="Next week"
                    className="ghost-button"
                    type="button"
                    onClick={() => shiftVisibleWeek(1)}
                  >
                    <span>Next</span>
                    <ChevronRight aria-hidden="true" size={18} />
                  </button>
                </div>
              </div>

              <div className="calendar-grid" aria-label="Application calendar">
                {weekdayLabels.map((dayLabel) => (
                  <div className="calendar-weekday" key={dayLabel}>
                    {dayLabel}
                  </div>
                ))}

                {calendarDays.map((day) => (
                  <article
                    className="calendar-day"
                    key={day.dateKey}
                  >
                    <div className="calendar-day-header">
                      <time dateTime={day.dateKey}>{day.date.getDate()}</time>
                      {day.events.length > 0 && (
                        <strong>{day.events.length}</strong>
                      )}
                    </div>

                    {day.events.length > 0 ? (
                      <ul>
                        {(isCompactViewport && !expandedDays.has(day.dateKey)
                          ? day.events.slice(0, 3)
                          : day.events
                        ).map((event) => (
                          <li
                            className={event.type === 'Rejected' ? 'calendar-event-rejected' : ''}
                            key={event.key}
                          >
                            <em>{event.type}</em>
                            <span>{event.application.company}</span>
                            <strong>{event.application.role}</strong>
                          </li>
                        ))}
                        {isCompactViewport && day.events.length > 3 && (
                          <li className="calendar-show-more-row">
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => toggleExpandedDay(day.dateKey)}
                            >
                              {expandedDays.has(day.dateKey)
                                ? 'Show fewer'
                                : `Show ${day.events.length - 3} more`}
                            </button>
                          </li>
                        )}
                      </ul>
                    ) : (
                      <p>No events</p>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </AppLayout>
  )
}

export default ProgressPage
