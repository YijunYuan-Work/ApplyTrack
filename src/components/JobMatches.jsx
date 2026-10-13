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
import {
  formatJobAgentDate,
  getJobLeadPresentation,
} from '../data/jobAgent'

const pageSize = 20

function sourceLabel(source) {
  if (source === 'linkedin') return 'LinkedIn'
  if (source === 'indeed') return 'Indeed'
  return 'Job alert'
}

function LeadHighlightIcon({ value }) {
  if (/alum/i.test(value)) {
    return <UsersRound aria-hidden="true" size={16} />
  }

  if (/remote/i.test(value)) {
    return <MapPin aria-hidden="true" size={16} />
  }

  return <CheckCircle2 aria-hidden="true" size={16} />
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

  function changePage(nextPage) {
    onPageChange(nextPage)
    requestAnimationFrame(() => {
      window.scrollTo({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
        left: 0,
        top: 0,
      })
    })
  }

  return (
    <div className="agent-matches-layout">
      <section className="agent-match-toolbar">
        <div className="agent-queue-heading">
          <div>
            <p className="eyebrow">Application queue</p>
            <h2>Jobs waiting for you</h2>
            <p>Open a job, apply on LinkedIn or Indeed, then confirm it here.</p>
          </div>
          <div className="agent-queue-controls">
            <strong>{isLoading ? 'Loading queue...' : waitingLeadCount === null ? 'Count unavailable' : `${waitingLeadCount} waiting`}</strong>
            <button
              className="danger-action agent-remove-all-action"
              disabled={isUpdating || isLoading || waitingLeadCount === null || waitingLeadCount === 0}
              type="button"
              onClick={onRemoveAll}
            >
              <Trash2 aria-hidden="true" size={17} />
              Remove all
            </button>
          </div>
        </div>

        <div className="agent-match-actions">
          <label className="agent-search-field">
            <Search aria-hidden="true" size={18} />
            <span className="visually-hidden">Search jobs waiting to be applied</span>
            <input
              value={query}
              onChange={(event) => {
                onQueryChange(event.target.value)
              }}
              placeholder="Search company, title, location"
            />
          </label>
          <label className="agent-source-field">
            <span>Source</span>
            <select
              value={source}
              onChange={(event) => {
                onSourceChange(event.target.value)
              }}
            >
              <option value="all">All job alerts</option>
              <option value="linkedin">LinkedIn</option>
              <option value="indeed">Indeed</option>
            </select>
          </label>
        </div>

        <div className="agent-alert-status">
          <span>
            <strong>Last alert</strong>
            {formatJobAgentDate(inbox?.lastReceivedAt)}
          </span>
          <span>
            <strong>LinkedIn</strong>
            {hasLinkedIn ? 'Receiving alerts' : 'Waiting for first alert'}
          </span>
          <span>
            <strong>Indeed</strong>
            {hasIndeed ? 'Receiving alerts' : 'Waiting for first alert'}
          </span>
          <span className={latestMessage ? `import-status import-${latestMessage.status}` : ''}>
            <strong>{latestMessage ? `Latest import: ${latestMessage.status}` : 'Import status'}</strong>
            {latestMessage
              ? latestMessage.errorSummary || `${latestMessage.jobsFound} found - ${latestMessage.jobsCreated} new`
              : inbox?.enabled ? 'Ready to receive alerts' : 'Imports paused'}
          </span>
        </div>
      </section>

      {isLoading ? (
        <section className="page-loading-state" role="status">Loading queue results...</section>
      ) : error ? (
        <section className="agent-results-empty">
          <p className="form-error" role="alert">{error}</p>
          <button className="secondary-action" type="button" onClick={onReload}>Reload queue</button>
        </section>
      ) : leads.length > 0 ? (
        <section className="agent-results" aria-label="Jobs waiting to be applied">
          <div className="agent-results-heading only-count">
            <span>{query.trim() || source !== 'all' ? `${resultCount} matching jobs` : `${resultCount} jobs`}</span>
          </div>

          <div className="agent-lead-list">
            {leads.map((lead) => {
              const presentation = getJobLeadPresentation(lead)

              return (
              <article className="agent-lead without-selection" key={lead.id}>
                <div className="agent-lead-main">
                  <div className="agent-lead-heading">
                    <div>
                      <p>{lead.company}</p>
                      <h3>{lead.title}</h3>
                    </div>
                  </div>
                  <div className="agent-lead-meta">
                    <span className={`agent-source-chip source-${lead.source}`}>
                      {sourceLabel(lead.source)}
                    </span>
                    <div className="agent-lead-details">
                      <span className="agent-meta-item">
                        <MapPin aria-hidden="true" size={17} />
                        {lead.location || 'Location not listed'}
                      </span>
                      {presentation.salaryLabel && (
                        <span className="agent-meta-item">
                          <Banknote aria-hidden="true" size={17} />
                          {presentation.salaryLabel}
                        </span>
                      )}
                    </div>
                  </div>
                  {presentation.highlights.length > 0 && (
                    <div className="agent-lead-highlight">
                      <div className="agent-highlight-chips">
                        {presentation.highlights.map((highlight) => (
                          <span className="agent-highlight-chip" key={highlight}>
                            <LeadHighlightIcon value={highlight} />
                            {highlight}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="agent-lead-actions">
                  {lead.applyUrl && (
                    <a
                      className="primary-action agent-view-action"
                      href={lead.applyUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      View on {sourceLabel(lead.source)}
                      <ExternalLink aria-hidden="true" size={17} />
                    </a>
                  )}
                  <button
                    className="secondary-action agent-finish-action"
                    disabled={isUpdating}
                    type="button"
                    onClick={() => onFinishApplying(lead)}
                  >
                    <CheckCircle2 aria-hidden="true" size={17} />
                    Finished applying
                  </button>
                  <button
                    className="secondary-action agent-remove-action"
                    disabled={isUpdating}
                    type="button"
                    onClick={() => onRemove(lead)}
                  >
                    <X aria-hidden="true" size={17} />
                    Remove
                  </button>
                </div>
              </article>
              )
            })}
          </div>

          {pageCount > 1 && (
            <div className="agent-pagination">
              <button
                className="secondary-action"
                disabled={safePage === 1}
                type="button"
                onClick={() => changePage(Math.max(1, safePage - 1))}
              >
                Previous
              </button>
              <span>Page {safePage} of {pageCount}</span>
              <button
                className="secondary-action"
                disabled={safePage === pageCount}
                type="button"
                onClick={() => changePage(Math.min(pageCount, safePage + 1))}
              >
                Next
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="agent-results-empty">
          <CheckCircle2 aria-hidden="true" size={30} />
          <h2>{waitingLeadCount === 0 ? 'No applications waiting' : 'No matching jobs'}</h2>
          <p>
            {waitingLeadCount !== 0 ? 'Other jobs are waiting in your queue. Clear filters to see them.' : inbox?.enabled
              ? 'New jobs from your LinkedIn and Indeed alerts will appear here.'
              : 'Resume job alert imports to receive new jobs.'}
          </p>
          {waitingLeadCount !== 0 && <button className="secondary-action" type="button" onClick={onClearFilters}>Clear filters</button>}
        </section>
      )}
    </div>
  )
}

export default JobMatches
