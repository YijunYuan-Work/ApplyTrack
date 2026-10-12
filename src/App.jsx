import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  createApplication,
  createApplications,
  deleteApplication,
  deleteApplications,
  fetchApplications,
  fetchApplicationStatus,
  applicationStatusFields,
  updateApplication,
  updateApplicationStatus,
} from './api/applications'
import {
  getCurrentUser,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  updatePassword,
} from './api/auth'
import { fetchJobAgentSummary } from './api/jobAgent'
import {
  getTodayIsoDate,
  normalizeApplication,
} from './data/applications'
import AppLayout from './components/AppLayout'
import { hasSupabaseConfig, supabase } from './lib/supabase'
import ApplicationFormPage from './pages/ApplicationFormPage'
import DashboardPage from './pages/DashboardPage'
import DemoWorkspace from './pages/DemoWorkspace'
import ImportExcelPage from './pages/ImportExcelPage'
import ProfilePage from './pages/ProfilePage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import SetupPage from './pages/SetupPage'
import SignInPage from './pages/SignInPage'
import { getEditingApplicationId, getRoute, navigate } from './utils/routes'
import './App.css'
import './styles/theme.css'

const ProgressPage = lazy(() => import('./pages/ProgressPage'))
const JobAgentPage = lazy(() => import('./pages/JobAgentPage'))
function getUserName(user) {
  return user?.user_metadata?.name || user?.email?.split('@')[0] || 'there'
}

function getFriendlyErrorMessage(message) {
  if (message.toLowerCase().includes('already registered')) {
    return 'That username is already taken.'
  }

  if (message.toLowerCase().includes('invalid login credentials')) {
    return 'The username or password is incorrect.'
  }

  return message
}

