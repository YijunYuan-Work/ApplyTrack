import { CalendarDays, MapPin, Pencil } from 'lucide-react'
import { getTodayIsoDate, statuses } from '../data/applications'
import ApplicationStatusControl from './ApplicationStatusControl'
import ApplicationSelection from './ApplicationSelection'
import { formatApplicationDate } from '../utils/applicationPresentation'

function ApplicationBoard({
  activeStatus,
  applications,
  isReadOnly,
  onChangeActiveStatus,
  onClearFilters,
  onEditApplication,
  onStatusChange,
  statusMutations = {},
  onViewApplication,
  selectionMode,
  selectedApplicationIds = [],
  onSelectApplication,
}) {
  const grouped = Object.fromEntries(statuses.map((status) => [status, []]))
  for (const application of applications) {
    grouped[statuses.includes(application.status) ? application.status : 'Applied'].push(
      application,
    )
  }

  return (
    <section className="application-board" aria-label="Pipeline board">
      <div className="board-stage-tabs" aria-label="Board stages">
        {statuses.map((status) => (
          <button
            type="button"
            key={status}
            className={activeStatus === status ? 'active' : ''}
            aria-pressed={activeStatus === status}
            onClick={() => onChangeActiveStatus(status)}
          >
            <span>{status}</span>
            <span>{grouped[status].length}</span>
          </button>
        ))}
      </div>
      <div className="board-columns">
        {statuses.map((status) => (
          <section
            key={status}
            aria-label={`${status} applications`}
            className={`board-column status-${status.toLowerCase()} ${status === activeStatus ? 'active' : ''}`}
          >
            <header>
              <h3>
                <span className="stage-dot" aria-hidden="true" />
                {status}
              </h3>
              <span>{grouped[status].length}</span>
            </header>
            <div className="board-card-list">
              {grouped[status].map((application, index) => {
                const selected = selectedApplicationIds.includes(application.id)
                const followUp =
                  application.followUp && ['Applied', 'Interview'].includes(application.status)
                return (
                  <article
                    key={application.id}
                    className={`board-card ${selectionMode ? 'selection-card' : ''} ${selected ? 'selected-card' : ''}`}
                    style={{ '--card-delay': `${Math.min(index, 8) * 40}ms` }}
                    onClick={(event) => {
                      if (!event.target.closest('button, a, input, select, label'))
                        onViewApplication(application.id)
                    }}
                  >
                    {selectionMode && (
                      <ApplicationSelection
                        selected={selected}
                        onChange={() => onSelectApplication(application.id)}
                      />
                    )}
                    <div className="board-card-heading">
                      <p className="company">{application.company}</p>
                      <h3>
                        <button
                          type="button"
                          className="application-title-button"
                          aria-haspopup="dialog"
                          aria-label={`View details for ${application.company}`}
                          onClick={() => onViewApplication(application.id)}
                        >
                          {application.role}
                        </button>
                      </h3>
                    </div>
                    <div className="board-card-meta">
                      <span>
                        <MapPin size={13} aria-hidden="true" />
                        {application.location || 'Not set'}
                      </span>
                      <span>
                        <CalendarDays size={13} aria-hidden="true" />
                        <time dateTime={application.date || undefined} title={application.date}>
                          {formatApplicationDate(application.date)}
                        </time>
                      </span>
                    </div>
                    <div className="board-card-compensation">
                      <span>{application.salary || 'Salary not listed'}</span>
                      <span>
                        {application.interviewCount
                          ? `${application.interviewCount} interview${application.interviewCount === 1 ? '' : 's'}`
                          : 'No interviews yet'}
                      </span>
                    </div>
                    {followUp && (
                      <span
                        className={`board-follow-up ${application.followUp < getTodayIsoDate() ? 'overdue' : ''}`}
                      >
                        {application.followUp < getTodayIsoDate()
                          ? 'Overdue'
                          : application.followUp === getTodayIsoDate()
                            ? 'Due today'
                            : 'Follow up'}{' '}
                        <time dateTime={application.followUp} title={application.followUp}>
                          {formatApplicationDate(application.followUp)}
                        </time>
                      </span>
                    )}
                    <div className="board-card-actions">
                      <ApplicationStatusControl
                        application={application}
                        mutation={statusMutations[application.id]}
                        onStatusChange={onStatusChange}
                        readOnly={isReadOnly}
                      />
                      {!isReadOnly && (
                        <button
                          className="ui-button ui-button-ghost ui-icon-button"
                          type="button"
                          aria-label="Edit"
                          title={`Edit ${application.company}`}
                          onClick={() => onEditApplication(application.id)}
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
            {grouped[status].length === 0 && (
              <div className="board-empty-state">Nothing here yet</div>
            )}
          </section>
        ))}
      </div>
      {applications.length === 0 && (
        <div className="empty-state board-search-empty">
          <h3>No applications found</h3>
          <p>Try a different search or clear your filters.</p>
          <button className="ui-button ui-button-ghost" type="button" onClick={onClearFilters}>
            Clear filters
          </button>
        </div>
      )}
    </section>
  )
}

export default ApplicationBoard
