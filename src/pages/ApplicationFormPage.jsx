import { useEffect, useRef, useState } from 'react'
import { validateApplicationForm } from '../data/applicationForm'
import { getRoute } from '../utils/routes'
import AppLayout from '../components/AppLayout'
import {
  createBlankApplication,
  normalizeApplication,
  statuses,
} from '../data/applications'

function getInitialApplication(application) {
  return application
    ? normalizeApplication(application)
    : createBlankApplication()
}

function ApplicationFormPage({
  application,
  isDemo = false,
  onAddApplication,
  onCancel,
  onDashboard,
  onImportExcel,
  onJobAgent,
  onProfile,
  onProgress,
  onSave,
  onSignOut,
  user,
}) {
  const [initialFormData] = useState(() => getInitialApplication(application))
  const [formData, setFormData] = useState(initialFormData)
  const [isSaving, setIsSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saveError, setSaveError] = useState('')
  const [originRoute] = useState(getRoute)
  const active = useRef(true)
  const saving = useRef(false)
  const formRef = useRef(null)
  const isDirty = JSON.stringify(formData) !== JSON.stringify(initialFormData)

  useEffect(() => {
    active.current = true
    const checkRoute = () => {
      if (getRoute() !== originRoute) active.current = false
    }
    window.addEventListener('hashchange', checkRoute)
    return () => {
      active.current = false
      window.removeEventListener('hashchange', checkRoute)
    }
  }, [originRoute])

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!isDirty || isSaving) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty, isSaving])

  function handleChange(event) {
    const { name, value } = event.target
    setFieldErrors((current) => ({ ...current, [name]: undefined }))
    setFormData((currentData) => {
      const nextData = { ...currentData, [name]: value }

      if (
        name === 'status' &&
        value === 'Interview' &&
        Number(currentData.interviewCount || 0) === 0
      ) {
        nextData.interviewCount = 1
      }

      return nextData
    })
  }

  function confirmNavigation(action) {
    if (
      isDirty &&
      !isSaving &&
      !window.confirm('Discard your unsaved application changes?')
    ) {
      return
    }

    action()
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (saving.current) {
      return
    }
    const errors = validateApplicationForm(formData)
    setFieldErrors(errors)
    setSaveError('')
    if (Object.keys(errors).length) {
      formRef.current.elements.namedItem(Object.keys(errors)[0]).focus()
      return
    }
    saving.current = true
    setIsSaving(true)

    try {
      const result = await onSave(formData, application?.id, initialFormData)
      if (!active.current || getRoute() !== originRoute) return
      if (result?.status === 'saved') onDashboard()
      else if (result?.status === 'invalid') {
        setFieldErrors(result.errors)
        formRef.current.elements.namedItem(Object.keys(result.errors)[0]).focus()
      } else if (result?.status !== 'canceled') {
        setSaveError(result?.message || 'Could not save this application. Please try again.')
      }
    } catch (error) {
      if (active.current && getRoute() === originRoute) {
        setSaveError(error.message || 'Could not save this application. Please try again.')
      }
    } finally {
      saving.current = false
      if (active.current) setIsSaving(false)
    }
  }

  return (
    <AppLayout
      currentPage="applications"
      isDemo={isDemo}
      onAddApplication={() => confirmNavigation(onAddApplication)}
      onDashboard={() => confirmNavigation(onDashboard)}
      onImportExcel={() => confirmNavigation(onImportExcel)}
      onJobAgent={() => confirmNavigation(onJobAgent)}
      onProfile={() => confirmNavigation(onProfile)}
      onProgress={() => confirmNavigation(onProgress)}
      onSignOut={() => confirmNavigation(onSignOut)}
      showAddApplication={false}
      user={user}
    >
      <header className="app-header compact">
        <div>
          <p className="eyebrow">ApplyTrack</p>
          <h1>{application ? 'Edit application' : 'Add a new application'}</h1>
          <p>{user.name}, keep this opportunity current.</p>
        </div>
        <button
          className="ghost-button"
          type="button"
          onClick={() => confirmNavigation(onCancel)}
        >
          Back to dashboard
        </button>
      </header>

      <section className="form-page">
        <form
          ref={formRef}
          aria-busy={isSaving}
          className="application-form"
          onSubmit={handleSubmit}
        >
          <div className="form-header">
            <div>
              <h2>{application ? 'Update details' : 'Application details'}</h2>
              <p>
                {application ? 'Update the latest details.' : 'Capture the role details.'}
              </p>
            </div>
          </div>

          {(saveError || fieldErrors.company || fieldErrors.role) && (
            <p className="form-error" role="alert">
              {saveError || Object.values(fieldErrors).filter(Boolean).join(' ')}
            </p>
          )}

          <fieldset className="application-form-section">
            <legend>Essentials</legend>

            <div className="application-form-section-fields">
              <div className="form-grid">
                <label>
                  <span className="required-label">
                    Company
                    <span aria-hidden="true" className="required-mark">
                      *
                    </span>
                    <span className="sr-only">required</span>
                  </span>
                  <input
                    aria-invalid={Boolean(fieldErrors.company)}
                    aria-describedby={fieldErrors.company ? 'company-error' : undefined}
                    autoComplete="organization"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    placeholder="Acme Inc."
                    required
                  />
                  {fieldErrors.company && <span id="company-error" className="field-hint">{fieldErrors.company}</span>}
                </label>

                <label>
                  <span className="required-label">
                    Role
                    <span aria-hidden="true" className="required-mark">
                      *
                    </span>
                    <span className="sr-only">required</span>
                  </span>
                  <input
                    aria-invalid={Boolean(fieldErrors.role)}
                    aria-describedby={fieldErrors.role ? 'role-error' : undefined}
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    placeholder="Product Designer"
                    required
                  />
                  {fieldErrors.role && <span id="role-error" className="field-hint">{fieldErrors.role}</span>}
                </label>
              </div>

              <div className="form-grid">
                <label>
                  Location
                  <input
                    autoComplete="address-level2"
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
            </div>
          </fieldset>

          <fieldset className="application-form-section">
            <legend>Dates and interviews</legend>

            <div className="application-form-section-fields">
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
                Interview rounds completed
                <input
                  min="0"
                  name="interviewCount"
                  type="number"
                  value={formData.interviewCount}
                  onChange={handleChange}
                />
                <span className="field-hint">
                  Use 0 when the application has not reached an interview.
                </span>
              </label>
            </div>
          </fieldset>

          <fieldset className="application-form-section">
            <legend>Optional details</legend>

            <div className="application-form-section-fields">
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

              <div className="form-grid">
                <label>
                  Cover letter
                  <select
                    name="coverLetter"
                    value={formData.coverLetter}
                    onChange={handleChange}
                  >
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </label>

                <label>
                  Referral
                  <select
                    name="referral"
                    value={formData.referral}
                    onChange={handleChange}
                  >
                    <option>Yes</option>
                    <option>No</option>
                  </select>
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
            </div>
          </fieldset>

          {application && (
            <div className="system-field">
              <span>Last updated</span>
              <time dateTime={formData.lastUpdated}>{formData.lastUpdated}</time>
              <small>Updates automatically when you save changes.</small>
            </div>
          )}

          <div className="form-actions">
            <button type="submit" disabled={isSaving}>
              {isSaving
                ? 'Saving...'
                : application
                  ? 'Save changes'
                  : 'Add application'}
            </button>
            <button
              className="ghost-button"
              type="button"
              disabled={isSaving}
              onClick={() => confirmNavigation(onCancel)}
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    </AppLayout>
  )
}

export default ApplicationFormPage
