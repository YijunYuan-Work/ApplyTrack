import { useEffect, useState } from 'react'
import { SearchCheck, Settings2 } from 'lucide-react'
import {
  createJobAlertInbox,
  deleteResume,
  downloadResumeFile,
  fetchJobAgentWorkspace,
  saveJobAgentProfile,
  saveJobSearch,
  updateJobAlertInbox,
  updateJobLeadStates,
  updateResumeText,
  uploadResume,
} from '../api/jobAgent'
import AppLayout from '../components/AppLayout'
import JobAgentSetup from '../components/JobAgentSetup'
import JobMatches from '../components/JobMatches'
import { extractResumeText } from '../utils/resumeParser'

function JobAgentPage({
  onAddApplication,
  onDashboard,
  onImportExcel,
  onJobAgent,
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

  async function handleSave(profile, search) {
    setIsSaving(true)
    setPageError('')

    try {
      const [savedProfile, savedSearch] = await Promise.all([
        saveJobAgentProfile(profile, user.id),
        saveJobSearch(search, user.id),
      ])
      setWorkspace((current) => ({
        ...current,
        profile: savedProfile,
        search: savedSearch,
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
      `Delete ${resume.fileName}? Job matching will be paused until another resume is uploaded.`,
    )

    if (!confirmed) {
      return false
    }

    await deleteResume(resume)
    const pausedProfile = workspace.profile
      ? await saveJobAgentProfile({ ...workspace.profile, enabled: false }, user.id)
      : null
    const pausedSearch = workspace.search
      ? await saveJobSearch({ ...workspace.search, enabled: false }, user.id)
      : null
    setWorkspace((current) => ({
      ...current,
      profile: pausedProfile,
      resumes: current.resumes.filter((item) => item.id !== resume.id),
      search: pausedSearch,
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

  async function handleUpdateStates(leadIds, state) {
    if (leadIds.length === 0) {
      return
    }

    setIsUpdating(true)
    setPageError('')

    try {
      const updated = await updateJobLeadStates(leadIds, state)
      const updatedById = new Map(updated.map((lead) => [lead.id, lead]))
      setWorkspace((current) => ({
        ...current,
        leads: current.leads.map((lead) => updatedById.get(lead.id) || lead),
      }))
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
            <h1>Turn job alerts into a focused review queue.</h1>
            <p>Bring in LinkedIn and Indeed alerts, rank each role, and decide what deserves your time.</p>
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
              <span>{workspace.leads.filter((lead) => lead.state === 'new' && !lead.filtered).length}</span>
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
            search={workspace.search}
            onUpdateStates={handleUpdateStates}
          />
        ) : workspace ? (
          <JobAgentSetup
            inbox={workspace.inbox}
            initialProfile={workspace.profile}
            initialSearch={workspace.search}
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
