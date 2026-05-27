import { useMemo, useState } from 'react'
import ApplicationList from '../components/ApplicationList'
import MetricGrid from '../components/MetricGrid'
import { statuses } from '../data/applications'

function DashboardPage({
  applications,
  error,
  isLoading,
  onAddApplication,
  onDeleteApplication,
  onEditApplication,
  onSignOut,
  user,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const statusCounts = useMemo(
    () =>
      statuses.map((status) => ({
        status,
        count: applications.filter((application) => application.status === status)
          .length,
      })),
    [applications],
  )

  const filteredApplications = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return applications.filter((application) => {
      const matchesStatus =
        statusFilter === 'All' || application.status === statusFilter
      const searchableText = [
        application.company,
        application.role,
        application.location,
        application.contact,
        application.salary,
        application.notes,
      ]
        .join(' ')
        .toLowerCase()

      return matchesStatus && searchableText.includes(normalizedSearch)
    })
  }, [applications, searchTerm, statusFilter])

  const nextFollowUp = useMemo(() => {
    const datedFollowUps = applications
      .filter((application) => application.followUp)
      .sort((first, second) => first.followUp.localeCompare(second.followUp))

    return datedFollowUps[0]?.followUp || 'None set'
  }, [applications])

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Welcome {user.name}, here are the applications you made.</h1>
        </div>
        <div className="header-actions">
          <button type="button" onClick={onAddApplication}>
            Add application
          </button>
          <button className="ghost-button" type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <MetricGrid
        applications={applications}
        nextFollowUp={nextFollowUp}
        statusCounts={statusCounts}
      />

      <section className="tracker-section" aria-label="Application tracker">
        <div className="section-header">
          <div>
            <p className="eyebrow">Pipeline</p>
            <h2>Your applications</h2>
          </div>
          <div className="status-summary">
            {statusCounts.map((item) => (
              <span key={item.status}>
                {item.status}: {item.count}
              </span>
            ))}
          </div>
        </div>

        <div className="toolbar" aria-label="Filter applications">
          <label>
            Search
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Company, role, notes..."
            />
          </label>

          <label>
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option>All</option>
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}
        {isLoading && <p className="loading-message">Loading applications...</p>}

        <ApplicationList
          applications={filteredApplications}
          onDeleteApplication={onDeleteApplication}
          onEditApplication={onEditApplication}
        />
      </section>
    </main>
  )
}

export default DashboardPage