function clearRecoveryQuery() {
  const url = new URL(window.location.href)
  url.searchParams.delete('recovery')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

function App() {
  const [applications, setApplications] = useState([])
  const [user, setUser] = useState(null)
  const [route, setRoute] = useState(getRoute)
  const [authLoading, setAuthLoading] = useState(hasSupabaseConfig)
  const [authError, setAuthError] = useState('')
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState('')
  const [jobAgentSummary, setJobAgentSummary] = useState(null)
  const [statusMutations, setStatusMutations] = useState({})
  const [workspaceVersion, setWorkspaceVersion] = useState(0)
  const applicationsRef = useRef([])
  const workspaceRef = useRef({ userId: null, revision: 0, statusQueues: new Map() })
  const userId = user?.id

  const changeApplications = useCallback((update) => {
    const next = typeof update === 'function' ? update(applicationsRef.current) : update
    applicationsRef.current = next
    workspaceRef.current.revision += 1
    setApplications(next)
  }, [])

  const acceptUser = useCallback((nextUser) => {
    const nextId = nextUser?.id ?? null
    if (workspaceRef.current.userId !== nextId) {
      workspaceRef.current = { userId: nextId, revision: 0, statusQueues: new Map() }
      setWorkspaceVersion((current) => current + 1)
      applicationsRef.current = []
      setApplications([])
      setStatusMutations({})
      setDataError('')
      setDataLoading(false)
      setJobAgentSummary(null)
    }
    setUser(nextUser)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = 'light'
    document.documentElement.style.colorScheme = 'light'
  }, [])

  useEffect(() => {
    function syncRoute() {
      setRoute(getRoute())
    }

    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  useEffect(() => {
    window.scrollTo({ behavior: 'auto', left: 0, top: 0 })
  }, [route])

  useEffect(() => {
    if (!hasSupabaseConfig) {
      return undefined
    }

    let isMounted = true
    let authEvents = 0
    let serverUserChecked = false

    async function loadSession() {
      // Let the SDK emit its cached startup session before fencing the server check.
      await supabase.auth.getSession()
      if (!isMounted) return
      const startedAt = authEvents
      const currentUser = await getCurrentUser()

      if (!isMounted) {
        return
      }

      serverUserChecked = true
      if (startedAt === authEvents) acceptUser(currentUser)
      setAuthLoading(false)
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const sessionUser = session?.user ?? null
      if (event === 'INITIAL_SESSION' && (serverUserChecked || authEvents > 0)) return
      if (event !== 'INITIAL_SESSION') authEvents += 1
      acceptUser(sessionUser)

      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password')
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [acceptUser])

  useEffect(() => {
    if (route === '/demo' || route.startsWith('/demo/') || !hasSupabaseConfig || authLoading) {
      return
    }

    if (
      user &&
      new URLSearchParams(window.location.search).get('recovery') === '1'
    ) {
      navigate('/reset-password')
      clearRecoveryQuery()
      return
    }

    if (!user && route !== '/sign-in') {
      navigate('/sign-in')
    }

    if (user && route === '/sign-in') {
      navigate('/dashboard')
    }
  }, [authLoading, route, user])

  useEffect(() => {
    if (!userId) {
      return
    }

    let isMounted = true
    const workspace = workspaceRef.current
    const isCurrent = () => isMounted && workspaceRef.current === workspace

    async function loadApplications() {
      setDataLoading(true)
      setDataError('')

      try {
        while (isCurrent()) {
          const revision = workspace.revision
          const [savedApplications, savedJobAgentSummary] = await Promise.all([
            fetchApplications(userId),
            fetchJobAgentSummary(userId).catch(() => null),
          ])
          if (!isCurrent()) return
          // A fetch begun before a successful mutation must not replace that result.
          if (revision !== workspace.revision) continue
          changeApplications(savedApplications)
          setJobAgentSummary(savedJobAgentSummary)
          break
        }
      } catch (error) {
        if (isCurrent()) {
          setDataError(error.message)
        }
      } finally {
        if (isCurrent()) {
          setDataLoading(false)
        }
      }
    }

    loadApplications()

    return () => {
      isMounted = false
    }
  }, [userId, workspaceVersion, changeApplications])

  useEffect(() => {
    if (!userId || route !== '/dashboard') {
      return undefined
    }

    let isMounted = true

    fetchJobAgentSummary(userId)
      .then((summary) => {
        if (isMounted) {
          setJobAgentSummary(summary)
        }
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [route, userId])

  async function handleAuthSubmit({ mode, password, username }) {
    setAuthLoading(true)
    setAuthError('')

    try {
      const authenticatedUser =
        mode === 'sign-up'
          ? await signUpWithEmail(username, password)
          : await signInWithEmail(username, password)

      acceptUser(authenticatedUser)
      navigate('/dashboard')
    } catch (error) {
      setAuthError(getFriendlyErrorMessage(error.message))
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleSignOut() {
    setAuthError('')
    await signOut()
    acceptUser(null)
    navigate('/sign-in')
  }

  async function handleUpdatePassword(password) {
    const workspace = workspaceRef.current
    const updatedUser = await updatePassword(password)
    if (workspaceRef.current === workspace) acceptUser(updatedUser)
  }

  async function handleSaveApplication(applicationData, applicationId) {
    const workspace = workspaceRef.current
    const today = getTodayIsoDate()
    const interviewCount = Number(applicationData.interviewCount) || 0
    const normalizedInterviewCount =
      applicationData.status === 'Interview' && interviewCount === 0
        ? 1
        : interviewCount
    const preparedApplication = normalizeApplication({
      ...applicationData,
      company: applicationData.company.trim(),
      role: applicationData.role.trim(),
      location: applicationData.location.trim() || 'Not specified',
      jobUrl: applicationData.jobUrl.trim(),
      contact: applicationData.contact.trim(),
      salary: applicationData.salary.trim(),
      coverLetter: applicationData.coverLetter.trim(),
      referral: applicationData.referral.trim(),
      interviewCount: normalizedInterviewCount,
      lastUpdated: applicationId ? today : applicationData.lastUpdated || today,
      notes: applicationData.notes,
    })

    if (!preparedApplication.company || !preparedApplication.role) {
      return
    }

    setDataError('')

    try {
      if (applicationId) {
        const savedApplication = await updateApplication(
          applicationId,
          preparedApplication,
          user.id,
        )

        if (workspaceRef.current !== workspace) return
        changeApplications((currentApplications) =>
          currentApplications.map((application) =>
            application.id === applicationId ? savedApplication : application,
          ),
        )
      } else {
        const savedApplication = await createApplication(preparedApplication, user.id)
        if (workspaceRef.current !== workspace) return
        changeApplications((currentApplications) => [
          savedApplication,
          ...currentApplications,
        ])
      }

      navigate('/dashboard')
    } catch (error) {
      if (workspaceRef.current !== workspace) return
      setDataError(getFriendlyErrorMessage(error.message))
    }
  }

  async function handleQuickStatusChange(applicationId, nextStatus) {
    const workspace = workspaceRef.current
    const currentApplication = applicationsRef.current.find(
      (application) => application.id === applicationId,
    )
    if (!currentApplication || !workspace.userId) return
    let queue = workspace.statusQueues.get(applicationId)
    if (queue?.latest === nextStatus) return
    if (
      !queue && currentApplication.status === nextStatus &&
      !statusMutations[applicationId]?.error
    ) return
    const mark = (mutation) => setStatusMutations((current) => ({
      ...current, [applicationId]: mutation,
    }))
    if (queue) {
      queue.requests.push({ status: nextStatus, date: getTodayIsoDate() })
      queue.latest = nextStatus
      mark({ pending: true, status: nextStatus, error: '' })
      return
    }
    queue = { requests: [{ status: nextStatus, date: getTodayIsoDate() }], latest: nextStatus }
    workspace.statusQueues.set(applicationId, queue)
    mark({ pending: true, status: nextStatus, error: '' })
    const isCurrent = () => workspaceRef.current === workspace
    const findApplication = () => applicationsRef.current.find((item) => item.id === applicationId)
    const applyFields = (fields) => changeApplications((current) =>
      current.map((item) => item.id === applicationId ? { ...item, ...fields } : item),
    )
    async function reconcileStatus() {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const beforeRead = findApplication()
        const row = await fetchApplicationStatus(applicationId, workspace.userId)
        if (!isCurrent()) return
        // A full edit may have completed while the status response/read was delayed.
        if (beforeRead !== findApplication()) continue
        applyFields(applicationStatusFields(row))
        return
      }
      throw new Error('This application changed while confirming its status.')
    }
    let lastError = ''
    while (isCurrent() && queue.requests.length) {
      const request = queue.requests.shift()
      const beforeWrite = findApplication()
      if (!beforeWrite) break
      try {
        const fields = await updateApplicationStatus(
          applicationId, request.status, workspace.userId, request.date, isCurrent,
        )
        if (!isCurrent()) return
        if (beforeWrite === findApplication()) applyFields(fields)
        else await reconcileStatus()
        lastError = ''
      } catch (error) {
        if (!isCurrent()) return
        lastError = getFriendlyErrorMessage(error.message)
        // A failed HTTP response may follow a committed write. Read only status fields.
        try {
          await reconcileStatus()
        } catch {
          lastError += ' Could not confirm the saved status. Reload to check.'
        }
      }
      if (!isCurrent()) return
      mark({ pending: true, status: queue.latest, error: lastError })
    }
    if (!isCurrent()) return
    workspace.statusQueues.delete(applicationId)
    mark({ pending: false, error: lastError })
  }

  async function handleDeleteApplication(applicationId) {
    const workspace = workspaceRef.current
    const confirmed = window.confirm(
      'Delete this application? This cannot be undone.',
    )

    if (!confirmed) {
      return
    }

    setDataError('')

    try {
      await deleteApplication(applicationId)
      if (workspaceRef.current !== workspace) return
      changeApplications((currentApplications) =>
        currentApplications.filter(
          (application) => application.id !== applicationId,
        ),
      )
    } catch (error) {
      if (workspaceRef.current !== workspace) return
      setDataError(getFriendlyErrorMessage(error.message))
    }
  }

  async function handleBulkDeleteApplications(applicationIds) {
    const workspace = workspaceRef.current
    if (applicationIds.length === 0) {
      return
    }

    const confirmed = window.confirm(
      `Delete ${applicationIds.length} selected applications? This cannot be undone.`,
    )

    if (!confirmed) {
      return
    }

    setDataError('')

    try {
      await deleteApplications(applicationIds)
      if (workspaceRef.current !== workspace) return
      changeApplications((currentApplications) =>
        currentApplications.filter(
          (application) => !applicationIds.includes(application.id),
        ),
      )
    } catch (error) {
      if (workspaceRef.current !== workspace) return
      setDataError(getFriendlyErrorMessage(error.message))
    }
  }

  async function handleImportApplications(importedApplications) {
    const workspace = workspaceRef.current
    setDataError('')

    try {
      const savedApplications = await createApplications(importedApplications, user.id)
      if (workspaceRef.current !== workspace) return
      changeApplications((currentApplications) => [
        ...savedApplications,
        ...currentApplications,
      ])
    } catch (error) {
      if (workspaceRef.current !== workspace) throw error
      const message = getFriendlyErrorMessage(error.message)
      setDataError(message)
      throw new Error(message, { cause: error })
    }
  }

  if (route === '/demo' || route.startsWith('/demo/')) {
    return <DemoWorkspace route={route} />
  }

  if (!hasSupabaseConfig) {
    return <SetupPage />
  }

  if (authLoading && !user) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <p className="eyebrow">ApplyTrack</p>
          <h1>Loading your workspace.</h1>
        </section>
      </main>
    )
  }

  const appUser = user
    ? {
        ...user,
        name: getUserName(user),
      }
    : null

  const editingApplicationId = getEditingApplicationId(route)
  const editingApplication = applications.find(
    (application) => application.id === editingApplicationId,
  )
  const sharedPageProps = {
    onAddApplication: () => navigate('/applications/new'),
    onDashboard: () => navigate('/dashboard'),
    onImportExcel: () => navigate('/import'),
    onJobAgent: () => navigate('/job-agent'),
    onProfile: () => navigate('/profile'),
    onProgress: () => navigate('/progress'),
    onSignOut: handleSignOut,
    user: appUser,
  }

  if (!appUser) {
    return (
      <SignInPage
        error={authError}
        isLoading={authLoading}
        onAuthSubmit={handleAuthSubmit}
      />
    )
  }

  if (route === '/reset-password') {
    return (
      <ResetPasswordPage
        onContinue={() => navigate('/dashboard')}
        onUpdatePassword={handleUpdatePassword}
      />
    )
  }

  if (route === '/applications/new') {
    return (
      <ApplicationFormPage
        {...sharedPageProps}
        application={null}
        error={dataError}
        onCancel={() => navigate('/dashboard')}
        onSave={handleSaveApplication}
      />
    )
  }

  if (route.endsWith('/edit') && editingApplication) {
    return (
      <ApplicationFormPage
        {...sharedPageProps}
        application={editingApplication}
        error={dataError}
        onCancel={() => navigate('/dashboard')}
        onSave={handleSaveApplication}
      />
    )
  }

  if (route === '/profile') {
    return (
      <ProfilePage
        {...sharedPageProps}
        onUpdatePassword={handleUpdatePassword}
      />
    )
  }

  if (route === '/progress') {
    return (
      <Suspense
        fallback={
          <AppLayout {...sharedPageProps} currentPage="progress">
            <section className="page-loading-state" role="status">
              <p className="eyebrow">Progress</p>
              <h1>Loading your progress.</h1>
            </section>
          </AppLayout>
        }
      >
        <ProgressPage
          {...sharedPageProps}
          applications={applications}
        />
      </Suspense>
    )
  }

  function handleJobLeadApplicationCreated(application) {
    if (workspaceRef.current.userId !== user.id) return
    changeApplications((currentApplications) =>
      currentApplications.some((item) => item.id === application.id)
        ? currentApplications
        : [application, ...currentApplications],
    )
    setJobAgentSummary((current) =>
      current
        ? {
            ...current,
            appliedCount: (current.appliedCount || 0) + 1,
            pendingCount: Math.max(0, (current.pendingCount || 0) - 1),
          }
        : current,
    )
  }

  function handleJobLeadRemoved(removedCount = 1) {
    setJobAgentSummary((current) =>
      current
        ? {
            ...current,
            pendingCount: Math.max(0, (current.pendingCount || 0) - removedCount),
          }
        : current,
    )
  }

  if (route === '/job-agent' || route === '/job-agent/matches') {
    return (
      <Suspense
        fallback={
          <AppLayout {...sharedPageProps} currentPage="agent">
            <section className="page-loading-state" role="status">
              <p className="eyebrow">Job Agent</p>
              <h1>Loading your Job Agent.</h1>
            </section>
          </AppLayout>
        }
      >
        <JobAgentPage
          {...sharedPageProps}
          onApplicationCreated={handleJobLeadApplicationCreated}
          onJobLeadRemoved={handleJobLeadRemoved}
          onViewMatches={() => navigate('/job-agent/matches')}
          view={route.endsWith('/matches') ? 'matches' : 'setup'}
        />
      </Suspense>
    )
  }

  if (route === '/import') {
    return (
      <ImportExcelPage
        {...sharedPageProps}
        applications={applications}
        onImportApplications={handleImportApplications}
      />
    )
  }

  return (
    <DashboardPage
      {...sharedPageProps}
      applications={applications}
      error={dataError}
      isLoading={dataLoading}
      jobAgentSummary={jobAgentSummary}
      onBulkDeleteApplications={handleBulkDeleteApplications}
      onDeleteApplication={handleDeleteApplication}
      onEditApplication={(applicationId) =>
        navigate(`/applications/${applicationId}/edit`)
      }
      onJobAgent={() =>
        navigate(jobAgentSummary?.enabled ? '/job-agent/matches' : '/job-agent')
      }
      onStatusChange={handleQuickStatusChange}
      statusMutations={statusMutations}
    />
  )
}

export default App
