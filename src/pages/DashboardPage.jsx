import { useMemo, useState } from 'react'
import AppLayout from '../components/AppLayout'
import ApplicationList from '../components/ApplicationList'
import MetricGrid from '../components/MetricGrid'
import { statuses } from '../data/applications'

function DashboardPage({
  applications,
  error,
  isLoading,
  onAddApplication,
  onBulkDeleteApplications,
  onDeleteApplication,
  onDashboard,
  onEditApplication,
  onImportExcel,
  onOpenProfile,
  onProgress,
  onSignOut,
  user,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedApplicationIds, setSelectedApplicationIds] = useState([])
  const [sortBy, setSortBy] = useState('applied')
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

    return applications
      .filter((application) => {
        const matchesStatus =
          statusFilter === 'All' || application.status === statusFilter
        const searchableText = [
          application.company,
          application.role,
          application.location,
          application.contact,
          application.salary,
          application.coverLetter,
          application.referral,
          application.lastUpdated,
          application.interviewCount,
          application.notes,
        ]
          .join(' ')
          .toLowerCase()

        return matchesStatus && searchableText.includes(normalizedSearch)
      })
      .sort((firstApplication, secondApplication) => {
        const firstDate =
          sortBy === 'lastUpdated'
            ? firstApplication.lastUpdated
            : firstApplication.date
        const secondDate =
          sortBy === 'lastUpdated'
            ? secondApplication.lastUpdated
            : secondApplication.date

        return String(secondDate || '').localeCompare(String(firstDate || ''))
      })
  }, [applications, searchTerm, sortBy, statusFilter])

  const nextFollowUp = useMemo(() => {
    const datedFollowUps = applications
      .filter((application) => application.followUp)
      .sort((first, second) => first.followUp.localeCompare(second.followUp))

    return datedFollowUps[0]?.followUp || 'None set'
  }, [applications])

  const filteredApplicationIds = filteredApplications.map(
    (application) => application.id,
  )
  const allVisibleSelected =
    filteredApplicationIds.length > 0 &&
    filteredApplicationIds.every((applicationId) =>
      selectedApplicationIds.includes(applicationId),
    )

  function handleSelectApplication(applicationId) {
    setSelectedApplicationIds((currentIds) =>
      currentIds.includes(applicationId)
        ? currentIds.filter((currentId) => currentId !== applicationId)
        : [...currentIds, applicationId],
    )
  }

  function handleSelectAllVisible() {
    setSelectedApplicationIds((currentIds) => {
      if (allVisibleSelected) {
        return currentIds.filter(
          (applicationId) => !filteredApplicationIds.includes(applicationId),
        )
      }

      return Array.from(new Set([...currentIds, ...filteredApplicationIds]))
    })
  }

  function handleToggleSelectionMode() {
    setIsSelectionMode((currentMode) => {
      if (currentMode) {
        setSelectedApplicationIds([])
      }

      return !currentMode
    })
  }

  function handleClearSelection() {
    setSelectedApplicationIds([])
  }

  async function handleBulkDelete() {
    await onBulkDeleteApplications(selectedApplicationIds)
    setSelectedApplicationIds([])
  }

  async function handleDeleteApplication(applicationId) {
    await onDeleteApplication(applicationId)
    setSelectedApplicationIds((currentIds) =>
      currentIds.filter((currentId) => currentId !== applicationId),
    )
  }

  return (
    <AppLayout
      currentPage="dashboard"
      onAddApplication={onAddApplication}
      onDashboard={onDashboard}
      onImportExcel={onImportExcel}
      onProfile={onOpenProfile}
      onProgress={onProgress}
      onSignOut={onSignOut}
      user={user}
    >
      <header className="app-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Welcome {user.name}, here are the applications you made.</h1>
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

          <label>
            Sort by
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="applied">Applied date</option>
              <option value="lastUpdated">Last updated date</option>
            </select>
          </label>
        </div>

        <div className="list-action-bar" aria-label="Application list actions">
          {isSelectionMode && (
            <div className="bulk-toolbar" aria-label="Bulk application actions">
              <span>{selectedApplicationIds.length} selected</span>
              <button
                className="ghost-button"
                disabled={filteredApplications.length === 0}
                type="button"
                onClick={handleSelectAllVisible}
              >
                {allVisibleSelected ? 'Unselect all' : 'Select all'}
              </button>
              <button
                className="danger-action"
                disabled={selectedApplicationIds.length === 0}
                type="button"
                onClick={handleBulkDelete}
              >
                Delete selected
              </button>
              {selectedApplicationIds.length > 0 && (
                <button
                  className="ghost-button"
                  type="button"
                  onClick={handleClearSelection}
                >
                  Clear
                </button>
              )}
            </div>
          )}

          <button
            aria-label={isSelectionMode ? 'Exit multi-select' : 'Enter multi-select'}
            className={`icon-action ${isSelectionMode ? 'icon-action-active' : ''}`}
            disabled={filteredApplications.length === 0}
            title={isSelectionMode ? 'Exit multi-select' : 'Multi-select'}
            type="button"
            onClick={handleToggleSelectionMode}
          >
            <img
              alt=""
              aria-hidden="true"
              className="multi-select-icon"
              src="/selection.png"
            />
          </button>
        </div>

        {error && <p className="form-error">{error}</p>}
        {isLoading && <p className="loading-message">Loading applications...</p>}

        <ApplicationList
          applications={filteredApplications}
          selectedApplicationIds={selectedApplicationIds}
          onDeleteApplication={handleDeleteApplication}
          onEditApplication={onEditApplication}
          onSelectApplication={handleSelectApplication}
          selectionMode={isSelectionMode}
        />
      </section>
    </AppLayout>
  )
}

export default DashboardPage
