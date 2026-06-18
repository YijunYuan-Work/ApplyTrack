function MetricGrid({ applications, nextFollowUp, statusCounts }) {
  const interviewTotal = applications.reduce(
    (total, application) => total + Number(application.interviewCount || 0),
    0,
  )
  const offerTotal = statusCounts.find((item) => item.status === 'Offer').count
  const appliedTotal = statusCounts.find((item) => item.status === 'Applied').count
  const interviewRate =
    applications.length === 0
      ? 0
      : Math.round((interviewTotal / applications.length) * 100)

  return (
    <section className="metric-grid" aria-label="Application summary">
      <article className="metric-card metric-card-total">
        <span>Total pipeline</span>
        <strong>{applications.length}</strong>
        <small>{appliedTotal} actively applied</small>
      </article>
      <article className="metric-card metric-card-interviews">
        <span>Interviews</span>
        <strong>{interviewTotal}</strong>
        <small>{interviewRate}% interview motion</small>
      </article>
      <article className="metric-card metric-card-offers">
        <span>Offers</span>
        <strong>{offerTotal}</strong>
        <small>{offerTotal === 1 ? '1 win in sight' : 'Wins in sight'}</small>
      </article>
      <article className="metric-card metric-card-followup">
        <span>Next follow-up</span>
        <strong>{nextFollowUp}</strong>
        <small>Do not let good leads cool off</small>
      </article>
    </section>
  )
}

export default MetricGrid
