import { useEffect, useState } from 'react'
import { SearchCheck, Settings2 } from 'lucide-react'
import {
  completeJobLeadApplication,
  createJobAlertInbox,
  fetchJobAgentWorkspace,
  removeJobLead,
  updateJobAlertInbox,
} from '../api/jobAgent'
import AppLayout from '../components/AppLayout'
import JobAgentSetup from '../components/JobAgentSetup'
import JobMatches from '../components/JobMatches'
import { getTodayIsoDate } from '../data/applications'

function JobAgentPage({
  demoWorkspace = null,
  isDemo = false,
  onAddApplication,
  onDashboard,
  onImportExcel,
  onJobAgent,
  onApplicationCreated,
  onDemoWorkspaceChange,
  onJobLeadRemoved,
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
  const [isUpdating, setIsUpdating] = useState(false)
  const [pageError, setPageError] = useState('')
  const [pageNotice, setPageNotice] = useState('')
  const activeWorkspace = isDemo ? demoWorkspace : workspace

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
  }, [isDemo, user.id])

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
    const confirmed = window.confirm(
      `Confirm that you submitted your application for ${lead.title} at ${lead.company}? ApplyTrack will add it to your pipeline.`,
    )

    if (!confirmed) {
      return
    }

    setIsUpdating(true)
    setPageError('')
    setPageNotice('')

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
        onApplicationCreated(application)
        setPageNotice(
          `${application.role} at ${application.company} was added to your sample pipeline.`,
        )
        return
      }

      const application = await completeJobLeadApplication(
        lead.id,
        getTodayIsoDate(),
      )
      updateWorkspace((current) => ({
        ...current,
        leads: current.leads.map((currentLead) =>
          currentLead.id === lead.id
            ? {
                ...currentLead,
                applicationId: application.id,
                state: 'applied',
              }
            : currentLead,
        ),
      }))
      onApplicationCreated(application)
      setPageNotice(`${application.role} at ${application.company} was added to your pipeline.`)
    } catch (error) {
      setPageError(error.message)
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleRemoveLead(lead) {
    const confirmed = window.confirm(
      `Remove ${lead.title} at ${lead.company} from your application queue?`,
    )

    if (!confirmed) {
      return
    }

    setIsUpdating(true)
    setPageError('')
    setPageNotice('')

    try {
      if (isDemo) {
        updateWorkspace((current) => ({
          ...current,
          leads: current.leads.filter((currentLead) => currentLead.id !== lead.id),
        }))
        onJobLeadRemoved()
        setPageNotice(
          `${lead.title} at ${lead.company} was removed from your sample queue.`,
        )
        return
      }

      await removeJobLead(lead.id, user.id)
      updateWorkspace((current) => ({
        ...current,
        leads: current.leads.filter((currentLead) => currentLead.id !== lead.id),
      }))
      onJobLeadRemoved()
      setPageNotice(`${lead.title} at ${lead.company} was removed from your queue.`)
    } catch (error) {
      setPageError(error.message)
    } finally {
      setIsUpdating(false)
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
      <main className="job-agent-page">
        <header className="job-agent-header">
          <div>
            <p className="eyebrow">Job Agent</p>
            <h1>Turn job alerts into an application queue.</h1>
            <p>Bring in LinkedIn and Indeed alerts, apply on the source site, and move finished applications into your pipeline.</p>
          </div>
        </header>

        <div className="job-agent-tabs" role="tablist" aria-label="Job Agent views">
          <button
            aria-selected={view === 'setup'}
            className={view === 'setup' ? 'active' : ''}
            role="tab"
            type="button"
            onClick={onJobAgent}
          >
            <Settings2 aria-hidden="true" size={19} />
            Setup
          </button>
          <button
            aria-selected={view === 'matches'}
            className={view === 'matches' ? 'active' : ''}
            role="tab"
            type="button"
            onClick={onViewMatches}
          >
            <SearchCheck aria-hidden="true" size={19} />
            Matches
            {activeWorkspace?.leads && (
              <span>
                {activeWorkspace.leads.filter(
                  (lead) => lead.state !== 'applied' && lead.state !== 'expired',
                ).length}
              </span>
            )}
          </button>
        </div>

        {pageNotice && <p className="agent-page-notice" role="status">{pageNotice}</p>}
        {pageError && <p className="form-error agent-page-error" role="alert">{pageError}</p>}

        {isLoading ? (
          <section className="page-loading-state" role="status">
            <p className="eyebrow">Job Agent</p>
            <h2>Loading your setup.</h2>
          </section>
        ) : activeWorkspace && view === 'matches' ? (
          <JobMatches
            inbox={activeWorkspace.inbox}
            isUpdating={isUpdating}
            leads={activeWorkspace.leads}
            messages={activeWorkspace.messages}
            onFinishApplying={handleFinishApplying}
            onRemove={handleRemoveLead}
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
        ) : null}
      </main>
    </AppLayout>
  )
}

export default JobAgentPage
