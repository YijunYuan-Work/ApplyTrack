import { useMemo, useState } from 'react'
import {
  Bookmark,
  CheckSquare2,
  ExternalLink,
  RotateCcw,
  Search,
  X,
} from 'lucide-react'
import { formatJobAgentDate, formatSalary } from '../data/jobAgent'

const pageSize = 20

function sourceLabel(source) {
  if (source === 'linkedin') return 'LinkedIn'
  if (source === 'indeed') return 'Indeed'
  return 'Job alert'
}

function JobMatches({ inbox, isUpdating, leads, messages, onUpdateStates, search }) {
  const [view, setView] = useState('matches')
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('all')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState([])
  const latestMessage = messages[0]
  const hasLinkedIn = messages.some((message) => message.provider === 'linkedin')
  const hasIndeed = messages.some((message) => message.provider === 'indeed')

  const sourceLeads = useMemo(
    () => leads.filter((lead) => {
      if (source === 'all') return true
      return lead.source === source
    }),
    [leads, source],
  )
  const counts = useMemo(
    () => ({
      dismissed: sourceLeads.filter((lead) => lead.state === 'dismissed').length,
      filtered: sourceLeads.filter((lead) => lead.filtered).length,
      matches: sourceLeads.filter((lead) => lead.state === 'new' && !lead.filtered).length,
      saved: sourceLeads.filter((lead) => lead.state === 'shortlisted').length,
    }),
    [sourceLeads],
  )
  const visibleLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return sourceLeads.filter((lead) => {
      const matchesView =
        view === 'filtered'
          ? lead.filtered
          : view === 'saved'
            ? lead.state === 'shortlisted'
            : view === 'dismissed'
              ? lead.state === 'dismissed'
              : lead.state === 'new' && !lead.filtered
      const matchesQuery =
        !normalizedQuery ||
        `${lead.company} ${lead.title} ${lead.location}`
          .toLowerCase()
          .includes(normalizedQuery)
      return matchesView && matchesQuery
    })
  }, [query, sourceLeads, view])
  const pageCount = Math.max(1, Math.ceil(visibleLeads.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageLeads = visibleLeads.slice((safePage - 1) * pageSize, safePage * pageSize)
  const allPageSelected =
    pageLeads.length > 0 && pageLeads.every((lead) => selectedIds.includes(lead.id))

  function changeView(nextView) {
    setView(nextView)
    setPage(1)
    setSelectedIds([])
  }

  function toggleLead(leadId) {
    setSelectedIds((current) =>
      current.includes(leadId)
        ? current.filter((id) => id !== leadId)
        : [...current, leadId],
    )
  }

  function togglePage() {
    const pageIds = pageLeads.map((lead) => lead.id)
    setSelectedIds((current) =>
      allPageSelected
        ? current.filter((id) => !pageIds.includes(id))
        : [...new Set([...current, ...pageIds])],
    )
  }

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

  async function updateSelected(state) {
    await onUpdateStates(selectedIds, state)
    setSelectedIds([])
  }

  return (
    <div className="agent-matches-layout">
      <section className="agent-match-toolbar">
        <div className="agent-view-tabs" role="tablist" aria-label="Job lead status">
          {[
            ['matches', 'New matches'],
            ['saved', 'Saved'],
            ['dismissed', 'Dismissed'],
            ['filtered', 'Filtered out'],
          ].map(([key, label]) => (
            <button
              aria-selected={view === key}
              className={view === key ? 'active' : ''}
              key={key}
              role="tab"
              type="button"
              onClick={() => changeView(key)}
            >
              {label}
              <span>{counts[key]}</span>
            </button>
          ))}
        </div>

        <div className="agent-match-actions">
          <label className="agent-search-field">
            <Search aria-hidden="true" size={18} />
            <span className="visually-hidden">Search job matches</span>
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
                setSelectedIds([])
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
              ? latestMessage.errorSummary || `${latestMessage.jobsFound} found · ${latestMessage.jobsCreated} new`
              : inbox?.enabled ? 'Ready to receive alerts' : 'Imports paused'}
          </span>
        </div>
      </section>

      {selectedIds.length > 0 && view !== 'filtered' && (
        <div className="agent-bulk-bar" role="status">
          <strong>{selectedIds.length} selected</strong>
          <div>
            {view !== 'saved' && (
              <button className="secondary-action" disabled={isUpdating} type="button" onClick={() => updateSelected('shortlisted')}>
                <Bookmark aria-hidden="true" size={17} />
                Save selected
              </button>
            )}
            {view !== 'dismissed' && (
              <button className="secondary-action" disabled={isUpdating} type="button" onClick={() => updateSelected('dismissed')}>
                <X aria-hidden="true" size={17} />
                Dismiss selected
              </button>
            )}
            {(view === 'saved' || view === 'dismissed') && (
              <button className="secondary-action" disabled={isUpdating} type="button" onClick={() => updateSelected('new')}>
                <RotateCcw aria-hidden="true" size={17} />
                Return to matches
              </button>
            )}
          </div>
        </div>
      )}

      {visibleLeads.length > 0 ? (
        <section className="agent-results" aria-label="Job leads">
          <div className={`agent-results-heading ${view === 'filtered' ? 'only-count' : ''}`}>
            {view !== 'filtered' && (
              <label className="agent-select-all">
                <input checked={allPageSelected} type="checkbox" onChange={togglePage} />
                <span>Select this page</span>
              </label>
            )}
            <span>{visibleLeads.length} jobs</span>
          </div>

          <div className="agent-lead-list">
            {pageLeads.map((lead) => (
              <article
                className={`agent-lead ${view === 'filtered' ? 'without-selection' : ''} ${selectedIds.includes(lead.id) ? 'selected' : ''}`}
                key={lead.id}
              >
                {view !== 'filtered' && (
                  <label className="agent-lead-select">
                    <input
                      aria-label={`Select ${lead.title} at ${lead.company}`}
                      checked={selectedIds.includes(lead.id)}
                      type="checkbox"
                      onChange={() => toggleLead(lead.id)}
                    />
                  </label>
                )}
                <div className="agent-lead-main">
                  <div className="agent-lead-heading">
                    <div>
                      <p>{lead.company}</p>
                      <h3>{lead.title}</h3>
                    </div>
                    {!lead.filtered && (
                      <span className="match-score" aria-label={`${lead.matchScore} percent match`}>
                        {lead.matchScore}% match
                      </span>
                    )}
                  </div>
                  <div className="agent-lead-meta">
                    <span className={`agent-source-chip source-${lead.source}`}>{sourceLabel(lead.source)}</span>
                    <span>{lead.location || 'Location not listed'}</span>
                    <span>{lead.contractType || 'Type not listed'}</span>
                    <span>{formatSalary(lead.salaryMin, lead.salaryMax)}</span>
                    <span>Posted {formatJobAgentDate(lead.postedAt, 'date unavailable')}</span>
                  </div>
                  {lead.description && <p className="agent-lead-description">{lead.description}</p>}
                  <div className="agent-reason-list">
                    {(lead.filtered ? lead.filterReasons : lead.matchReasons).map((reason) => (
                      <span className={lead.filtered ? 'filter-reason' : ''} key={reason}>
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="agent-lead-actions">
                  {lead.applyUrl && (
                    <a className="secondary-action" href={lead.applyUrl} rel="noreferrer" target="_blank">
                      <ExternalLink aria-hidden="true" size={17} />
                      View on {sourceLabel(lead.source)}
                    </a>
                  )}
                  {!lead.filtered && lead.state !== 'shortlisted' && (
                    <button className="secondary-action" disabled={isUpdating} type="button" onClick={() => onUpdateStates([lead.id], 'shortlisted')}>
                      <Bookmark aria-hidden="true" size={17} />
                      Save
                    </button>
                  )}
                  {!lead.filtered && lead.state !== 'dismissed' && (
                    <button className="secondary-action" disabled={isUpdating} type="button" onClick={() => onUpdateStates([lead.id], 'dismissed')}>
                      <X aria-hidden="true" size={17} />
                      Dismiss
                    </button>
                  )}
                  {!lead.filtered && lead.state !== 'new' && (
                    <button className="secondary-action" disabled={isUpdating} type="button" onClick={() => onUpdateStates([lead.id], 'new')}>
                      <RotateCcw aria-hidden="true" size={17} />
                      Restore
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          {pageCount > 1 && (
            <div className="agent-pagination">
              <button className="secondary-action" disabled={safePage === 1} type="button" onClick={() => changePage(Math.max(1, safePage - 1))}>
                Previous
              </button>
              <span>Page {safePage} of {pageCount}</span>
              <button className="secondary-action" disabled={safePage === pageCount} type="button" onClick={() => changePage(Math.min(pageCount, safePage + 1))}>
                Next
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="agent-results-empty">
          <CheckSquare2 aria-hidden="true" size={30} />
          <h2>{view === 'matches' ? 'No new matches yet' : `No ${view} jobs`}</h2>
          <p>
            {inbox?.enabled && search?.enabled
              ? 'Forward a LinkedIn or Indeed job alert, or adjust your source filter.'
              : 'Finish setup and enable alert imports before waiting for your first match.'}
          </p>
        </section>
      )}
    </div>
  )
}

export default JobMatches
