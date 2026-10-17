import { useEffect, useMemo, useRef, useState } from 'react'
import { getRoute } from '../utils/routes'
import {
  ArrowUpDown,
  ArrowRight,
  CheckSquare,
  Columns3,
  List,
  Plus,
  RotateCcw,
  Search,
  SearchCheck,
} from 'lucide-react'
import AppLayout from '../components/AppLayout'
import ApplicationBoard from '../components/ApplicationBoard'
import ApplicationList from '../components/ApplicationList'
import MetricGrid from '../components/MetricGrid'
import ApplicationDetailDrawer from '../components/ApplicationDetailDrawer'
import ApplicationStatusNotice from '../components/ApplicationStatusNotice'
import { statuses } from '../data/applications'
import { formatJobAgentDate } from '../data/jobAgent'

function DashboardPage({
  applications,
  error,
  isDemo = false,
  isDeleting = false,
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
  statusMutations = {},
  user,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedApplicationIds] = useState([])
  // A confirmed removal may arrive after this Dashboard remounts during a delete.
  const applicationIds = new Set(applications.map((application) => application.id))
  const selectedApplicationIds = selectedIds.filter((id) => applicationIds.has(id))
  const [sortBy, setSortBy] = useState('applied')
  const [statusFilter, setStatusFilter] = useState('All')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState('board')
  const [activeBoardStatus, setActiveBoardStatus] = useState('Applied')
  const [isCompactBoard, setIsCompactBoard] = useState(
    () => window.matchMedia('(width < 640px)').matches,
  )
  const [detailId, setDetailId] = useState(null)
  const detailApplication = applications.find((application) => application.id === detailId)
  const [deleteError, setDeleteError] = useState('')
  const [deletePending, setDeletePending] = useState(false)
  const pendingDelete = useRef(false)
  const active = useRef(true)
  const [originRoute] = useState(getRoute)
  const deletionBusy = isDeleting || deletePending

  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])

  useEffect(() => {
    // Match the theme's stage-tab breakpoint, including live viewport changes.
    const mediaQuery = window.matchMedia('(width < 640px)')
    const handleViewportChange = (event) => setIsCompactBoard(event.matches)
    mediaQuery.addEventListener('change', handleViewportChange)
    return () => mediaQuery.removeEventListener('change', handleViewportChange)
  }, [])

  const statusCounts = useMemo(
    () =>
      statuses.map((status) => ({
        status,
        count: applications.filter((application) => application.status === status).length,
      })),
    [applications],
  )

  const filteredApplications = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return applications
      .filter((application) => {
        const matchesStatus = statusFilter === 'All' || application.status === statusFilter
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
          sortBy === 'lastUpdated' ? firstApplication.lastUpdated : firstApplication.date
        const secondDate =
          sortBy === 'lastUpdated' ? secondApplication.lastUpdated : secondApplication.date

        return String(secondDate || '').localeCompare(String(firstDate || ''))
      })
  }, [applications, searchTerm, sortBy, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pageStartIndex = (safeCurrentPage - 1) * pageSize
  const pagedApplications = filteredApplications.slice(pageStartIndex, pageStartIndex + pageSize)
  const pageEndIndex =
    filteredApplications.length === 0
      ? 0
      : Math.min(pageStartIndex + pageSize, filteredApplications.length)

  const selectionScope =
    viewMode === 'list'
      ? pagedApplications
      : isCompactBoard
        ? filteredApplications.filter(
            (application) =>
              (statuses.includes(application.status) ? application.status : 'Applied') ===
              activeBoardStatus,
          )
        : filteredApplications
  const visibleApplicationIds = selectionScope.map((application) => application.id)
  const allVisibleSelected =
    visibleApplicationIds.length > 0 &&
    visibleApplicationIds.every((applicationId) => selectedApplicationIds.includes(applicationId))

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
      if (visibleApplicationIds.every((id) => currentIds.includes(id))) {
        return currentIds.filter((applicationId) => !visibleApplicationIds.includes(applicationId))
      }

      return Array.from(new Set([...currentIds, ...visibleApplicationIds]))
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

  async function handleDelete(action) {
    if (pendingDelete.current || isDeleting) return
    pendingDelete.current = true
    setDeletePending(true)
    const isCurrent = () => active.current && getRoute() === originRoute
    try {
      const result = await action()
      if (!isCurrent()) return
      if (result?.status === 'deleted' && Array.isArray(result.deletedIds)) {
        setSelectedApplicationIds((currentIds) =>
          currentIds.filter((id) => !result.deletedIds.includes(id)),
        )
        setDeleteError('')
      } else if (result?.status === 'error') {
        setDeleteError(result.message)
      } else if (!['canceled', 'stale', 'pending'].includes(result?.status)) {
        setDeleteError(
          'Deletion could not be confirmed. Reload to check saved records before retrying.',
        )
      }
    } catch (error) {
      if (isCurrent())
        setDeleteError(
          `Deletion could not be confirmed. ${error.message} Reload to check saved records before retrying.`,
        )
    } finally {
      pendingDelete.current = false
      if (active.current) setDeletePending(false)
    }
  }

  const handleBulkDelete = () => {
    const ids = [...selectedApplicationIds]
    return handleDelete(() => onBulkDeleteApplications(ids))
  }
  const handleDeleteApplication = (id) => handleDelete(() => onDeleteApplication(id))

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
          Showing {pageStartIndex + 1}-{pageEndIndex} of {filteredApplications.length}
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
            onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
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
      showAddApplication={!isReadOnly}
      user={user}
    >
      <section className="dashboard-workspace" aria-label="Dashboard workspace">
        <section className="dashboard-command-panel" aria-label="Pipeline overview">
          <header className="app-header dashboard-header">
            <div>
              <p className="ui-eyebrow">Dashboard</p>
              <h1>Your application pipeline</h1>
              <p>Review and update your applications.</p>
            </div>
            <div className="header-actions">
              {isDemo && <span className="demo-badge">Public demo</span>}
              <button className="ui-button ui-button-ghost" type="button" onClick={onProgress}>
                View progress
              </button>
              {!isReadOnly && (
                <button
                  className="ui-button ui-button-primary dashboard-add-action"
                  type="button"
                  onClick={onAddApplication}
                >
                  <Plus size={18} aria-hidden="true" />
                  Add application
                </button>
              )}
            </div>
          </header>
          <MetricGrid
            applications={applications}
            statusCounts={statusCounts}
            isLoading={isLoading}
          />
        </section>
        {jobAgentSummary?.error && (
          <p className="form-error" role="alert">
            Job queue count unavailable. Reload to try again.
          </p>
        )}
        {jobAgentSummary?.available && (
          <section className="agent-dashboard-strip" aria-label="Job Agent summary">
            <span className="agent-dashboard-icon" aria-hidden="true">
              <SearchCheck size={22} />
            </span>
            <div className="agent-dashboard-copy">
              <p className="ui-eyebrow">Job Agent</p>
              <h2>
                {jobAgentSummary.enabled
                  ? `${jobAgentSummary.pendingCount} jobs waiting to be applied`
                  : 'Connect your LinkedIn and Indeed alerts'}
              </h2>
              <p>
                {jobAgentSummary.enabled
                  ? `Last alert ${formatJobAgentDate(jobAgentSummary.lastAlertAt)}. ${jobAgentSummary.appliedCount} moved to your pipeline.`
                  : 'Create a private forwarding address, then work through every imported job in one queue.'}
              </p>
            </div>
            <button className="ui-button ui-button-primary" type="button" onClick={onJobAgent}>
              {jobAgentSummary.enabled ? 'View application queue' : 'Set up Job Agent'}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </section>
        )}
        <section className="tracker-section" aria-label="Application tracker">
          <div className="section-header">
            <div>
              <p className="ui-eyebrow">Pipeline</p>
              <h2>Your applications</h2>
            </div>
            <div className="pipeline-view-actions">
              <div className="view-toggle" data-view={viewMode} aria-label="Application view">
                <span className="view-indicator" aria-hidden="true" />
                <button
                  className={viewMode === 'board' ? 'active' : ''}
                  aria-pressed={viewMode === 'board'}
                  type="button"
                  onClick={handleShowBoardView}
                >
                  <Columns3 size={15} aria-hidden="true" />
                  Board
                </button>
                <button
                  className={viewMode === 'list' ? 'active' : ''}
                  aria-pressed={viewMode === 'list'}
                  type="button"
                  onClick={() => setViewMode('list')}
                >
                  <List size={15} aria-hidden="true" />
                  List
                </button>
              </div>
              {!isReadOnly && (
                <button
                  className={`ui-button ui-button-ghost ${isSelectionMode ? 'icon-action-active' : ''}`}
                  aria-label={isSelectionMode ? 'Exit multi-select' : 'Enter multi-select'}
                  aria-pressed={isSelectionMode}
                  title={isSelectionMode ? 'Exit multi-select' : 'Multi-select'}
                  disabled={!isSelectionMode && filteredApplications.length === 0}
                  type="button"
                  onClick={handleToggleSelectionMode}
                >
                  <CheckSquare size={17} aria-hidden="true" />
                  {isSelectionMode ? 'Done' : 'Select'}
                </button>
              )}
            </div>
          </div>
          <div className="tracker-control-bar">
            <div className="toolbar" aria-label="Filter applications">
              <label className="toolbar-search">
                <Search size={17} aria-hidden="true" />
                <span className="sr-only">Search</span>
                <input
                  value={searchTerm}
                  placeholder="Company, role, notes..."
                  onChange={(event) => {
                    setSearchTerm(event.target.value)
                    resetToFirstPage()
                  }}
                />
              </label>
              <div className="status-filters" aria-label="Filter by status">
                {['All', ...statuses].map((status) => (
                  <button
                    type="button"
                    key={status}
                    aria-label={`Filter status: ${status}`}
                    aria-pressed={statusFilter === status}
                    onClick={() => {
                      setStatusFilter(status)
                      setViewMode('list')
                      if (statuses.includes(status)) setActiveBoardStatus(status)
                      resetToFirstPage()
                    }}
                  >
                    {status}
                    <span>
                      {status === 'All'
                        ? applications.length
                        : statusCounts.find((item) => item.status === status).count}
                    </span>
                  </button>
                ))}
              </div>
              <label className="sort-control">
                <ArrowUpDown size={15} aria-hidden="true" />
                <span className="sr-only">Sort</span>
                <select
                  value={sortBy}
                  onChange={(event) => {
                    setSortBy(event.target.value)
                    resetToFirstPage()
                  }}
                >
                  <option value="applied">Applied date</option>
                  <option value="lastUpdated">Last updated</option>
                </select>
              </label>
            </div>
            {!isReadOnly && isSelectionMode && (
              <div className="list-action-bar" aria-label="Application list actions">
                {isSelectionMode && (
                  <div className="bulk-toolbar" aria-label="Bulk application actions">
                    <span>{selectedApplicationIds.length} selected</span>
                    <button
                      className="ui-button ui-button-ghost"
                      disabled={visibleApplicationIds.length === 0}
                      type="button"
                      onClick={handleSelectAllVisible}
                    >
                      {allVisibleSelected ? 'Unselect all' : 'Select all'}
                    </button>
                    <button
                      className="ui-button ui-button-remove"
                      aria-busy={deletionBusy}
                      disabled={selectedApplicationIds.length === 0 || deletionBusy}
                      type="button"
                      onClick={handleBulkDelete}
                    >
                      Delete selected
                    </button>
                    {selectedApplicationIds.length > 0 && (
                      <button
                        className="ui-button ui-button-ghost"
                        type="button"
                        onClick={handleClearSelection}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
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
              <button
                className="ui-button ui-button-ghost filter-reset"
                type="button"
                onClick={handleClearFilters}
              >
                <RotateCcw size={15} aria-hidden="true" />
                Clear filters
              </button>
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {deleteError && !detailApplication && (
            <p className="form-error" role="alert">
              {deleteError}
            </p>
          )}
          {deletionBusy && (
            <p className="loading-message" role="status">
              Deleting applications...
            </p>
          )}
          {isLoading && (
            <p className="loading-message" role="status">
              Loading applications...
            </p>
          )}
          {viewMode === 'list' ? (
            <>
              {renderPaginationControls('Top')}
              <ApplicationList
                applications={pagedApplications}
                isReadOnly={isReadOnly}
                isDeleting={deletionBusy}
                onClearFilters={handleClearFilters}
                selectedApplicationIds={selectedApplicationIds}
                onDeleteApplication={handleDeleteApplication}
                onEditApplication={onEditApplication}
                onViewApplication={setDetailId}
                onSelectApplication={handleSelectApplication}
                onStatusChange={onStatusChange}
                statusMutations={statusMutations}
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
              onViewApplication={setDetailId}
              onStatusChange={onStatusChange}
              statusMutations={statusMutations}
              selectionMode={isSelectionMode}
              selectedApplicationIds={selectedApplicationIds}
              onSelectApplication={handleSelectApplication}
            />
          )}
        </section>
        <ApplicationStatusNotice applications={applications} />
        {detailApplication && (
          <ApplicationDetailDrawer
            key={detailApplication.id}
            application={detailApplication}
            isReadOnly={isReadOnly}
            isDeleting={deletionBusy}
            deleteError={deleteError}
            mutation={statusMutations[detailApplication.id]}
            onClose={() => setDetailId(null)}
            onDelete={handleDeleteApplication}
            onEdit={onEditApplication}
            onStatusChange={onStatusChange}
          />
        )}
      </section>
    </AppLayout>
  )
}

export default DashboardPage
