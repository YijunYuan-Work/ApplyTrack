import ApplicationCard from './ApplicationCard'

function ApplicationList({
  applications,
  onDeleteApplication,
  onEditApplication,
}) {
  return (
    <div className="application-list">
      {applications.map((application) => (
        <ApplicationCard
          application={application}
          key={application.id}
          onDeleteApplication={onDeleteApplication}
          onEditApplication={onEditApplication}
        />
      ))}

      {applications.length === 0 && (
        <div className="empty-state">
          <h3>No applications found</h3>
          <p>Try a different search or status filter.</p>
        </div>
      )}
    </div>
  )
}

export default ApplicationList
