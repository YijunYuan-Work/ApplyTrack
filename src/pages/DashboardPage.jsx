import { useMemo, useState } from 'react'
import {
  ArrowUpDown,
  ArrowRight,
  CheckSquare,
  Columns3,
  Filter,
  List,
  RotateCcw,
  Search,
  SearchCheck,
} from 'lucide-react'
import AppLayout from '../components/AppLayout'
import ApplicationBoard from '../components/ApplicationBoard'
import ApplicationList from '../components/ApplicationList'
import MetricGrid from '../components/MetricGrid'
import { statuses } from '../data/applications'
import { formatJobAgentDate } from '../data/jobAgent'

function DashboardPage({
  applications,
  error,
  isDemo = false,
  isLoading,
  isReadOnly = false,
  jobAgentSummary,
  onAddApplication,
  onBulkDeleteApplications,
  onDeleteApplication,
  onDashboard,
  onEditApplication,
  onImportExcel,
  onJobAgent,
  onProfile,
  onProgress,
  onSignOut,
  onStatusChange,
  user,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedApplicationIds, setSelectedApplicationIds] = useState([])
  const [sortBy, setSortBy] = useState('applied')
  const [statusFilter, setStatusFilter] = useState('All')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState('board')
  const [activeBoardStatus, setActiveBoardStatus] = useState('Applied')

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

  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pageStartIndex = (safeCurrentPage - 1) * pageSize
  const pagedApplications = filteredApplications.slice(
    pageStartIndex,
    pageStartIndex + pageSize,
  )
  const pageEndIndex =
    filteredApplications.length === 0
      ? 0
      : Math.min(pageStartIndex + pageSize, filteredApplications.length)

  const pagedApplicationIds = pagedApplications.map(
    (application) => application.id,
  )
  const allVisibleSelected =
    pagedApplicationIds.length > 0 &&
    pagedApplicationIds.every((applicationId) =>
      selectedApplicationIds.includes(applicationId),
    )

  function resetToFirstPage() {
    setCurrentPage(1)
  }

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
          (applicationId) => !pagedApplicationIds.includes(applicationId),
        )
      }

      return Array.from(new Set([...currentIds, ...pagedApplicationIds]))
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

  function handleShowBoardView() {
    setStatusFilter('All')
    setViewMode('board')
    resetToFirstPage()
  }

  function handleClearFilters() {
    setSearchTerm('')
    setStatusFilter('All')
    setSortBy('applied')
    setActiveBoardStatus('Applied')
    resetToFirstPage()
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

  function renderPaginationControls(position) {
    if (filteredApplications.length === 0 || totalPages <= 1) {
      return null
    }

    return (
      <div
        className={`pagination-bar pagination-bar-${position.toLowerCase()}`}
        aria-label={`${position} pagination controls`}
      >
        <p>
          Showing {pageStartIndex + 1}-{pageEndIndex} of{' '}
          {filteredApplications.length}
        </p>

        <label>
          Per page
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value))
              resetToFirstPage()
            }}
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
          </select>
        </label>

        <div className="pagination-buttons">
          <button
            className="ghost-button"
            disabled={safeCurrentPage === 1}
            type="button"
            onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
          >
            Previous
          </button>
          <span>
            Page {safeCurrentPage} of {totalPages}
          </span>
          <button
            className="ghost-button"
            disabled={safeCurrentPage === totalPages}
            type="button"
            onClick={() =>
              setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))
            }
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  return (
    <AppLayout
      currentPage="dashboard"
      isDemo={isDemo}
      isReadOnly={isReadOnly}
      onAddApplication={onAddApplication}
      onDashboard={onDashboard}
      onImportExcel={onImportExcel}
      onJobAgent={onJobAgent}
      onProfile={onProfile}
      onProgress={onProgress}
      onSignOut={onSignOut}
      user={user}
    >
      <section className="dashboard-workspace" aria-label="Dashboard workspace">
        <section className="dashboard-command-panel" aria-label="Pipeline overview">
          <header className="app-header dashboard-header">
            <div>
              <p className="eyebrow desktop-dashboard-copy">Dashboard</p>
              <h1 className="desktop-dashboard-copy">Your application pipeline</h1>
              <h1 className="mobile-dashboard-copy mobile-dashboard-title">
                Your application pipeline
              </h1>
              <p className="mobile-dashboard-copy mobile-dashboard-subtitle">
                Review and update your applications.
              </p>
            </div>
            {isReadOnly ? (
              <div className="header-actions">
                <span className="demo-badge">Public demo</span>
              </div>
            ) : (
              <div className="header-actions">
                <button className="primary-action" type="button" onClick={onAddApplication}>
                  <span className="button-plus" aria-hidden="true"></span>
                  <span>Add application</span>
                </button>
                <button className="ghost-button" type="button" onClick={onProgress}>
                  View progress
                </button>
              </div>
            )}
          </header>

          <MetricGrid
            applications={applications}
            statusCounts={statusCounts}
          />
        </section>

        {jobAgentSummary?.available && (
          <section className="agent-dashboard-strip" aria-label="Job Agent summary">
            <span className="agent-dashboard-icon" aria-hidden="true">
              <SearchCheck size={22} />
            </span>
            <div className="agent-dashboard-copy">
              <p className="eyebrow">Job Agent</p>
              <h2>
                {jobAgentSummary.enabled
                  ? `${jobAgentSummary.newCount} new matches to review`
                  : 'Connect your LinkedIn and Indeed alerts'}
              </h2>
              <p>
                {jobAgentSummary.enabled
                  ? `Last alert ${formatJobAgentDate(jobAgentSummary.lastAlertAt)}. ${jobAgentSummary.savedCount} saved.`
                  : 'Create a private forwarding address, then review every imported match before applying.'}
              </p>
            </div>
            <button className="secondary-action" type="button" onClick={onJobAgent}>
              {jobAgentSummary.enabled ? 'Review matches' : 'Set up Job Agent'}
              <ArrowRight aria-hidden="true" size={17} />
            </button>
          </section>
        )}

        <section className="tracker-section" aria-label="Application tracker">
          <div className="section-header">
            <div>
              <p className="eyebrow desktop-dashboard-copy">Pipeline</p>
              <h2 className="desktop-dashboard-copy">Your applications</h2>
              <p className="mobile-dashboard-copy mobile-section-eyebrow">Pipeline</p>
              <h2 className="mobile-dashboard-copy mobile-pipeline-title">
                Your applications
              </h2>
            </div>
            <div className="status-summary">
              {statusCounts.map((item) => (
                <span key={item.status}>
                  {item.status}: {item.count}
                </span>
              ))}
            </div>
          </div>

          <div className="tracker-control-bar">
            <div className="view-toggle" aria-label="Application view">
              <button
                className={viewMode === 'board' ? 'active' : ''}
                type="button"
                onClick={handleShowBoardView}
              >
                <Columns3 className="view-icon" aria-hidden="true" size={20} />
                <span>Board</span>
              </button>
              <button
                className={viewMode === 'list' ? 'active' : ''}
                type="button"
                onClick={() => setViewMode('list')}
              >
                <List className="view-icon" aria-hidden="true" size={20} />
                <span>List</span>
              </button>
            </div>

            <div className="toolbar" aria-label="Filter applications">
              <label className="toolbar-search">
                <Search className="toolbar-icon" aria-hidden="true" size={21} />
                <span className="sr-only">Search</span>
                <input
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value)
                    resetToFirstPage()
                  }}
                  placeholder="Company, role, notes..."
                />
              </label>

              <label>
                <span className="toolbar-label">
                  <Filter className="toolbar-icon" aria-hidden="true" size={20} />
                  Status
                </span>
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    const nextStatusFilter = event.target.value
                    setStatusFilter(nextStatusFilter)
                    setViewMode('list')
                    if (statuses.includes(nextStatusFilter)) {
                      setActiveBoardStatus(nextStatusFilter)
                    }
                    resetToFirstPage()
                  }}
                >
                  <option>All</option>
                  {statuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>

              <label>
                <span className="toolbar-label">
                  <ArrowUpDown className="toolbar-icon" aria-hidden="true" size={20} />
                  Sort
                </span>
                <select
                  value={sortBy}
                  onChange={(event) => {
                    setSortBy(event.target.value)
                    resetToFirstPage()
                  }}
                >
                  <option value="applied">Applied date</option>
                  <option value="lastUpdated">Last updated date</option>
                </select>
              </label>
            </div>

            {!isReadOnly && (
              <div className="list-action-bar" aria-label="Application list actions">
                {isSelectionMode && (
                  <div className="bulk-toolbar" aria-label="Bulk application actions">
                    <span>{selectedApplicationIds.length} selected</span>
                    <button
                      className="ghost-button"
                      disabled={pagedApplications.length === 0}
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
                  <CheckSquare className="multi-select-glyph" aria-hidden="true" size={21} />
                  <span className="icon-action-label">
                    {isSelectionMode ? 'Done' : 'Select'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {(searchTerm.trim() || statusFilter !== 'All' || sortBy !== 'applied') && (
            <div className="active-filter-bar" aria-label="Active filters">
              <div className="active-filter-list">
                {searchTerm.trim() && <span>Search: {searchTerm.trim()}</span>}
                {statusFilter !== 'All' && <span>Status: {statusFilter}</span>}
                {sortBy !== 'applied' && <span>Sort: Last updated</span>}
              </div>
              <button className="filter-reset" type="button" onClick={handleClearFilters}>
                <RotateCcw aria-hidden="true" size={16} />
                Clear filters
              </button>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}
          {isLoading && <p className="loading-message">Loading applications...</p>}

          {viewMode === 'list' ? (
            <>
              {renderPaginationControls('Top')}

              <ApplicationList
                applications={pagedApplications}
                isReadOnly={isReadOnly}
                onClearFilters={handleClearFilters}
                selectedApplicationIds={selectedApplicationIds}
                onDeleteApplication={handleDeleteApplication}
                onEditApplication={onEditApplication}
                onSelectApplication={handleSelectApplication}
                onStatusChange={onStatusChange}
                selectionMode={isSelectionMode}
              />

              {renderPaginationControls('Bottom')}
            </>
          ) : (
            <ApplicationBoard
              activeStatus={activeBoardStatus}
              applications={filteredApplications}
              isReadOnly={isReadOnly}
              onChangeActiveStatus={setActiveBoardStatus}
              onClearFilters={handleClearFilters}
              onEditApplication={onEditApplication}
              onStatusChange={onStatusChange}
            />
          )}
        </section>
      </section>
    </AppLayout>
  )
}

export default DashboardPage
