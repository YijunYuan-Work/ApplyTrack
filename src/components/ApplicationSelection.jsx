function ApplicationSelection({ selected, onChange }) {
  const label = selected ? 'Unselect application' : 'Select application'
  return (
    <label className="card-select" title={label}>
      <input type="checkbox" checked={selected} onChange={onChange} />
      <span className="sr-only">{label}</span>
    </label>
  )
}

export default ApplicationSelection
