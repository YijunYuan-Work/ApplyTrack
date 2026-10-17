import { useEffect, useRef, useState } from 'react'
import { Award, BriefcaseBusiness, CircleX, UsersRound } from 'lucide-react'

function MetricValue({ value }) {
  const [display, setDisplay] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? value : 0,
  )
  const previous = useRef(display)
  useEffect(() => {
    const from = previous.current
    const started = performance.now()
    let frame
    function tick(now) {
      const progress = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 1
        : Math.min(1, (now - started) / 600)
      const nextDisplay =
        progress === 1 ? value : Math.round(from + (value - from) * (1 - (1 - progress) ** 3))
      previous.current = nextDisplay
      setDisplay(nextDisplay)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return <strong aria-label={String(value)}>{display}</strong>
}

function MetricGrid({ applications, statusCounts, isLoading }) {
  const interviewTotal = applications.reduce(
    (total, application) => total + Number(application.interviewCount || 0),
    0,
  )
  const offerTotal = statusCounts.find((item) => item.status === 'Offer').count
  const appliedTotal = statusCounts.find((item) => item.status === 'Applied').count
  const rejectedTotal = statusCounts.find((item) => item.status === 'Rejected').count
  const interviewApplicationTotal = applications.filter(
    (application) => Number(application.interviewCount || 0) > 0,
  ).length
  const metrics = [
    {
      key: 'total',
      label: 'Total applications',
      value: applications.length,
      sub: `${appliedTotal} actively applied`,
      Icon: BriefcaseBusiness,
    },
    {
      key: 'interviews',
      label: 'Interview rounds',
      value: interviewTotal,
      sub: `${interviewApplicationTotal} reached interview`,
      Icon: UsersRound,
    },
    {
      key: 'offers',
      label: 'Offers',
      value: offerTotal,
      sub: offerTotal === 1 ? '1 win in sight' : 'Wins in sight',
      Icon: Award,
    },
    {
      key: 'rejected',
      label: 'Rejected',
      value: rejectedTotal,
      sub: 'Closed applications',
      Icon: CircleX,
    },
  ]
  return (
    <section
      className="metric-grid"
      aria-label="Application summary"
      aria-busy={isLoading || false}
    >
      {metrics.map(({ key, label, value, sub, Icon }, index) => (
        <article
          key={key}
          className={`metric-card metric-card-${key}`}
          style={{ '--card-delay': `${40 + index * 50}ms` }}
        >
          <div className="metric-label">
            <span>{label}</span>
            <span className="metric-icon" aria-hidden="true">
              <Icon size={17} />
            </span>
          </div>
          {isLoading ? <strong aria-label="Loading">-</strong> : <MetricValue value={value} />}
          <small>{sub}</small>
        </article>
      ))}
    </section>
  )
}

export default MetricGrid
