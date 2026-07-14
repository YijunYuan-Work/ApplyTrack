import {
  BriefcaseBusiness,
  ExternalLink,
  Pencil,
} from 'lucide-react'
import { getTodayIsoDate, statuses } from '../data/applications'
import StatusBadge from './StatusBadge'

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
    return 'Interviews in progress'
  }

  if (status === 'Rejected') {
    return 'Not moving forward'
  }

  if (status === 'Offer') {
    return 'Offers received'
  }

  return 'Application submitted'
}

function getFollowUpState(application) {
  if (!application.followUp) {
    return { label: 'Not set', state: 'unset' }
  }

  if (application.status === 'Rejected' || application.status === 'Offer') {
    return { label: application.followUp, state: 'scheduled' }
  }

  const today = getTodayIsoDate()

  if (application.followUp < today) {
    return { label: `${application.followUp} - Overdue`, state: 'overdue' }
  }

  if (application.followUp === today) {
    return { label: `${application.followUp} - Due today`, state: 'due' }
  }

  return { label: application.followUp, state: 'scheduled' }
}

function ApplicationBoardCard({
  application,
  isReadOnly,
  onEditApplication,
  onStatusChange,
}) {
  const statusClass = application.status.toLowerCase().replace(/\s+/g, '-')
  const companyInitial = application.company.trim().charAt(0).toUpperCase() || 'A'
  const followUp = getFollowUpState(application)

  return (
    <article
      className={`board-card board-card-${statusClass}`}
    >
      <div className="board-card-heading">
        <span className={`company-logo company-logo-${statusClass}`} aria-hidden="true">
          {companyInitial}
        </span>
        <div>
          <p className="company">{application.company}</p>
          <h3 className="board-card-title">{application.role}</h3>
        </div>
      </div>

      {isReadOnly ? (
        <StatusBadge status={application.status} />
      ) : (
        <label className="card-status-control">
          <span className="sr-only">Status for {application.company}</span>
          <select
            className={`status-select status-select-${statusClass}`}
            value={application.status}
            onChange={(event) =>
              onStatusChange(application.id, event.target.value)
            }
          >
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
      )}

      <div className="board-card-dates" aria-label="Application dates">
        <div className="board-card-date-row">
          <div className="board-card-date-label">Applied</div>
          <div className="board-card-date-value">{application.date || 'Not set'}</div>
        </div>
        <div className="board-card-date-row">
          <div className="board-card-date-label">Follow-up</div>
          <div className={`board-card-date-value follow-up-${followUp.state}`}>
            {followUp.label}
          </div>
        </div>
        <div className="board-card-date-row">
          <div className="board-card-date-label">Last updated</div>
          <div className="board-card-date-value">
            {application.lastUpdated || 'Not set'}
          </div>
        </div>
      </div>

      {!isReadOnly && (
        <div
          className={`board-card-actions ${
            application.jobUrl ? '' : 'board-card-actions-single'
          }`}
        >
          {application.jobUrl && (
            <a
              className="secondary-action"
              href={application.jobUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink aria-hidden="true" size={15} />
              Open
            </a>
          )}
          <button
            className="secondary-action"
            type="button"
            onClick={() => onEditApplication(application.id)}
          >
            <Pencil aria-hidden="true" size={15} />
            Edit
          </button>
        </div>
      )}
    </article>
  )
}

function ApplicationBoard({
  activeStatus,
  applications,
  isReadOnly = false,
  onChangeActiveStatus,
  onClearFilters,
  onEditApplication,
  onStatusChange,
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
                    isReadOnly={isReadOnly}
                    key={application.id}
                    onEditApplication={onEditApplication}
                    onStatusChange={onStatusChange}
                  />
                ))}

                {statusApplications.length === 0 && status === 'Offer' && (
                  <div className="board-empty-state">
                    <span className="board-empty-icon" aria-hidden="true">
                      <BriefcaseBusiness size={34} strokeWidth={1.9} />
                    </span>
                    <strong>No offers yet</strong>
                    <p>Keep going! Your next opportunity is ahead.</p>
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
          <button className="ghost-button" type="button" onClick={onClearFilters}>
            Clear filters
          </button>
        </div>
      )}
    </section>
  )
}

export default ApplicationBoard
