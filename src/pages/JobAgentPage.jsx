import { useEffect, useRef, useState } from 'react'
import { SearchCheck, Settings2 } from 'lucide-react'
import {
  completeJobLeadApplication,
  createJobAlertInbox,
  fetchJobAgentWorkspace,
  fetchJobLeadQueue,
  fetchJobLeadRemovalScope,
  removeJobLead,
  removeAllWaitingJobLeads,
  updateJobAlertInbox,
} from '../api/jobAgent'
import AppLayout from '../components/AppLayout'
import JobAgentSetup from '../components/JobAgentSetup'
import JobMatches from '../components/JobMatches'
import { getTodayIsoDate } from '../data/applications'
import { sortJobLeadsNewestFirst } from '../data/jobAgent'
import { getRoute } from '../utils/routes'
import '../styles/job-agent.css'

function JobAgentPage({
  demoWorkspace = null,
  isDemo = false,
  onAddApplication,
  onDashboard,
  onImportExcel,
  onJobAgent,
  onApplicationCreated,
  onDemoWorkspaceChange,
  onQueueChanged,
  captureJobSession,
  mutationPending,
  queueRevision = 0,
  onProfile,
  onProgress,
  onSignOut,
  onViewMatches,
  user,
  view,
}) {
  const [workspace, setWorkspace] = useState(null)
  const [isLoading, setIsLoading] = useState(() => !isDemo)
  const [isManagingAlerts, setIsManagingAlerts] = useState(false)
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('all')
  const [page, setPage] = useState(1)
  const [queue, setQueue] = useState(null)
  const [queueLoading, setQueueLoading] = useState(!isDemo)
  const [queueError, setQueueError] = useState('')
  const [reload, setReload] = useState(0)
  const active = useRef(false)
  const navigationRevision = useRef(0)
  const [pageError, setPageError] = useState('')
  const [pageNotice, setPageNotice] = useState('')
  const activeWorkspace = isDemo ? demoWorkspace : workspace
  const demoWaiting = isDemo ? sortJobLeadsNewestFirst(demoWorkspace.leads.filter((lead) => lead.state === 'new')) : []
  const demoResults = demoWaiting.filter((lead) => (source === 'all' || lead.source === source) &&
    `${lead.company} ${lead.title} ${lead.location}`.toLowerCase().includes(query.trim().toLowerCase()))
  const demoPage = Math.min(page, Math.max(1, Math.ceil(demoResults.length / 20)))
  const displayedQueue = isDemo ? {
    pendingCount: demoWaiting.length, resultCount: demoResults.length,
    leads: demoResults.slice((demoPage - 1) * 20, demoPage * 20),
  } : queue

  useEffect(() => {
    active.current = true
    const moved = () => { navigationRevision.current += 1 }
    window.addEventListener('hashchange', moved)
    return () => { active.current = false; window.removeEventListener('hashchange', moved) }
  }, [])

  useEffect(() => {
    if (isDemo) return undefined
    let current = true
    async function loadQueue() {
      setQueueLoading(true)
      setQueueError('')
      return fetchJobLeadQueue(user.id, { page, query, source })
    }
    loadQueue().then((data) => {
      if (!current) return
      const lastPage = Math.max(1, Math.ceil(data.resultCount / 20))
      if (page > lastPage) { setPage(lastPage); return }
      setQueue(data)
      setQueueLoading(false)
    }).catch((error) => {
      if (!current) return
      setQueue(null)
      setQueueError(error.message || 'Could not load the queue. Reload to try again.')
      setQueueLoading(false)
    })
    return () => { current = false }
  }, [isDemo, user.id, page, query, source, reload, queueRevision])

  function beginMutation(session) {
    if (!session.begin()) return false
    setPageError('')
    setPageNotice('')
    return true
  }

  function endMutation(session) {
    session.end()
  }

  function refreshQueue(session) {
    if (session.isCurrent()) onQueueChanged(session)
  }

  function updateWorkspace(updater) {
    if (isDemo) {
      onDemoWorkspaceChange(updater)
    } else {
      setWorkspace(updater)
    }
  }

  useEffect(() => {
    if (isDemo) {
      return undefined
    }

    let isMounted = true

    async function load() {
      setIsLoading(true)
      setPageError('')

      try {
        const data = await fetchJobAgentWorkspace(user.id)

        if (isMounted) {
          setWorkspace(data)
        }
      } catch (error) {
        if (isMounted) {
          setPageError(error.message)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [isDemo, user.id, reload])

  async function handleCreateInbox() {
    setIsManagingAlerts(true)
    setPageError('')
    setPageNotice('')

    try {
      if (isDemo) {
        updateWorkspace((current) => ({
          ...current,
          inbox: {
            address: 'demo-alerts@inbound.applytrack.app',
            addressAlias: 'demo-alerts',
            enabled: true,
            id: 'demo-inbox',
            lastReceivedAt: null,
          },
        }))
        setPageNotice('Your sample forwarding address is ready.')
        return
      }

      const inbox = await createJobAlertInbox(user.id)
      updateWorkspace((current) => ({ ...current, inbox }))
      setPageNotice('Your private forwarding address is ready.')
    } catch (error) {
      setPageError(error.message)
    } finally {
      setIsManagingAlerts(false)
    }
  }

  async function handleToggleInbox(enabled) {
    setIsManagingAlerts(true)
    setPageError('')

    try {
      if (isDemo) {
        updateWorkspace((current) => ({
          ...current,
          inbox: { ...current.inbox, enabled },
        }))
        setPageNotice(enabled ? 'Job alert imports resumed.' : 'Job alert imports paused.')
        return
      }

      const inbox = await updateJobAlertInbox(activeWorkspace.inbox.id, { enabled })
      updateWorkspace((current) => ({ ...current, inbox }))
      setPageNotice(enabled ? 'Job alert imports resumed.' : 'Job alert imports paused.')
    } catch (error) {
      setPageError(error.message)
    } finally {
      setIsManagingAlerts(false)
    }
  }

  async function handleRotateInbox() {
    const confirmed = window.confirm(
      'Replace this forwarding address? Alerts sent to the old address will stop importing immediately.',
    )

    if (!confirmed) return

    setIsManagingAlerts(true)
    setPageError('')

    try {
      if (isDemo) {
        updateWorkspace((current) => ({
          ...current,
          inbox: {
            ...current.inbox,
            address: 'new-demo-alerts@inbound.applytrack.app',
            addressAlias: 'new-demo-alerts',
            enabled: true,
          },
        }))
        setPageNotice('Sample forwarding address replaced.')
        return
      }

      const inbox = await updateJobAlertInbox(activeWorkspace.inbox.id, {
        enabled: true,
        rotateAddress: true,
      })
      updateWorkspace((current) => ({ ...current, inbox }))
      setPageNotice('Forwarding address replaced. Update your email forwarding rule.')
    } catch (error) {
      setPageError(error.message)
    } finally {
      setIsManagingAlerts(false)
    }
  }

  async function handleFinishApplying(lead) {
    const session = captureJobSession()
    const origin = getRoute()
    const revision = navigationRevision.current
    const canShow = () => active.current && session.isCurrent() && navigationRevision.current === revision && getRoute() === origin
    const confirmed = window.confirm(
      `Confirm that you submitted your application for ${lead.title} at ${lead.company}? ApplyTrack will add it to your pipeline.`,
    )

    if (!confirmed) {
      return
    }

    if (!beginMutation(session)) return

    try {
      if (isDemo) {
        const application = {
          company: lead.company,
          contact: '',
          coverLetter: 'No',
          date: getTodayIsoDate(),
          followUp: '',
          id: `demo-job-${lead.id}`,
          interviewCount: 0,
          jobUrl: lead.applyUrl || '',
          lastUpdated: getTodayIsoDate(),
          location: lead.location || 'Not specified',
          notes: `Added from a sample ${lead.source === 'linkedin' ? 'LinkedIn' : 'Indeed'} job alert.`,
          referral: 'No',
          role: lead.title,
          salary: lead.salaryMin || lead.salaryMax
            ? [lead.salaryMin, lead.salaryMax]
                .filter(Boolean)
                .map((value) => `$${Number(value).toLocaleString()}`)
                .join(' - ')
            : '',
          status: 'Applied',
        }
        updateWorkspace((current) => ({
          ...current,
          leads: current.leads.map((currentLead) =>
            currentLead.id === lead.id
              ? { ...currentLead, applicationId: application.id, state: 'applied' }
              : currentLead,
          ),
        }))
        onApplicationCreated(application, session)
        setPageNotice(
          `${application.role} at ${application.company} was added to your sample pipeline.`,
        )
        return
      }

      const application = await completeJobLeadApplication(
        lead.id,
        getTodayIsoDate(),
      )
      if (!session.isCurrent()) return
      onApplicationCreated(application, session)
      if (canShow()) setPageNotice(`${application.role} at ${application.company} was added to your pipeline.`)
    } catch (error) {
      if (canShow()) setPageError(`Application could not be confirmed. ${error.message} Reload to check before retrying.`)
    } finally {
      refreshQueue(session)
      endMutation(session)
    }
  }

  async function handleRemoveLead(lead) {
    const session = captureJobSession()
    const origin = getRoute()
    const revision = navigationRevision.current
    const canShow = () => active.current && session.isCurrent() && navigationRevision.current === revision && getRoute() === origin
    const confirmed = window.confirm(
      `Remove ${lead.title} at ${lead.company} from your application queue?`,
    )

    if (!confirmed) {
      return
    }

    if (!beginMutation(session)) return

    try {
      if (isDemo) {
        updateWorkspace((current) => ({
          ...current,
          leads: current.leads.filter((currentLead) => currentLead.id !== lead.id),
        }))
        setPageNotice(
          `${lead.title} at ${lead.company} was removed from your sample queue.`,
        )
        return
      }

      await removeJobLead(lead.id, user.id)
      if (canShow()) setPageNotice(`${lead.title} at ${lead.company} was removed from your queue.`)
    } catch (error) {
      if (canShow()) setPageError(`Removal could not be confirmed. ${error.message} Reload to check before retrying.`)
    } finally {
      refreshQueue(session)
      endMutation(session)
    }
  }

  async function handleRemoveAllLeads() {
    const session = captureJobSession()
    if (!beginMutation(session)) return
    const origin = getRoute()
    const revision = navigationRevision.current
    const canShow = () => active.current && session.isCurrent() && navigationRevision.current === revision && getRoute() === origin

    try {
      const scope = isDemo ? { count: demoWaiting.length } : await fetchJobLeadRemovalScope(user.id)
      if (!canShow() || scope.count === 0) return
      if (!window.confirm(`Remove all ${scope.count} jobs from your application queue? New alerts may still add jobs. This cannot be undone.`)) return
      if (isDemo) {
        const ids = new Set(demoWaiting.filter((lead) => !lead.applicationId).map((lead) => lead.id))
        updateWorkspace((current) => ({ ...current,
          leads: current.leads.filter((lead) => !ids.has(lead.id) || lead.state !== 'new' || lead.applicationId),
        }))
        setPageNotice(`${ids.size} removals confirmed in your sample queue.`)
        return
      }
      const outcome = await removeAllWaitingJobLeads(user.id, scope, session.isCurrent)
      if (!canShow()) return
      if (outcome.status === 'error') setPageError(outcome.message)
      else if (outcome.status === 'removed') setPageNotice(`${outcome.removedCount} removals confirmed. New alerts may still add jobs.`)
    } catch (error) {
      if (canShow()) setPageError(`Removal could not be confirmed. ${error.message} Reload to check before retrying.`)
    } finally {
      refreshQueue(session)
      endMutation(session)
    }
  }

  return (
    <AppLayout
      currentPage="agent"
      isDemo={isDemo}
      onAddApplication={onAddApplication}
      onDashboard={onDashboard}
      onImportExcel={onImportExcel}
      onJobAgent={onJobAgent}
      onProfile={onProfile}
      onProgress={onProgress}
      onSignOut={onSignOut}
      user={user}
    >
      <div className="job-agent-page">
        <header className="job-agent-header">
          <div>
            <p className="eyebrow">Job Agent · {view === 'matches' ? 'Application queue' : 'Connections'}</p>
            <h1>{view === 'matches' ? 'Jobs waiting for you' : 'Connect your job alerts.'}</h1>
            <p>{view === 'matches' ? 'Open a job, apply on LinkedIn or Indeed, then confirm it here.' : 'Bring your LinkedIn and Indeed alerts into one private queue.'}</p>
          </div>
          {view === 'matches' && <div className="agent-queue-count" aria-live="polite">
            {queueLoading ? 'Loading queue...' : displayedQueue ? <><strong>{displayedQueue.pendingCount}</strong>{' '}<span>waiting</span></> : 'Count unavailable'}
          </div>}
        </header>

        <div className="job-agent-tabs" role="group" aria-label="Job Agent views">
          <button
            aria-pressed={view === 'setup'}
            type="button"
            onClick={onJobAgent}
          >
            <Settings2 aria-hidden="true" size={19} />
            Setup
          </button>
          <button
            aria-pressed={view === 'matches'}
            type="button"
            onClick={onViewMatches}
          >
            <SearchCheck aria-hidden="true" size={19} />
            Matches
            {displayedQueue && !queueLoading && <span>{displayedQueue.pendingCount}</span>}
          </button>
        </div>

        {pageNotice && <p className="agent-page-notice" role="status">{pageNotice}</p>}
        {pageError && <p className="form-error agent-page-error" role="alert">{pageError}</p>}
        {mutationPending && <p className="loading-message" role="status">Updating your queue...</p>}

        {isLoading ? (
          <section className="page-loading-state" role="status">
            <p className="eyebrow">Job Agent</p>
            <h2>Loading your setup.</h2>
          </section>
        ) : activeWorkspace && view === 'matches' ? (
          <JobMatches
            inbox={activeWorkspace.inbox}
            isUpdating={mutationPending}
            leads={displayedQueue?.leads || []}
            waitingLeadCount={displayedQueue?.pendingCount ?? null}
            resultCount={displayedQueue?.resultCount ?? null}
            isLoading={queueLoading}
            error={queueError}
            onReload={() => setReload((current) => current + 1)}
            query={query}
            source={source}
            page={page}
            onQueryChange={(value) => { setQuery(value); setPage(1) }}
            onSourceChange={(value) => { setSource(value); setPage(1) }}
            onPageChange={setPage}
            onClearFilters={() => { setQuery(''); setSource('all'); setPage(1) }}
            messages={activeWorkspace.messages}
            onFinishApplying={handleFinishApplying}
            onRemove={handleRemoveLead}
            onRemoveAll={handleRemoveAllLeads}
          />
        ) : activeWorkspace ? (
          <JobAgentSetup
            inbox={activeWorkspace.inbox}
            isManagingAlerts={isManagingAlerts}
            messages={activeWorkspace.messages}
            onCreateInbox={handleCreateInbox}
            onRotateInbox={handleRotateInbox}
            onToggleInbox={handleToggleInbox}
          />
        ) : (
          <section className="agent-results-empty">
            <h2>Could not load Job Agent</h2>
            <button className="ui-button ui-button-ghost" type="button" onClick={() => setReload((current) => current + 1)}>Reload setup</button>
          </section>
        )}
      </div>
    </AppLayout>
  )
}

export default JobAgentPage
