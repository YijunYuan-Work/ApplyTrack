import StatusBadge from './StatusBadge'

function ApplicationCard({
  application,
  isSelected = false,
  isReadOnly = false,
  onSelectApplication,
  onDeleteApplication,
  onEditApplication,
  selectionMode = false,
}) {
  const statusClass = application.status.toLowerCase().replace(/\s+/g, '-')

  return (
    <article
      className={`application-card application-card-${statusClass} ${
        selectionMode ? 'selection-card' : ''
      } ${
        isSelected ? 'selected-card' : ''
      }`}
    >
      {selectionMode && (
        <label
          className="card-select"
          title={isSelected ? 'Unselect application' : 'Select application'}
        >
          <input
            checked={isSelected}
            type="checkbox"
            onChange={() => onSelectApplication(application.id)}
          />
          <span aria-hidden="true"></span>
          <span className="sr-only">
            {isSelected ? 'Unselect application' : 'Select application'}
          </span>
        </label>
      )}

      <div className="application-main">
        <div className="card-heading application-record-heading">
          <div className="record-title-block">
            <p className="company">{application.company}</p>
            <h3>{application.role}</h3>
          </div>
          <div className="record-status-block">
            <StatusBadge status={application.status} />
          </div>
        </div>

        <dl className="application-details application-record-details">
          <div className="detail-location">
            <dt>Location</dt>
            <dd>{application.location}</dd>
          </div>
          <div className="detail-applied">
            <dt>Applied</dt>
            <dd>{application.date || 'Not set'}</dd>
          </div>
          <div className="detail-follow-up">
            <dt>Follow-up</dt>
            <dd>{application.followUp || 'Not set'}</dd>
          </div>
          <div className="detail-interviews">
            <dt>Interviews</dt>
            <dd>{application.interviewCount}</dd>
          </div>
          <div className="detail-contact">
            <dt>Contact</dt>
            <dd>{application.contact || 'Not set'}</dd>
          </div>
          <div className="detail-salary">
            <dt>Salary</dt>
            <dd>{application.salary || 'Not set'}</dd>
          </div>
          <div className="detail-cover-letter">
            <dt>Cover letter</dt>
            <dd>{application.coverLetter || 'No'}</dd>
          </div>
          <div className="detail-referral">
            <dt>Referral</dt>
            <dd>{application.referral || 'No'}</dd>
          </div>
          <div className="detail-updated">
            <dt>Last updated</dt>
            <dd>{application.lastUpdated || 'Not set'}</dd>
          </div>
        </dl>

        {application.notes && (
          <div className="notes-block">
            <span>Notes</span>
            <p>{application.notes}</p>
          </div>
        )}
      </div>

      {!isReadOnly && (
        <div className="card-actions">
          <div className="record-action-group">
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
          <button
            className="danger-action"
            type="button"
            onClick={() => onDeleteApplication(application.id)}
          >
            Delete
          </button>
        </div>
      )}
    </article>
  )
}

export default ApplicationCard
