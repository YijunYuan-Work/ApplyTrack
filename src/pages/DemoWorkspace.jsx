import { lazy, Suspense, useMemo, useState } from 'react'
import AppLayout from '../components/AppLayout'
import { demoApplications, getTodayIsoDate, normalizeApplication } from '../data/applications'
import {
  createDemoJobAgentWorkspace,
  demoImportApplications,
} from '../data/demoWorkspace'
import ApplicationFormPage from './ApplicationFormPage'
import DashboardPage from './DashboardPage'
import ImportExcelPage from './ImportExcelPage'
import ProfilePage from './ProfilePage'
import { navigate } from '../utils/routes'

const JobAgentPage = lazy(() => import('./JobAgentPage'))
const ProgressPage = lazy(() => import('./ProgressPage'))

function getDemoPath(path) {
  return path === '/dashboard' ? '/demo' : `/demo${path}`
}

function getDemoEditingId(route) {
  const match = route.match(/^\/demo\/applications\/([^/]+)\/edit$/)
  return match ? decodeURIComponent(match[1]) : null
}

function prepareApplication(applicationData, applicationId) {
  const today = getTodayIsoDate()
  const interviewCount = Number(applicationData.interviewCount) || 0

  return normalizeApplication({
    ...applicationData,
    company: applicationData.company.trim(),
    role: applicationData.role.trim(),
    location: applicationData.location.trim() || 'Not specified',
    jobUrl: applicationData.jobUrl.trim(),
    contact: applicationData.contact.trim(),
    salary: applicationData.salary.trim(),
    coverLetter: applicationData.coverLetter.trim(),
    referral: applicationData.referral.trim(),
    interviewCount:
      applicationData.status === 'Interview' && interviewCount === 0
        ? 1
        : interviewCount,
    lastUpdated: applicationId ? today : applicationData.lastUpdated || today,
    notes: applicationData.notes.trim(),
  })
}

