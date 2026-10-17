import ApplicationCard from './ApplicationCard'

function ApplicationList({
  applications,
  isReadOnly = false,
  isDeleting = false,
  selectedApplicationIds = [],
  onClearFilters,
  onDeleteApplication,
  onEditApplication,
  onSelectApplication,
  onStatusChange,
  onViewApplication,
  selectionMode = false,
  statusMutations = {},
}) {
  return (
    <div className="application-list">
      {applications.length > 0 && (
        <div className="application-list-heading" aria-hidden="true">
          <span>Role</span>
          <span>Status</span>
          <span className="list-location">Location</span>
          <span className="list-applied">Applied</span>
          <span className="list-salary">Salary</span>
          <span className="list-interviews">Interviews</span>
          <span>Actions</span>
        </div>
      )}
      {applications.map((application) => (
        <ApplicationCard
          application={application}
          isReadOnly={isReadOnly}
          isDeleting={isDeleting}
          isSelected={selectedApplicationIds.includes(application.id)}
          key={application.id}
          onDeleteApplication={onDeleteApplication}
          onEditApplication={onEditApplication}
          onSelectApplication={onSelectApplication}
          onStatusChange={onStatusChange}
          onViewApplication={onViewApplication}
          selectionMode={selectionMode}
          statusMutation={statusMutations[application.id]}
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
