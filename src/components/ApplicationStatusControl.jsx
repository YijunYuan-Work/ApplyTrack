import { LoaderCircle } from 'lucide-react'
import { statuses } from '../data/applications'

function ApplicationStatusControl({
  application,
  mutation,
  onStatusChange,
  buttons = false,
  readOnly = false,
}) {
  const statusClass = application.status.toLowerCase()
  return (
    <div className={`application-status-control status-${statusClass}`}>
      {buttons ? (
        <div
          className="application-status-options"
          aria-label={`Status for ${application.company}`}
        >
          {statuses.map((status) => (
            <button
              className={`status-option status-${status.toLowerCase()}`}
              type="button"
              key={status}
              aria-pressed={application.status === status}
              disabled={readOnly}
              onClick={() => onStatusChange(application.id, status)}
            >
              {status}
            </button>
          ))}
        </div>
      ) : readOnly ? (
        <span className="application-status-badge">{application.status}</span>
      ) : (
        <label className="card-status-control">
          <span className="sr-only">Status for {application.company}</span>
          <select
            className="status-select"
            aria-busy={mutation?.pending || false}
            value={mutation?.pending ? mutation.status : application.status}
            onChange={(event) => onStatusChange(application.id, event.target.value)}
          >
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
      )}
      {mutation?.pending && (
        <p className="status-save-feedback" role="status">
          <LoaderCircle size={14} aria-hidden="true" />
          Saving status...
        </p>
      )}
      {mutation?.error && (
        <p className="status-save-feedback form-error" role="alert">
          {mutation.error}
        </p>
      )}
    </div>
  )
}

export default ApplicationStatusControl
