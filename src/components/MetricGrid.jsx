import {
  BriefcaseBusiness,
  CircleX,
  Trophy,
  UsersRound,
} from 'lucide-react'

function MetricGrid({ applications, statusCounts }) {
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

  return (
    <section className="metric-grid" aria-label="Application summary">
      <article className="metric-card metric-card-total">
        <span className="metric-icon" aria-hidden="true">
          <BriefcaseBusiness size={29} strokeWidth={2.1} />
        </span>
        <div>
          <span>Total applications</span>
          <strong>{applications.length}</strong>
          <small>{appliedTotal} actively applied</small>
        </div>
      </article>
      <article className="metric-card metric-card-interviews">
        <span className="metric-icon" aria-hidden="true">
          <UsersRound size={31} strokeWidth={2.1} />
        </span>
        <div>
          <span>Interview rounds</span>
          <strong>{interviewTotal}</strong>
          <small>
            {interviewApplicationTotal}{' '}
            {interviewApplicationTotal === 1 ? 'application' : 'applications'} reached interview
          </small>
        </div>
      </article>
      <article className="metric-card metric-card-offers">
        <span className="metric-icon" aria-hidden="true">
          <Trophy size={31} strokeWidth={2.1} />
        </span>
        <div>
          <span>Offers</span>
          <strong>{offerTotal}</strong>
          <small>{offerTotal === 1 ? '1 win in sight' : 'Wins in sight'}</small>
        </div>
      </article>
      <article className="metric-card metric-card-rejected">
        <span className="metric-icon" aria-hidden="true">
          <CircleX size={30} strokeWidth={2.1} />
        </span>
        <div>
          <span>Rejected</span>
          <strong>{rejectedTotal}</strong>
          <small>Closed applications</small>
        </div>
      </article>
    </section>
  )
}

export default MetricGrid
