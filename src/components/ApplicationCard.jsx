import StatusBadge from './StatusBadge'

function ApplicationCard({
  application,
  isSelected = false,
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
        <div className="card-heading">
          <div>
            <p className="company">{application.company}</p>
            <h3>{application.role}</h3>
          </div>
          <StatusBadge status={application.status} />
        </div>

        <dl className="application-details">
          <div>
            <dt>Location</dt>
            <dd>{application.location}</dd>
          </div>
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
          <div>
            <dt>Contact</dt>
            <dd>{application.contact || 'Not set'}</dd>
          </div>
          <div>
            <dt>Salary</dt>
            <dd>{application.salary || 'Not set'}</dd>
          </div>
          <div>
            <dt>Cover letter</dt>
            <dd>{application.coverLetter || 'No'}</dd>
          </div>
          <div>
            <dt>Referral</dt>
            <dd>{application.referral || 'No'}</dd>
          </div>
          <div>
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

      <div className="card-actions">
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
        <button
          className="danger-action"
          type="button"
          onClick={() => onDeleteApplication(application.id)}
        >
          Delete
        </button>
      </div>
    </article>
  )
}

export default ApplicationCard
