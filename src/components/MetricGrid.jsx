function MetricGrid({ applications, nextFollowUp, statusCounts }) {
  return (
    <section className="metric-grid" aria-label="Application summary">
      <article>
        <span>Total</span>
        <strong>{applications.length}</strong>
      </article>
      <article>
        <span>Interviews</span>
        <strong>
          {statusCounts.find((item) => item.status === 'Interview').count}
        </strong>
      </article>
      <article>
        <span>Offers</span>
        <strong>{statusCounts.find((item) => item.status === 'Offer').count}</strong>
      </article>
      <article>
        <span>Next follow-up</span>
        <strong>{nextFollowUp}</strong>
      </article>
    </section>
  )
}

export default MetricGrid
