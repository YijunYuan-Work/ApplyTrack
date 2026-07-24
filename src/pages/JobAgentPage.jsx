import { useEffect, useState } from 'react'
import { SearchCheck, Settings2 } from 'lucide-react'
import {
  completeJobLeadApplication,
  createJobAlertInbox,
  deleteResume,
  downloadResumeFile,
  fetchJobAgentWorkspace,
  removeJobLead,
  saveJobAgentProfile,
  updateJobAlertInbox,
  updateResumeText,
  uploadResume,
} from '../api/jobAgent'
import AppLayout from '../components/AppLayout'
import JobAgentSetup from '../components/JobAgentSetup'
import JobMatches from '../components/JobMatches'
import { getTodayIsoDate } from '../data/applications'
import { extractResumeText } from '../utils/resumeParser'

function JobAgentPage({
  onAddApplication,
  onDashboard,
  onImportExcel,
  onJobAgent,
  onApplicationCreated,
  onJobLeadRemoved,
  onProfile,
  onProgress,
  onSignOut,
  onViewMatches,
  user,
  view,
}) {
  const [workspace, setWorkspace] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isManagingAlerts, setIsManagingAlerts] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [pageError, setPageError] = useState('')
  const [pageNotice, setPageNotice] = useState('')

  useEffect(() => {
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
  }, [user.id])

  async function handleSave(profile) {
    setIsSaving(true)
    setPageError('')

    try {
      const savedProfile = await saveJobAgentProfile(profile, user.id)
      setWorkspace((current) => ({
        ...current,
        profile: savedProfile,
      }))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUploadResume(file) {
    const extracted = await extractResumeText(file)
    const resume = await uploadResume(file, extracted, user.id)
    setWorkspace((current) => ({
      ...current,
      resumes: [resume, ...current.resumes.map((item) => ({ ...item, isPrimary: false }))],
    }))
    return resume
  }

  async function handleUpdateResume(resumeId, text, skills) {
    const resume = await updateResumeText(resumeId, text, skills)
    setWorkspace((current) => ({
      ...current,
      resumes: current.resumes.map((item) => (item.id === resumeId ? resume : item)),
    }))
    return resume
  }

  async function handleDownloadResume(resume) {
    const file = await downloadResumeFile(resume)
    const objectUrl = window.URL.createObjectURL(file)
    const link = document.createElement('a')

    link.href = objectUrl
    link.download = resume.fileName
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000)
  }

  async function handleDeleteResume(resume) {
    const confirmed = window.confirm(
      `Delete ${resume.fileName}? You can upload another resume later.`,
    )

    if (!confirmed) {
      return false
    }

    await deleteResume(resume)
    setWorkspace((current) => ({
      ...current,
      resumes: current.resumes.filter((item) => item.id !== resume.id),
    }))
    return true
  }

  async function handleCreateInbox() {
    setIsManagingAlerts(true)
    setPageError('')
    setPageNotice('')

    try {
      const inbox = await createJobAlertInbox(user.id)
      setWorkspace((current) => ({ ...current, inbox }))
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
      const inbox = await updateJobAlertInbox(workspace.inbox.id, { enabled })
      setWorkspace((current) => ({ ...current, inbox }))
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
      const inbox = await updateJobAlertInbox(workspace.inbox.id, {
        enabled: true,
        rotateAddress: true,
      })
      setWorkspace((current) => ({ ...current, inbox }))
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
      const application = await completeJobLeadApplication(
        lead.id,
        getTodayIsoDate(),
      )
      setWorkspace((current) => ({
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
      await removeJobLead(lead.id, user.id)
      setWorkspace((current) => ({
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
            {workspace?.leads && (
              <span>
                {workspace.leads.filter(
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
        ) : workspace && view === 'matches' ? (
          <JobMatches
            inbox={workspace.inbox}
            isUpdating={isUpdating}
            leads={workspace.leads}
            messages={workspace.messages}
            onFinishApplying={handleFinishApplying}
            onRemove={handleRemoveLead}
          />
        ) : workspace ? (
          <JobAgentSetup
            inbox={workspace.inbox}
            initialProfile={workspace.profile}
            isManagingAlerts={isManagingAlerts}
            isSaving={isSaving}
            messages={workspace.messages}
            resumes={workspace.resumes}
            user={user}
            onCreateInbox={handleCreateInbox}
            onDeleteResume={handleDeleteResume}
            onDownloadResume={handleDownloadResume}
            onRotateInbox={handleRotateInbox}
            onSave={handleSave}
            onToggleInbox={handleToggleInbox}
            onUpdateResume={handleUpdateResume}
            onUploadResume={handleUploadResume}
          />
        ) : null}
      </main>
    </AppLayout>
  )
}

export default JobAgentPage
