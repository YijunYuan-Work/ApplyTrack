function StatusBadge({ status }) {
  const statusClass = status.toLowerCase().replace(/\s+/g, '-')

  return (
    <span className={`status ${statusClass}`}>
      <span className="status-dot" aria-hidden="true"></span>
      {status}
    </span>
  )
}

export default StatusBadge
