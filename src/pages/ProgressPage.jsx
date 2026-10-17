import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import { MetricValue } from '../components/MetricGrid'
import ProgressFlow from '../components/ProgressFlow'
import {
  buildCalendarDays,
  buildCalendarEvents,
  buildProgressData,
  getDateFromKey,
  getLatestEventWeek,
  shiftWeek,
} from '../data/progress'
import { buildProgressPresentation, percentage, progressStages } from '../data/progressPresentation'
import '../styles/progress.css'

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const fullDate = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const change = (event) => setMatches(event.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [query])
  return matches
}

function ProgressBar({ value, color, label }) {
  return (
    <span className="progress-bar" role="img" aria-label={label}>
      <span style={{ width: `${value}%`, background: color }} />
    </span>
  )
}

function ProgressPage({ applications, isDemo = false, ...layoutProps }) {
  const [activeView, setActiveView] = useState('map')
  const [visibleWeekOverride, setVisibleWeekOverride] = useState('')
  const [expandedDays, setExpandedDays] = useState(new Set())
  const mobile = useMediaQuery('(width < 640px)')
  const tablet = useMediaQuery('(width < 1040px)')
  const eventsByDate = useMemo(() => buildCalendarEvents(applications), [applications])
  const visibleWeek = visibleWeekOverride || getLatestEventWeek(eventsByDate)
  const progress = useMemo(() => buildProgressData(applications), [applications])
  const { data, summary } = progress
  const { outcomes, conversions, weeks } = useMemo(
    () => buildProgressPresentation(applications, progress),
    [applications, progress],
  )
  const days = useMemo(
    () => buildCalendarDays(visibleWeek, eventsByDate),
    [visibleWeek, eventsByDate],
  )
  const weekTotal = days.reduce((total, day) => total + day.events.length, 0)
  const weekEnd = getDateFromKey(visibleWeek)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const maxWeekly = Math.max(1, ...weeks.map((week) => week.count))
  const metrics = [
    [
      'Applications',
      summary.applications,
      'Every application in your tracker',
      100,
      'var(--color-sea-glass)',
    ],
    [
      'Interviews held',
      summary.interviewEvents,
      'Rounds completed, all applications',
      Math.min(100, percentage(summary.interviewEvents, summary.applications)),
      'var(--color-terracotta)',
    ],
    [
      'Reached interview',
      summary.interviewedApplications,
      `${percentage(summary.interviewedApplications, summary.applications)}% of applications`,
      percentage(summary.interviewedApplications, summary.applications),
      'var(--color-sea-glass)',
    ],
    [
      'Offers',
      summary.offers,
      `${percentage(summary.offers, summary.applications)}% of applications`,
      percentage(summary.offers, summary.applications),
      'var(--color-peach)',
    ],
  ]
  function shiftVisibleWeek(offset) {
    setExpandedDays(new Set())
    setVisibleWeekOverride(shiftWeek(visibleWeek, offset))
  }
  function toggleDay(date) {
    setExpandedDays((current) => {
      const next = new Set(current)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }
  const empty = (
    <div className="progress-empty">
      <h3>No applications to show yet.</h3>
      <p>Add an application and your progress views will appear here.</p>
    </div>
  )
  return (
    <AppLayout {...layoutProps} currentPage="progress" isDemo={isDemo}>
      <main className="progress-workspace">
        <header className="progress-header">
          <p className="progress-eyebrow">Progress</p>
          <h1>Your application flow.</h1>
          <p>See how your job search is moving from application to outcome.</p>
        </header>
        <section className="progress-summary" aria-label="Progress summary">
          {metrics.map(([label, value, sub, width, color], index) => (
            <article key={label} style={{ '--reveal-delay': `${40 + index * 60}ms` }}>
              <span>{label}</span>
              <MetricValue value={value} />
              <ProgressBar
                value={summary.applications ? width : 0}
                color={color}
                label={
                  label === 'Interviews held'
                    ? `${value} completed interview rounds`
                    : `${value} ${label.toLowerCase()}`
                }
              />
              <small>{sub}</small>
            </article>
          ))}
        </section>
        <section className="progress-chart-panel" aria-label="Application progress">
          <div className="progress-view-header">
            <div className="progress-chart-heading">
              <p className="progress-eyebrow">
                {activeView === 'map' ? 'Pipeline map' : 'Calendar'}
              </p>
              <h2>{activeView === 'map' ? 'Applications by outcome' : 'Applications by day'}</h2>
            </div>
            <div
              className="progress-tabs"
              role="group"
              aria-label="Progress views"
              data-view={activeView}
            >
              <span className="progress-tab-indicator" aria-hidden="true" />
              {['map', 'calendar'].map((view) => (
                <button
                  key={view}
                  type="button"
                  aria-controls={`progress-${view}-panel`}
                  aria-pressed={view === activeView}
                  onClick={() => setActiveView(view)}
                >
                  {view === 'map' ? 'Pipeline map' : 'Calendar'}
                </button>
              ))}
            </div>
          </div>
          <div id="progress-map-panel" hidden={activeView !== 'map'}>
            {activeView === 'map' &&
              (applications.length === 0 ? (
                empty
              ) : (
                <>
                  {mobile ? (
                    <div className="compact-progress-list" aria-label="Application outcomes">
                      {outcomes.map((outcome) => (
                        <div className="compact-progress-row" key={outcome.name}>
                          <div>
                            <span>{outcome.name}</span>
                            <strong>{outcome.count}</strong>
                          </div>
                          <ProgressBar
                            value={outcome.percentage}
                            color={outcome.color}
                            label={`${outcome.percentage}% of applications`}
                          />
                          <small>{outcome.percentage}% of applications</small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ProgressFlow data={data} summary={summary} tablet={tablet} />
                  )}
                  <div className="progress-legend" aria-label="Flow legend">
                    {[
                      ['Applications', 'var(--color-deep-teal)'],
                      ...progressStages.filter(
                        ([name]) => name !== 'Offers' && name !== 'Rejected after interview',
                      ),
                    ].map(([name, color]) => (
                      <span key={name}>
                        <i aria-hidden="true" style={{ background: color }} />
                        {name === 'Rejected before interview' ? 'Rejected' : name}
                      </span>
                    ))}
                  </div>
                </>
              ))}
          </div>
          <div
            className="progress-calendar"
            id="progress-calendar-panel"
            hidden={activeView !== 'calendar'}
          >
            {activeView === 'calendar' &&
              (applications.length === 0 ? (
                empty
              ) : (
                <>
                  <div className="calendar-toolbar">
                    <div className="calendar-range" aria-live="polite">
                      <h3>
                        {fullDate.format(getDateFromKey(visibleWeek))} - {fullDate.format(weekEnd)}
                      </h3>
                      <p>{weekTotal} events this week</p>
                    </div>
                    <div className="calendar-actions">
                      <button
                        aria-label="Previous week"
                        title="Previous week"
                        className="ui-button ui-button-secondary"
                        type="button"
                        onClick={() => shiftVisibleWeek(-1)}
                      >
                        <ChevronLeft aria-hidden="true" size={18} />
                      </button>
                      <button
                        aria-label="Next week"
                        title="Next week"
                        className="ui-button ui-button-secondary"
                        type="button"
                        onClick={() => shiftVisibleWeek(1)}
                      >
                        <ChevronRight aria-hidden="true" size={18} />
                      </button>
                    </div>
                  </div>
                  <div
                    className="calendar-grid"
                    aria-label="Application calendar"
                    key={visibleWeek}
                  >
                    {days.map((day, index) => (
                      <article
                        className={`calendar-day${day.events.length ? ' has-events' : ''}`}
                        key={day.dateKey}
                        aria-label={fullDate.format(day.date)}
                        style={{ '--reveal-delay': `${index * 40}ms` }}
                      >
                        <div className="calendar-day-header">
                          <span className="calendar-day-label">{weekdays[index]}</span>
                          {day.events.length > 0 && (
                            <span
                              className="calendar-event-count"
                              aria-label={`${day.events.length} events`}
                            >
                              {day.events.length}
                            </span>
                          )}
                          <time dateTime={day.dateKey}>{day.date.getDate()}</time>
                        </div>
                        {day.events.length ? (
                          <ul>
                            {(mobile && !expandedDays.has(day.dateKey)
                              ? day.events.slice(0, 3)
                              : day.events
                            ).map((event) => (
                              <li
                                className={
                                  event.type === 'Rejected' ? 'calendar-event-rejected' : ''
                                }
                                key={event.key}
                              >
                                <em>{event.type}</em>
                                <span>{event.application.company}</span>
                                <strong>{event.application.role}</strong>
                              </li>
                            ))}
                            {mobile && day.events.length > 3 && (
                              <li className="calendar-show-more-row">
                                <button
                                  type="button"
                                  className="ui-button ui-button-secondary"
                                  aria-expanded={expandedDays.has(day.dateKey)}
                                  onClick={() => toggleDay(day.dateKey)}
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
                </>
              ))}
          </div>
        </section>
        <section className="progress-statistics" aria-label="Activity and conversion">
          <article className="progress-weekly">
            <header>
              <h3>Applications per week</h3>
              <span>6 weeks to {shortDate.format(getDateFromKey(weeks.at(-1).date))}</span>
            </header>
            <div className="progress-week-bars" aria-label="Weekly applications">
              {weeks.map((week, index) => (
                <div
                  className="progress-week"
                  key={week.date}
                  style={{ '--reveal-delay': `${index * 70}ms` }}
                >
                  <span
                    className="progress-week-track"
                    role="img"
                    style={{ '--bar-height': `${(week.count / maxWeekly) * 82}%` }}
                    aria-label={`Week of ${fullDate.format(getDateFromKey(week.date))}: ${week.count} applications`}
                  >
                    <strong>{week.count}</strong>
                    <span />
                  </span>
                  <time dateTime={week.date}>{shortDate.format(getDateFromKey(week.date))}</time>
                </div>
              ))}
            </div>
          </article>
          <article className="progress-conversion">
            <h3>Conversion</h3>
            {conversions.map((item) => (
              <div className="progress-conversion-row" key={item.label}>
                <div>
                  <span>{item.label}</span>
                  <strong>{percentage(item.count, item.total)}%</strong>
                </div>
                <ProgressBar
                  value={percentage(item.count, item.total)}
                  color={item.color}
                  label={`${item.count} of ${item.total} applications`}
                />
                <small>
                  {item.count} of {item.total} applications
                </small>
              </div>
            ))}
          </article>
        </section>
      </main>
    </AppLayout>
  )
}

export default ProgressPage
