import {
  Banknote,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Search,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import { formatJobAgentDate, getJobLeadPresentation } from '../data/jobAgent'
import JobAlertAddress from './JobAlertAddress'

const pageSize = 20
const sources = [
  ['all', 'All alerts'],
  ['linkedin', 'LinkedIn'],
  ['indeed', 'Indeed'],
]

function sourceLabel(source) {
  return sources.find(([value]) => value === source)?.[1] || 'Job alert'
}

function LeadHighlightIcon({ value }) {
  if (/alum/i.test(value)) return <UsersRound aria-hidden="true" size={14} />
  if (/remote/i.test(value)) return <MapPin aria-hidden="true" size={14} />
  return <CheckCircle2 aria-hidden="true" size={14} />
}

function importedDate(value) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date)
    : ''
}

function JobMatches({
  inbox,
  isUpdating,
  leads,
  messages,
  onFinishApplying,
  onRemove,
  onRemoveAll,
  waitingLeadCount,
  resultCount,
  query,
  source,
  page,
  onQueryChange,
  onSourceChange,
  onPageChange,
  onClearFilters,
  isLoading,
  error,
  onReload,
}) {
  const latestMessage = messages[0]
  const hasLinkedIn = messages.some((message) => message.provider === 'linkedin')
  const hasIndeed = messages.some((message) => message.provider === 'indeed')
  const pageCount = Math.max(1, Math.ceil((resultCount || 0) / pageSize))
  const safePage = Math.min(page, pageCount)
  const filtered = Boolean(query.trim() || source !== 'all')

  function changePage(nextPage) {
    onPageChange(nextPage)
    requestAnimationFrame(() => {
      window.scrollTo({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        left: 0,
        top: 0,
      })
    })
  }

  return (
    <div className="agent-matches-layout">
      <section className="agent-inbox-summary" aria-label="Job alert status">
        <JobAlertAddress inbox={inbox} />
        <dl className="agent-alert-status">
          <div>
            <dt>Last alert</dt>
            <dd>{formatJobAgentDate(inbox?.lastReceivedAt)}</dd>
          </div>
          {[
            [hasLinkedIn, 'LinkedIn'],
            [hasIndeed, 'Indeed'],
          ].map(([received, label]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                {received && inbox?.enabled && (
                  <span className="agent-live-dot" aria-hidden="true" />
                )}
                {!inbox?.enabled
                  ? 'Imports paused'
                  : received
                    ? 'Receiving alerts'
                    : 'Waiting for first alert'}
              </dd>
            </div>
          ))}
          <div className={`agent-import-status agent-import-${latestMessage?.status || 'waiting'}`}>
            <dt>{latestMessage ? `Latest import: ${latestMessage.status}` : 'Import status'}</dt>
            <dd>
              {latestMessage
                ? latestMessage.errorSummary ||
                  `${latestMessage.jobsFound} found - ${latestMessage.jobsCreated} new`
                : inbox?.enabled
                  ? 'Ready to receive alerts'
                  : 'Imports paused'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="agent-match-actions" aria-label="Queue controls">
        <label className="agent-search-field">
          <Search aria-hidden="true" size={18} />
          <span className="visually-hidden">Search jobs waiting to be applied</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search company, title, location"
          />
        </label>
        <div className="agent-source-filters" role="group" aria-label="Source">
          {sources.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={source === value}
              onClick={() => onSourceChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="ui-button ui-button-ghost agent-remove-all-action"
          disabled={isUpdating || isLoading || waitingLeadCount === null || waitingLeadCount === 0}
          type="button"
          onClick={onRemoveAll}
        >
          <Trash2 aria-hidden="true" size={17} />
          Remove all
        </button>
      </section>

      {isLoading ? (
        <section className="agent-results-empty" role="status">
          Loading queue results...
        </section>
      ) : error ? (
        <section className="agent-results-empty">
          <p className="form-error" role="alert">
            {error}
          </p>
          <button className="ui-button ui-button-ghost" type="button" onClick={onReload}>
            Reload queue
          </button>
        </section>
      ) : leads.length > 0 ? (
        <section className="agent-results" aria-label="Jobs waiting to be applied">
          <div className="agent-results-heading">
            <span>{filtered ? `${resultCount} matching jobs` : `${resultCount} jobs`}</span>
            {!filtered && <span> · newest first</span>}
          </div>
          <div className="agent-lead-list">
            {leads.map((lead, index) => {
              const presentation = getJobLeadPresentation(lead)
              const found = importedDate(lead.discoveredAt)
              return (
                <article
                  className={`agent-lead ${presentation.salaryLabel ? 'with-salary' : 'without-salary'}`}
                  key={lead.id}
                  style={{ '--reveal-delay': `${80 + Math.min(index, 8) * 60}ms` }}
                >
                  <div className="agent-lead-details">
                    <div className="agent-lead-main">
                      <div className="agent-lead-source">
                        <span className={`agent-source-chip source-${lead.source}`}>
                          {sourceLabel(lead.source)}
                        </span>
                        {found && <span>Found {found}</span>}
                      </div>
                      <div className="agent-lead-heading">
                        <p>{lead.company}</p>
                        <h2>{lead.title}</h2>
                      </div>
                      <div className="agent-lead-meta">
                        <span className="agent-meta-item agent-location">
                          <MapPin aria-hidden="true" size={14} />
                          {lead.location || 'Location not listed'}
                        </span>
                        {presentation.highlights.map((highlight) => (
                          <span className="agent-highlight-chip" key={highlight}>
                            <LeadHighlightIcon value={highlight} />
                            {highlight}
                          </span>
                        ))}
                      </div>
                    </div>
                    {presentation.salaryLabel && (
                      <div className="agent-meta-item agent-salary">
                        <Banknote aria-hidden="true" size={18} />
                        <span>{presentation.salaryLabel}</span>
                      </div>
                    )}
                  </div>
                  <div className="agent-lead-actions">
                    <button
                      className="ui-button ui-button-primary agent-finish-action"
                      disabled={isUpdating}
                      type="button"
                      onClick={() => onFinishApplying(lead)}
                    >
                      <CheckCircle2 aria-hidden="true" size={17} />
                      Finished applying
                    </button>
                    <div className="agent-lead-secondary">
                      {lead.applyUrl && (
                        <a
                          className="ui-button ui-button-ghost agent-view-action"
                          href={lead.applyUrl}
                          rel="noreferrer"
                          target="_blank"
                          tabIndex={0}
                          aria-label={`View on ${sourceLabel(lead.source)}`}
                          title={`View on ${sourceLabel(lead.source)}`}
                        >
                          <ExternalLink aria-hidden="true" size={16} />
                          Open
                        </a>
                      )}
                      <button
                        className="ui-button ui-button-ghost agent-remove-action"
                        aria-label="Remove"
                        title="Remove job"
                        disabled={isUpdating}
                        type="button"
                        onClick={() => onRemove(lead)}
                      >
                        <X aria-hidden="true" size={17} />
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
          {pageCount > 1 && (
            <nav className="agent-pagination" aria-label="Job queue pages">
              <button
                className="ui-button ui-button-ghost"
                disabled={safePage === 1}
                type="button"
                onClick={() => changePage(Math.max(1, safePage - 1))}
              >
                Previous
              </button>
              <span>
                Page {safePage} of {pageCount}
              </span>
              <button
                className="ui-button ui-button-ghost"
                disabled={safePage === pageCount}
                type="button"
                onClick={() => changePage(Math.min(pageCount, safePage + 1))}
              >
                Next
              </button>
            </nav>
          )}
        </section>
      ) : (
        <section className="agent-results-empty">
          <CheckCircle2 aria-hidden="true" size={30} />
          <h2>{waitingLeadCount === 0 ? 'No applications waiting' : 'No matching jobs'}</h2>
          <p>
            {waitingLeadCount !== 0
              ? 'Other jobs are waiting in your queue. Clear filters to see them.'
              : inbox?.enabled
                ? 'New jobs from your LinkedIn and Indeed alerts will appear here.'
                : 'Resume job alert imports to receive new jobs.'}
          </p>
          {waitingLeadCount !== 0 && (
            <button className="ui-button ui-button-ghost" type="button" onClick={onClearFilters}>
              Clear filters
            </button>
          )}
        </section>
      )}
    </div>
  )
}

export default JobMatches
