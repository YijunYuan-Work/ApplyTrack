import StatusBadge from './StatusBadge'

function ApplicationCard({
  application,
  onDeleteApplication,
  onEditApplication,
}) {
  return (
    <article className="application-card">
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
            <dt>Contact</dt>
            <dd>{application.contact || 'Not set'}</dd>
          </div>
          <div>
            <dt>Salary</dt>
            <dd>{application.salary || 'Not set'}</dd>
          </div>
        </dl>

        {application.notes && <p className="notes">{application.notes}</p>}
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
