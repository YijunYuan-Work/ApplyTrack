import ApplicationCard from './ApplicationCard'

function ApplicationList({
  applications,
  isReadOnly = false,
  selectedApplicationIds = [],
  onClearFilters,
  onDeleteApplication,
  onEditApplication,
  onSelectApplication,
  onStatusChange,
  selectionMode = false,
}) {
  return (
    <div className="application-list">
      {applications.map((application) => (
        <ApplicationCard
          application={application}
          isReadOnly={isReadOnly}
          isSelected={selectedApplicationIds.includes(application.id)}
          key={application.id}
          onDeleteApplication={onDeleteApplication}
          onEditApplication={onEditApplication}
          onSelectApplication={onSelectApplication}
          onStatusChange={onStatusChange}
          selectionMode={selectionMode}
        />
      ))}

      {applications.length === 0 && (
        <div className="empty-state">
          <h3>No applications found</h3>
          <p>Try a different search or status filter.</p>
          <button className="ghost-button" type="button" onClick={onClearFilters}>
            Clear filters
          </button>
        </div>
      )}
    </div>
  )
}

export default ApplicationList
