import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  createApplication,
  createApplications,
  deleteApplication,
  deleteApplications,
  fetchApplications,
  fetchApplication,
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
import { getTodayIsoDate } from './data/applications'
import { applicationFormChanges, prepareApplicationForm, validateApplicationForm } from './data/applicationForm'
import { fromApplicationRow } from './data/applicationRows'
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
  const [isDeleting, setIsDeleting] = useState(false)
  const [workspaceVersion, setWorkspaceVersion] = useState(0)
  const [jobQueueRevision, setJobQueueRevision] = useState(0)
  const [jobMutationPending, setJobMutationPending] = useState(false)
  const applicationsRef = useRef([])
  const workspaceRef = useRef({ userId: null, revision: 0, statusQueues: new Map(), deleting: false })
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
      workspaceRef.current = { userId: nextId, revision: 0, statusQueues: new Map(), deleting: false }
      setWorkspaceVersion((current) => current + 1)
      applicationsRef.current = []
      setApplications([])
      setStatusMutations({})
      setIsDeleting(false)
      setDataError('')
      setDataLoading(false)
      setJobAgentSummary(null)
      setJobMutationPending(false)
      setJobQueueRevision((current) => current + 1)
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
            fetchJobAgentSummary(userId).catch(() => ({ available: false, error: true })),
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
    const workspace = workspaceRef.current
    const revision = workspace.revision
    fetchJobAgentSummary(userId)
      .then((summary) => {
        if (isMounted && workspaceRef.current === workspace && workspace.revision === revision) {
          setJobAgentSummary(summary)
        }
      })
      .catch(() => {
        if (isMounted && workspaceRef.current === workspace && workspace.revision === revision) {
          setJobAgentSummary({ available: false, error: true })
        }
      })

    return () => {
      isMounted = false
    }
  }, [route, userId, workspaceVersion, jobQueueRevision])

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

  async function handleSaveApplication(applicationData, applicationId, initialData) {
    const workspace = workspaceRef.current
    const errors = validateApplicationForm(applicationData)
    if (Object.keys(errors).length) return { status: 'invalid', errors }
    const preparedApplication = prepareApplicationForm(applicationData, applicationId)
    const isCurrent = () => workspaceRef.current === workspace && Boolean(workspace.userId)
    if (!isCurrent()) return { status: 'canceled' }
    try {
      if (applicationId) {
        const findApplication = () => applicationsRef.current.find((item) => item.id === applicationId)
        const beforeWrite = findApplication()
        let savedApplication = await updateApplication(
          applicationId,
          applicationFormChanges(preparedApplication, initialData),
          workspace.userId,
          isCurrent,
        )
        if (!isCurrent()) return { status: 'canceled' }
        // RF-07 may have confirmed another mutation while this response was delayed.
        if (beforeWrite !== findApplication()) {
          let confirmed = false
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const beforeRead = findApplication()
            const row = await fetchApplication(applicationId, workspace.userId)
            if (!isCurrent()) return { status: 'canceled' }
            if (beforeRead !== findApplication()) continue
            savedApplication = fromApplicationRow(row)
            confirmed = true
            break
          }
          if (!confirmed) throw new Error('Could not confirm the saved application. Reload to check.')
        }
        changeApplications((currentApplications) =>
          currentApplications.map((application) =>
            application.id === applicationId ? savedApplication : application,
          ),
        )
      } else {
        const savedApplication = await createApplication(preparedApplication, workspace.userId)
        if (!isCurrent()) return { status: 'canceled' }
        changeApplications((currentApplications) => [
          savedApplication,
          ...currentApplications,
        ])
      }

      return { status: 'saved' }
    } catch (error) {
      if (!isCurrent()) return { status: 'canceled' }
      return { status: 'error', message: getFriendlyErrorMessage(error.message) }
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

  async function handleDeleteApplications(applicationIds, single = false) {
    const workspace = workspaceRef.current
    const isCurrent = () => workspaceRef.current === workspace && Boolean(workspace.userId)
    if (!isCurrent()) return { status: 'stale' }
    if (workspace.deleting) return { status: 'pending' }
    const ids = [...new Set(applicationIds)]
    if (ids.length === 0) return { status: 'error', message: 'Choose an application to delete.' }
    if (!window.confirm(single
      ? 'Delete this application? This cannot be undone.'
      : `Delete ${ids.length} selected applications? This cannot be undone.`
    )) return { status: 'canceled' }
    if (!isCurrent()) return { status: 'stale' }
    workspace.deleting = true
    setIsDeleting(true)
    try {
      const deletedIds = single
        ? await deleteApplication(ids[0], workspace.userId)
        : await deleteApplications(ids, workspace.userId)
      if (!isCurrent()) return { status: 'stale' }
      changeApplications((currentApplications) =>
        currentApplications.filter((application) => !deletedIds.includes(application.id)),
      )
      return { status: 'deleted', deletedIds }
    } catch (error) {
      if (!isCurrent()) return { status: 'stale' }
      return {
        status: 'error',
        message: `Deletion could not be confirmed. ${getFriendlyErrorMessage(error.message)} Reload to check saved records before retrying.`,
      }
    } finally {
      workspace.deleting = false
      if (isCurrent()) setIsDeleting(false)
    }
  }

  const handleDeleteApplication = (id) => handleDeleteApplications([id], true)
  const handleBulkDeleteApplications = (ids) => handleDeleteApplications(ids)

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
        key={`${workspaceVersion}:new`}
        {...sharedPageProps}
        application={null}
        onCancel={() => navigate('/dashboard')}
        onSave={handleSaveApplication}
      />
    )
  }

  if (route.endsWith('/edit') && editingApplication) {
    return (
      <ApplicationFormPage
        key={`${workspaceVersion}:${editingApplicationId}`}
        {...sharedPageProps}
        application={editingApplication}
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

  function captureJobSession() {
    const workspace = workspaceRef.current
    const isCurrent = () => workspaceRef.current === workspace
    return {
      isCurrent,
      begin: () => {
        if (!isCurrent() || workspace.jobLeadBusy) return false
        workspace.jobLeadBusy = true
        setJobMutationPending(true)
        return true
      },
      end: () => {
        workspace.jobLeadBusy = false
        if (isCurrent()) setJobMutationPending(false)
      },
    }
  }

  function handleJobLeadApplicationCreated(application, session) {
    if (!session.isCurrent()) return
    changeApplications((currentApplications) =>
      currentApplications.some((item) => item.id === application.id)
        ? currentApplications
        : [application, ...currentApplications],
    )
  }

  function handleQueueChanged(session) {
    if (!session.isCurrent()) return
    workspaceRef.current.revision += 1
    setJobAgentSummary(null)
    setJobQueueRevision((current) => current + 1)
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
          key={workspaceVersion}
          {...sharedPageProps}
          onApplicationCreated={handleJobLeadApplicationCreated}
          onQueueChanged={handleQueueChanged}
          queueRevision={jobQueueRevision}
          captureJobSession={captureJobSession}
          mutationPending={jobMutationPending}
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
      key={workspaceVersion}
      {...sharedPageProps}
      applications={applications}
      error={dataError}
      isLoading={dataLoading}
      isDeleting={isDeleting}
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
