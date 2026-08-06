import { useMemo, useState } from 'react'
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
  sortJobLeadsNewestFirst,
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
}) {
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('all')
  const [page, setPage] = useState(1)
  const latestMessage = messages[0]
  const hasLinkedIn = messages.some((message) => message.provider === 'linkedin')
  const hasIndeed = messages.some((message) => message.provider === 'indeed')
  const waitingLeadCount = leads.filter(
    (lead) => lead.state !== 'applied' && lead.state !== 'expired',
  ).length

  const visibleLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return sortJobLeadsNewestFirst(
      leads.filter((lead) => {
        const isWaiting = lead.state !== 'applied' && lead.state !== 'expired'
        const matchesSource = source === 'all' || lead.source === source
        const matchesQuery =
          !normalizedQuery ||
          `${lead.company} ${lead.title} ${lead.location}`
            .toLowerCase()
            .includes(normalizedQuery)

        return isWaiting && matchesSource && matchesQuery
      }),
    )
  }, [leads, query, source])
  const pageCount = Math.max(1, Math.ceil(visibleLeads.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageLeads = visibleLeads.slice((safePage - 1) * pageSize, safePage * pageSize)

  function changePage(nextPage) {
    setPage(nextPage)
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
            <strong>{waitingLeadCount} waiting</strong>
            <button
              className="danger-action agent-remove-all-action"
              disabled={isUpdating || waitingLeadCount === 0}
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
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder="Search company, title, location"
            />
          </label>
          <label className="agent-source-field">
            <span>Source</span>
            <select
              value={source}
              onChange={(event) => {
                setSource(event.target.value)
                setPage(1)
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

      {visibleLeads.length > 0 ? (
        <section className="agent-results" aria-label="Jobs waiting to be applied">
          <div className="agent-results-heading only-count">
            <span>{visibleLeads.length} jobs</span>
          </div>

          <div className="agent-lead-list">
            {pageLeads.map((lead) => {
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
          <h2>No applications waiting</h2>
          <p>
            {inbox?.enabled
              ? 'New jobs from your LinkedIn and Indeed alerts will appear here.'
              : 'Resume job alert imports to receive new jobs.'}
          </p>
        </section>
      )}
    </div>
  )
}

export default JobMatches
