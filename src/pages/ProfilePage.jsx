import { useMemo } from 'react'
import AppLayout from '../components/AppLayout'
import MetricGrid from '../components/MetricGrid'
import { statuses } from '../data/applications'

function ProfilePage({
  applications,
  onAddApplication,
  onDashboard,
  onImportExcel,
  onProfile,
  onSignOut,
  user,
}) {
  const statusCounts = useMemo(
    () =>
      statuses.map((status) => ({
        status,
        count: applications.filter((application) => application.status === status)
          .length,
      })),
    [applications],
  )

  const nextFollowUp = useMemo(() => {
    const datedFollowUps = applications
      .filter((application) => application.followUp)
      .sort((first, second) => first.followUp.localeCompare(second.followUp))

    return datedFollowUps[0]?.followUp || 'None set'
  }, [applications])

  const email = user.user_metadata?.email || user.email || 'Not provided'
  const username = user.user_metadata?.username || user.name

  return (
    <AppLayout
      currentPage="profile"
      onAddApplication={onAddApplication}
      onDashboard={onDashboard}
      onImportExcel={onImportExcel}
      onProfile={onProfile}
      onSignOut={onSignOut}
      user={user}
    >
      <header className="app-header compact">
        <div>
          <p className="eyebrow">Profile</p>
          <h1>{username}</h1>
          <p>Manage your workspace identity and review your job search activity.</p>
        </div>
      </header>

      <section className="profile-section">
        <article className="profile-card">
          <div>
            <span>Username</span>
            <strong>{username}</strong>
          </div>
          <div>
            <span>Email</span>
            <strong>{email}</strong>
          </div>
          <div>
            <span>User ID</span>
            <strong>{user.id}</strong>
          </div>
        </article>
      </section>

      <MetricGrid
        applications={applications}
        nextFollowUp={nextFollowUp}
        statusCounts={statusCounts}
      />
    </AppLayout>
  )
}

export default ProfilePage
