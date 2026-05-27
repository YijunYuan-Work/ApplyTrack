import { useEffect, useState } from 'react'
import {
  createApplication,
  deleteApplication,
  fetchApplications,
  updateApplication,
} from './api/applications'
import { getCurrentUser, signInWithEmail, signOut, signUpWithEmail } from './api/auth'
import { normalizeApplication } from './data/applications'
import { hasSupabaseConfig, supabase } from './lib/supabase'
import ApplicationFormPage from './pages/ApplicationFormPage'
import DashboardPage from './pages/DashboardPage'
import SetupPage from './pages/SetupPage'
import SignInPage from './pages/SignInPage'
import { getEditingApplicationId, getRoute, navigate } from './utils/routes'
import './App.css'

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

function App() {
  const [applications, setApplications] = useState([])
  const [user, setUser] = useState(null)
  const [route, setRoute] = useState(getRoute)
  const [authLoading, setAuthLoading] = useState(hasSupabaseConfig)
  const [authError, setAuthError] = useState('')
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState('')

  useEffect(() => {
    function syncRoute() {
      setRoute(getRoute())
    }

    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null
      setUser(sessionUser)

      if (!sessionUser) {
        setApplications([])
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!hasSupabaseConfig || authLoading) {
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
        const savedApplications = await fetchApplications()

        if (isMounted) {
          setApplications(savedApplications)
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
    navigate('/sign-in')
  }

  async function handleSaveApplication(applicationData, applicationId) {
    const preparedApplication = normalizeApplication({
      ...applicationData,
      company: applicationData.company.trim(),
      role: applicationData.role.trim(),
      location: applicationData.location.trim() || 'Not specified',
      jobUrl: applicationData.jobUrl.trim(),
      contact: applicationData.contact.trim(),
      salary: applicationData.salary.trim(),
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

  async function handleDeleteApplication(applicationId) {
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

  if (!appUser) {
    return (
      <SignInPage
        error={authError}
        isLoading={authLoading}
        onAuthSubmit={handleAuthSubmit}
      />
    )
  }

  if (route === '/applications/new') {
    return (
      <ApplicationFormPage
        application={null}
        error={dataError}
        onCancel={() => navigate('/dashboard')}
        onSave={handleSaveApplication}
        user={appUser}
      />
    )
  }

  if (route.endsWith('/edit') && editingApplication) {
    return (
      <ApplicationFormPage
        application={editingApplication}
        error={dataError}
        onCancel={() => navigate('/dashboard')}
        onSave={handleSaveApplication}
        user={appUser}
      />
    )
  }

  return (
    <DashboardPage
      applications={applications}
      error={dataError}
      isLoading={dataLoading}
      onAddApplication={() => navigate('/applications/new')}
      onDeleteApplication={handleDeleteApplication}
      onEditApplication={(applicationId) =>
        navigate(`/applications/${applicationId}/edit`)
      }
      onSignOut={handleSignOut}
      user={appUser}
    />
  )
}

export default App
