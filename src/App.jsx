import { lazy, Suspense, useEffect, useState } from 'react'
import {
  createApplication,
  createApplications,
  deleteApplication,
  deleteApplications,
  fetchApplications,
  updateApplication,
} from './api/applications'
import {
  getCurrentUser,
  requestPasswordReset,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  updatePassword,
  updateProfileEmail,
} from './api/auth'
import { fetchJobAgentSummary } from './api/jobAgent'
import {
  demoApplications,
  getTodayIsoDate,
  normalizeApplication,
} from './data/applications'
import AppLayout from './components/AppLayout'
import { hasSupabaseConfig, supabase } from './lib/supabase'
import ApplicationFormPage from './pages/ApplicationFormPage'
import DashboardPage from './pages/DashboardPage'
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
const demoJobAgentSummary = {
  alertEnabled: true,
  appliedCount: 4,
  available: true,
  enabled: true,
  indeedConnected: true,
  lastAlertAt: '2026-07-22T12:00:00.000Z',
  linkedInConnected: true,
  pendingCount: 8,
  ready: true,
}

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

    async function loadSession() {
      const currentUser = await getCurrentUser()

      if (!isMounted) {
        return
      }

      setUser(currentUser)
      setAuthLoading(false)
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const sessionUser = session?.user ?? null
      setUser(sessionUser)

      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password')
      }

      if (!sessionUser) {
        setApplications([])
        setJobAgentSummary(null)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (route === '/demo' || !hasSupabaseConfig || authLoading) {
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
    if (!user) {
      return
    }

    let isMounted = true

    async function loadApplications() {
      setDataLoading(true)
      setDataError('')

      try {
        const [savedApplications, savedJobAgentSummary] = await Promise.all([
          fetchApplications(),
          fetchJobAgentSummary(user.id).catch(() => null),
        ])

        if (isMounted) {
          setApplications(savedApplications)
          setJobAgentSummary(savedJobAgentSummary)
        }
      } catch (error) {
        if (isMounted) {
          setDataError(error.message)
        }
      } finally {
        if (isMounted) {
          setDataLoading(false)
        }
      }
    }

    loadApplications()

    return () => {
      isMounted = false
    }
  }, [user])

  useEffect(() => {
    if (!user || route !== '/dashboard') {
      return undefined
    }

    let isMounted = true

    fetchJobAgentSummary(user.id)
      .then((summary) => {
        if (isMounted) {
          setJobAgentSummary(summary)
        }
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [route, user])

  async function handleAuthSubmit({ email, mode, password, username }) {
    setAuthLoading(true)
    setAuthError('')

    try {
      const authenticatedUser =
        mode === 'sign-up'
          ? await signUpWithEmail(username, email, password)
          : await signInWithEmail(username, password)

      setUser(authenticatedUser)
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
    setUser(null)
    setApplications([])
    setJobAgentSummary(null)
    navigate('/sign-in')
  }

  async function handlePasswordResetRequest(email) {
    await requestPasswordReset(email)
  }

  async function handleUpdateProfileEmail(email) {
    const updatedUser = await updateProfileEmail(email)
    setUser(updatedUser)
  }

  async function handleUpdatePassword(password) {
    const updatedUser = await updatePassword(password)
    setUser(updatedUser)
  }

  async function handleSaveApplication(applicationData, applicationId) {
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
      notes: applicationData.notes.trim(),
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

        setApplications((currentApplications) =>
          currentApplications.map((application) =>
            application.id === applicationId ? savedApplication : application,
          ),
        )
      } else {
        const savedApplication = await createApplication(preparedApplication, user.id)
        setApplications((currentApplications) => [
          savedApplication,
          ...currentApplications,
        ])
      }

      navigate('/dashboard')
    } catch (error) {
      setDataError(getFriendlyErrorMessage(error.message))
    }
  }

  async function handleQuickStatusChange(applicationId, nextStatus) {
    const currentApplication = applications.find(
      (application) => application.id === applicationId,
    )

    if (!currentApplication || currentApplication.status === nextStatus) {
      return
    }

    const interviewCount = Number(currentApplication.interviewCount) || 0
    const preparedApplication = normalizeApplication({
      ...currentApplication,
      status: nextStatus,
      interviewCount:
        nextStatus === 'Interview' && interviewCount === 0
          ? 1
          : interviewCount,
      lastUpdated: getTodayIsoDate(),
    })

    setDataError('')

    try {
      const savedApplication = await updateApplication(
        applicationId,
        preparedApplication,
        user.id,
      )

      setApplications((currentApplications) =>
        currentApplications.map((application) =>
          application.id === applicationId ? savedApplication : application,
        ),
      )
    } catch (error) {
      setDataError(getFriendlyErrorMessage(error.message))
    }
  }

  async function handleDeleteApplication(applicationId) {
    const confirmed = window.confirm(
      'Delete this application? This cannot be undone.',
    )

    if (!confirmed) {
      return
    }

    setDataError('')

    try {
      await deleteApplication(applicationId)
      setApplications((currentApplications) =>
        currentApplications.filter(
          (application) => application.id !== applicationId,
        ),
      )
    } catch (error) {
      setDataError(getFriendlyErrorMessage(error.message))
    }
  }

  async function handleBulkDeleteApplications(applicationIds) {
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
      setApplications((currentApplications) =>
        currentApplications.filter(
          (application) => !applicationIds.includes(application.id),
        ),
      )
    } catch (error) {
      setDataError(getFriendlyErrorMessage(error.message))
    }
  }

  async function handleImportApplications(importedApplications) {
    setDataError('')

    try {
      const savedApplications = await createApplications(importedApplications, user.id)
      setApplications((currentApplications) => [
        ...savedApplications,
        ...currentApplications,
      ])
    } catch (error) {
      const message = getFriendlyErrorMessage(error.message)
      setDataError(message)
      throw new Error(message, { cause: error })
    }
  }

  if (route === '/demo') {
    const demoUser = { name: 'Demo' }
    const stayOnDemo = () => navigate('/demo')

    return (
      <DashboardPage
        applications={demoApplications}
        error=""
        isDemo
        isLoading={false}
        isReadOnly
        onAddApplication={stayOnDemo}
        onBulkDeleteApplications={async () => {}}
        onDashboard={stayOnDemo}
        onDeleteApplication={async () => {}}
        onEditApplication={stayOnDemo}
        onImportExcel={stayOnDemo}
        onJobAgent={stayOnDemo}
        onProfile={stayOnDemo}
        onProgress={stayOnDemo}
        onSignOut={stayOnDemo}
        onStatusChange={async () => {}}
        jobAgentSummary={demoJobAgentSummary}
        user={demoUser}
      />
    )
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
        onPasswordResetRequest={handlePasswordResetRequest}
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
        onUpdateProfileEmail={handleUpdateProfileEmail}
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
    setApplications((currentApplications) =>
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

  function handleJobLeadRemoved() {
    setJobAgentSummary((current) =>
      current
        ? {
            ...current,
            pendingCount: Math.max(0, (current.pendingCount || 0) - 1),
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
    />
  )
}

export default App
