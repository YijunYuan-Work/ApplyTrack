import { useState } from 'react'
import {
  createBlankApplication,
  normalizeApplication,
  statuses,
} from '../data/applications'

function ApplicationFormPage({ application, error, onCancel, onSave, user }) {
  const [formData, setFormData] = useState(() =>
    application ? normalizeApplication(application) : createBlankApplication(),
  )

  function handleChange(event) {
    const { name, value } = event.target
    setFormData((currentData) => ({ ...currentData, [name]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSave(formData, application?.id)
  }

  return (
    <main className="app-shell">
      <header className="app-header compact">
        <div>
          <p className="eyebrow">ApplyTrack</p>
          <h1>{application ? 'Edit application' : 'Add a new application'}</h1>
          <p>{user.name}, keep this opportunity current.</p>
        </div>
        <button className="ghost-button" type="button" onClick={onCancel}>
          Back to dashboard
        </button>
      </header>

      <section className="form-page">
        <form className="application-form" onSubmit={handleSubmit}>
          <div className="form-header">
            <div>
              <h2>{application ? 'Update details' : 'Application details'}</h2>
              <p>
                {application ? 'Update the latest details.' : 'Capture the role details.'}
              </p>
            </div>
          </div>

          <div className="form-grid">
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
          </div>

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
              Status
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-grid">
            <label>
              Applied date
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
              />
            </label>

            <label>
              Follow-up date
              <input
                type="date"
                name="followUp"
                value={formData.followUp}
                onChange={handleChange}
              />
            </label>
          </div>

          <label>
            Job link
            <input
              type="url"
              name="jobUrl"
              value={formData.jobUrl}
              onChange={handleChange}
              placeholder="https://company.com/careers/role"
            />
          </label>

          <div className="form-grid">
            <label>
              Contact
              <input
                name="contact"
                value={formData.contact}
                onChange={handleChange}
                placeholder="Recruiter or hiring manager"
              />
            </label>

            <label>
              Salary range
              <input
                name="salary"
                value={formData.salary}
                onChange={handleChange}
                placeholder="$90k - $120k"
              />
            </label>
          </div>

          <label>
            Notes
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Interview prep, referral notes, next steps..."
              rows="4"
            />
          </label>

          <div className="form-actions">
            <button type="submit">
              {application ? 'Save changes' : 'Add application'}
            </button>
            <button className="ghost-button" type="button" onClick={onCancel}>
              Cancel
            </button>
          </div>

          {error && <p className="form-error">{error}</p>}
        </form>
      </section>
    </main>
  )
}

export default ApplicationFormPage
