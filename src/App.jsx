import { useEffect, useMemo, useState } from 'react'
import './App.css'

const initialApplications = [
  {
    id: 1,
    company: 'Northstar Labs',
    role: 'Frontend Developer',
    location: 'Remote',
    status: 'Applied',
    date: '2026-05-20',
  },
  {
    id: 2,
    company: 'Brightline Health',
    role: 'React Engineer',
    location: 'Toronto, ON',
    status: 'Interview',
    date: '2026-05-23',
  },
]

const statuses = ['Wishlist', 'Applied', 'Interview', 'Offer', 'Rejected']

const blankApplication = {
  company: '',
  role: '',
  location: '',
  status: 'Applied',
  date: new Date().toISOString().slice(0, 10),
}

function loadApplications() {
  const savedApplications = localStorage.getItem('applytrack-applications')

  if (!savedApplications) {
    return initialApplications
  }

  try {
    return JSON.parse(savedApplications)
  } catch {
    return initialApplications
  }
}

function App() {
  const [applications, setApplications] = useState(loadApplications)
  const [formData, setFormData] = useState(blankApplication)

  useEffect(() => {
    localStorage.setItem(
      'applytrack-applications',
      JSON.stringify(applications),
    )
  }, [applications])

  const statusCounts = useMemo(
    () =>
      statuses.map((status) => ({
        status,
        count: applications.filter((application) => application.status === status)
          .length,
      })),
    [applications],
  )

  function handleChange(event) {
    const { name, value } = event.target
    setFormData((currentData) => ({ ...currentData, [name]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()

    const nextApplication = {
      id: Date.now(),
      company: formData.company.trim(),
      role: formData.role.trim(),
      location: formData.location.trim() || 'Not specified',
      status: formData.status,
      date: formData.date,
    }

    if (!nextApplication.company || !nextApplication.role) {
      return
    }

    setApplications((currentApplications) => [
      nextApplication,
      ...currentApplications,
    ])
    setFormData(blankApplication)
  }

  return (
    <main className="app-shell">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">ApplyTrack</p>
          <h1>Keep every job application moving.</h1>
          <p className="hero-text">
            Track roles, companies, dates, and interview progress from one calm
            workspace built for your job search.
          </p>
          <div className="hero-actions" aria-label="Application summary">
            <span>{applications.length} applications</span>
            <span>{statusCounts.find((item) => item.status === 'Interview').count} interviews</span>
          </div>
        </div>

        <form className="application-form" onSubmit={handleSubmit}>
          <div className="form-header">
            <h2>Add application</h2>
            <p>Log a role as soon as it lands on your radar.</p>
          </div>

          <label>
            Company
            <input
              name="company"
              value={formData.company}
              onChange={handleChange}
              placeholder="Acme Inc."
              required
            />
          </label>

          <label>
            Role
            <input
              name="role"
              value={formData.role}
              onChange={handleChange}
              placeholder="Product Designer"
              required
            />
          </label>

          <div className="form-grid">
            <label>
              Location
              <input
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Remote"
              />
            </label>

            <label>
              Date
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
              />
            </label>
          </div>

          <label>
            Status
            <select name="status" value={formData.status} onChange={handleChange}>
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>

          <button type="submit">Add application</button>
        </form>
      </section>

      <section className="tracker-section" aria-label="Application tracker">
        <div className="section-header">
          <div>
            <p className="eyebrow">Pipeline</p>
            <h2>Current applications</h2>
          </div>
          <div className="status-summary">
            {statusCounts.map((item) => (
              <span key={item.status}>
                {item.status}: {item.count}
              </span>
            ))}
          </div>
        </div>

        <div className="application-list">
          {applications.map((application) => (
            <article className="application-card" key={application.id}>
              <div>
                <p className="company">{application.company}</p>
                <h3>{application.role}</h3>
                <p className="meta">
                  {application.location} - Applied {application.date}
                </p>
              </div>
              <span className={`status ${application.status.toLowerCase()}`}>
                {application.status}
              </span>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

export default App
