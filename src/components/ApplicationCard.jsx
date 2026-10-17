import { ExternalLink, Pencil, Trash2 } from 'lucide-react'
import ApplicationStatusControl from './ApplicationStatusControl'
import ApplicationSelection from './ApplicationSelection'
import { formatApplicationDate } from '../utils/applicationPresentation'

function ApplicationCard({
  application,
  isSelected = false,
  isReadOnly = false,
  isDeleting = false,
  onSelectApplication,
  onDeleteApplication,
  onEditApplication,
  onStatusChange,
  onViewApplication,
  selectionMode = false,
  statusMutation,
}) {
  return (
    <article
      className={`application-card ${selectionMode ? 'selection-card' : ''} ${isSelected ? 'selected-card' : ''}`}
      onClick={(event) => {
        if (!event.target.closest('button, a, input, select, label'))
          onViewApplication(application.id)
      }}
    >
      {selectionMode && (
        <ApplicationSelection
          selected={isSelected}
          onChange={() => onSelectApplication(application.id)}
        />
      )}
      <div className="record-title-block">
        <h3>
          <button
            className="application-title-button"
            type="button"
            aria-haspopup="dialog"
            aria-label={`View details for ${application.company}`}
            onClick={() => onViewApplication(application.id)}
          >
            {application.role}
          </button>
        </h3>
        <p className="company">{application.company}</p>
      </div>
      <ApplicationStatusControl
        application={application}
        mutation={statusMutation}
        onStatusChange={onStatusChange}
        readOnly={isReadOnly}
      />
      <span className="list-location">{application.location || 'Not set'}</span>
      <time
        className="list-applied"
        dateTime={application.date || undefined}
        title={application.date}
      >
        {formatApplicationDate(application.date)}
      </time>
      <span className="list-salary">{application.salary || 'Not set'}</span>
      <span
        className="list-interviews"
        aria-label={`${application.interviewCount} interview rounds`}
      >
        {application.interviewCount}
      </span>
      <div className="card-actions">
        {application.jobUrl && (
          <a
            className="ui-button ui-button-ghost ui-icon-button"
            title="Open job"
            aria-label="Open job"
            href={application.jobUrl}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={15} />
          </a>
        )}
        {!isReadOnly && (
          <>
            <button
              className="ui-button ui-button-ghost ui-icon-button"
              type="button"
              title="Edit"
              aria-label="Edit"
              onClick={() => onEditApplication(application.id)}
            >
              <Pencil size={15} />
            </button>
            <button
              className="ui-button ui-button-remove ui-icon-button"
              type="button"
              title="Delete"
              aria-label="Delete"
              disabled={isDeleting}
              aria-busy={isDeleting}
              onClick={() => onDeleteApplication(application.id)}
            >
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>
    </article>
  )
}

export default ApplicationCard
