const boardStatuses = ['Applied', 'Interview', 'Offer', 'Rejected']

function groupApplicationsByStatus(applications) {
  return boardStatuses.reduce((groups, status) => {
    groups[status] = applications.filter((application) =>
      boardStatuses.includes(application.status)
        ? application.status === status
        : status === 'Applied',
    )

    return groups
  }, {})
}

function getStageHint(status, applications) {
  if (applications.length === 0) {
    return status === 'Offer' ? 'No offers yet' : 'No applications here'
  }

  if (status === 'Interview') {
    return 'Roles with interview activity'
  }

  if (status === 'Rejected') {
    return 'Closed applications'
  }

  if (status === 'Offer') {
    return 'Wins in progress'
  }

  return 'Submitted applications'
}

function ApplicationBoardCard({ application, onEditApplication }) {
  return (
    <article className="board-card">
      <div>
        <p className="company">{application.company}</p>
        <h3>{application.role}</h3>
      </div>

      <dl>
        <div>
          <dt>Applied</dt>
          <dd>{application.date || 'Not set'}</dd>
        </div>
        <div>
          <dt>Follow-up</dt>
          <dd>{application.followUp || 'Not set'}</dd>
        </div>
        <div>
          <dt>Interviews</dt>
          <dd>{application.interviewCount}</dd>
        </div>
      </dl>

      <div className="board-card-actions">
        {application.jobUrl && (
          <a
            className="secondary-action"
            href={application.jobUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open job
          </a>
        )}
        <button
          className="secondary-action"
          type="button"
          onClick={() => onEditApplication(application.id)}
        >
          Edit
        </button>
      </div>
    </article>
  )
}

function ApplicationBoard({
  activeStatus,
  applications,
  onChangeActiveStatus,
  onEditApplication,
}) {
  const groupedApplications = groupApplicationsByStatus(applications)
  const activeApplications = groupedApplications[activeStatus] || []

  return (
    <section className="application-board" aria-label="Pipeline board">
      <div className="board-stage-tabs" aria-label="Board stages">
        {boardStatuses.map((status) => (
          <button
            className={activeStatus === status ? 'active' : ''}
            key={status}
            type="button"
            onClick={() => onChangeActiveStatus(status)}
          >
            <span>{status}</span>
            <strong>{groupedApplications[status].length}</strong>
          </button>
        ))}
      </div>

      <div className="board-columns">
        {boardStatuses.map((status) => {
          const statusApplications = groupedApplications[status]

          return (
            <section
              className={`board-column board-column-${status.toLowerCase()} ${
                activeStatus === status ? 'active' : ''
              }`}
              key={status}
              aria-label={`${status} applications`}
            >
              <header>
                <div>
                  <h3>{status}</h3>
                  <p>{getStageHint(status, statusApplications)}</p>
                </div>
                <span>{statusApplications.length}</span>
              </header>

              <div className="board-card-list">
                {statusApplications.map((application) => (
                  <ApplicationBoardCard
                    application={application}
                    key={application.id}
                    onEditApplication={onEditApplication}
                  />
                ))}

                {statusApplications.length === 0 && (
                  <div className="board-empty-state">
                    <p>{getStageHint(status, statusApplications)}</p>
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {applications.length === 0 && activeApplications.length === 0 && (
        <div className="empty-state board-search-empty">
          <h3>No applications found</h3>
          <p>Try a different search or status filter.</p>
        </div>
      )}
    </section>
  )
}

export default ApplicationBoard