function DemoWorkspace({ route }) {
  const [applications, setApplications] = useState(() =>
    demoApplications.map((application) => ({ ...application })),
  )
  const [user, setUser] = useState({
    id: 'demo-user',
    name: 'Demo',
    user_metadata: {
      name: 'Demo',
      profileEmail: 'demo@example.com',
      username: 'Demo',
    },
  })
  const [jobAgentWorkspace, setJobAgentWorkspace] = useState(
    createDemoJobAgentWorkspace,
  )
  const demoNavigate = (path) => navigate(getDemoPath(path))
  const editingId = getDemoEditingId(route)
  const editingApplication = applications.find(
    (application) => String(application.id) === editingId,
  )
  const jobAgentSummary = useMemo(() => {
    const waitingLeads = jobAgentWorkspace.leads.filter(
      (lead) => lead.state !== 'applied' && lead.state !== 'expired',
    )

    return {
      alertEnabled: jobAgentWorkspace.inbox?.enabled ?? false,
      appliedCount: jobAgentWorkspace.leads.filter((lead) => lead.state === 'applied').length,
      available: true,
      enabled: Boolean(jobAgentWorkspace.inbox),
      indeedConnected: jobAgentWorkspace.messages.some(
        (message) => message.provider === 'indeed',
      ),
      lastAlertAt: jobAgentWorkspace.inbox?.lastReceivedAt,
      linkedInConnected: jobAgentWorkspace.messages.some(
        (message) => message.provider === 'linkedin',
      ),
      pendingCount: waitingLeads.length,
    }
  }, [jobAgentWorkspace])
  const sharedPageProps = {
    isDemo: true,
    onAddApplication: () => demoNavigate('/applications/new'),
    onDashboard: () => demoNavigate('/dashboard'),
    onImportExcel: () => demoNavigate('/import'),
    onJobAgent: () => demoNavigate('/job-agent'),
    onProfile: () => demoNavigate('/profile'),
    onProgress: () => demoNavigate('/progress'),
    onSignOut: () => demoNavigate('/dashboard'),
    user,
  }

  async function handleSaveApplication(applicationData, applicationId) {
    const preparedApplication = prepareApplication(applicationData, applicationId)

    if (!preparedApplication.company || !preparedApplication.role) return

    if (applicationId) {
      setApplications((current) =>
        current.map((application) =>
          String(application.id) === String(applicationId)
            ? { ...preparedApplication, id: application.id }
            : application,
        ),
      )
    } else {
      setApplications((current) => [
        { ...preparedApplication, id: `demo-added-${Date.now()}` },
        ...current,
      ])
    }

    demoNavigate('/dashboard')
  }

  async function handleStatusChange(applicationId, nextStatus) {
    setApplications((current) =>
      current.map((application) => {
        if (application.id !== applicationId) return application

        return normalizeApplication({
          ...application,
          status: nextStatus,
          interviewCount:
            nextStatus === 'Interview' && Number(application.interviewCount || 0) === 0
              ? 1
              : application.interviewCount,
          lastUpdated: getTodayIsoDate(),
        })
      }),
    )
  }

  async function handleDeleteApplication(applicationId) {
    if (!window.confirm('Delete this sample application?')) return
    setApplications((current) =>
      current.filter((application) => application.id !== applicationId),
    )
  }

  async function handleBulkDeleteApplications(applicationIds) {
    if (
      applicationIds.length === 0 ||
      !window.confirm(`Delete ${applicationIds.length} selected sample applications?`)
    ) return

    setApplications((current) =>
      current.filter((application) => !applicationIds.includes(application.id)),
    )
  }

  async function handleImportApplications(importedApplications) {
    const importedAt = Date.now()
    const normalizedImports = importedApplications.map((application, index) => ({
      ...normalizeApplication(application),
      id: `demo-import-${importedAt}-${index}`,
    }))
    setApplications((current) => [...normalizedImports, ...current])
  }

  function handleJobApplicationCreated(application) {
    setApplications((current) =>
      current.some((item) => item.id === application.id)
        ? current
        : [application, ...current],
    )
  }

  if (route === '/demo/applications/new') {
    return (
      <ApplicationFormPage
        {...sharedPageProps}
        application={null}
        error=""
        onCancel={() => demoNavigate('/dashboard')}
        onSave={handleSaveApplication}
      />
    )
  }

  if (editingApplication) {
    return (
      <ApplicationFormPage
        {...sharedPageProps}
        application={editingApplication}
        error=""
        onCancel={() => demoNavigate('/dashboard')}
        onSave={handleSaveApplication}
      />
    )
  }

  if (route === '/demo/profile') {
    return (
      <ProfilePage
        {...sharedPageProps}
        onUpdatePassword={async () => {}}
        onUpdateProfileEmail={async (email) => {
          setUser((current) => ({
            ...current,
            user_metadata: {
              ...current.user_metadata,
              profileEmail: email.trim(),
            },
          }))
        }}
      />
    )
  }

  if (route === '/demo/progress') {
    return (
      <Suspense
        fallback={
          <AppLayout {...sharedPageProps} currentPage="progress">
            <section className="page-loading-state" role="status">
              <p className="eyebrow">Progress</p>
              <h1>Loading sample progress.</h1>
            </section>
          </AppLayout>
        }
      >
        <ProgressPage {...sharedPageProps} applications={applications} />
      </Suspense>
    )
  }

  if (route === '/demo/job-agent' || route === '/demo/job-agent/matches') {
    return (
      <Suspense
        fallback={
          <AppLayout {...sharedPageProps} currentPage="agent">
            <section className="page-loading-state" role="status">
              <p className="eyebrow">Job Agent</p>
              <h1>Loading sample job alerts.</h1>
            </section>
          </AppLayout>
        }
      >
        <JobAgentPage
          {...sharedPageProps}
          demoWorkspace={jobAgentWorkspace}
          onApplicationCreated={handleJobApplicationCreated}
          onDemoWorkspaceChange={setJobAgentWorkspace}
          onJobLeadRemoved={() => {}}
          onViewMatches={() => demoNavigate('/job-agent/matches')}
          view={route.endsWith('/matches') ? 'matches' : 'setup'}
        />
      </Suspense>
    )
  }

  if (route === '/demo/import') {
    return (
      <ImportExcelPage
        {...sharedPageProps}
        applications={applications}
        demoRows={demoImportApplications}
        onImportApplications={handleImportApplications}
      />
    )
  }

  return (
    <DashboardPage
      {...sharedPageProps}
      applications={applications}
      error=""
      isLoading={false}
      jobAgentSummary={jobAgentSummary}
      onBulkDeleteApplications={handleBulkDeleteApplications}
      onDeleteApplication={handleDeleteApplication}
      onEditApplication={(applicationId) =>
        demoNavigate(`/applications/${encodeURIComponent(applicationId)}/edit`)
      }
      onJobAgent={() => demoNavigate('/job-agent/matches')}
      onStatusChange={handleStatusChange}
    />
  )
}

export default DemoWorkspace
