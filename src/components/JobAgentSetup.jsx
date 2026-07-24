import { useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  Download,
  FileText,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  countryOptions,
  emptyJobAgentProfile,
  formatList,
  parseList,
  workAuthorizationOptions,
} from '../data/jobAgent'
import { AddressSearchInput } from './LocationInputs'
import JobAlertConnection from './JobAlertConnection'

function JobAgentSetup({
  inbox,
  initialProfile,
  isManagingAlerts,
  isSaving,
  messages = [],
  onCreateInbox,
  onDeleteResume,
  onDownloadResume,
  onRotateInbox,
  onSave,
  onToggleInbox,
  onUpdateResume,
  onUploadResume,
  resumes,
  user,
}) {
  const profile = initialProfile || {
    ...emptyJobAgentProfile,
    displayName: user.name || '',
    preferredName: user.name || '',
  }
  const [profileFields, setProfileFields] = useState({
    ...profile,
    reusableAnswers: { ...(profile.reusableAnswers || {}) },
    skills: formatList(profile.skills),
  })
  const primaryResume = resumes.find((resume) => resume.isPrimary) || resumes[0] || null
  const [resumeDraft, setResumeDraft] = useState(() => ({
    id: primaryResume?.id || null,
    skills: formatList(primaryResume?.skills || []),
    text: primaryResume?.extractedText || '',
  }))
  const [isUploading, setIsUploading] = useState(false)
  const [isDownloadingResume, setIsDownloadingResume] = useState(false)
  const [isUpdatingResume, setIsUpdatingResume] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInputRef = useRef(null)
  const authorizationOptions =
    workAuthorizationOptions[profileFields.workAuthorizationCountry] ||
    workAuthorizationOptions.ca
  const readiness = useMemo(
    () => [
      { complete: Boolean(primaryResume), label: 'Primary resume uploaded' },
      { complete: Boolean(profileFields.approved), label: 'Profile reviewed and approved' },
      {
        complete: Boolean(inbox?.enabled),
        label: 'Private forwarding address active',
      },
      {
        complete: messages.length > 0,
        label: 'First LinkedIn or Indeed alert received',
      },
    ],
    [inbox?.enabled, messages.length, primaryResume, profileFields.approved],
  )

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  function updateProfile(field, value) {
    setProfileFields((current) => ({ ...current, [field]: value }))
    clearMessages()
  }

  function updateReusableAnswer(field, value) {
    setProfileFields((current) => ({
      ...current,
      reusableAnswers: {
        ...current.reusableAnswers,
        [field]: value,
      },
    }))
    clearMessages()
  }

  function handleAddressSelect(address) {
    setProfileFields((current) => ({
      ...current,
      addressCountryCode: address.countryCode || current.addressCountryCode,
      addressLine1: address.addressLine1,
      city: address.city,
      formattedAddress: address.formattedAddress,
      latitude: address.latitude,
      longitude: address.longitude,
      postalCode: address.postalCode,
      region: address.region,
    }))
    clearMessages()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    clearMessages()

    if (!profileFields.firstName.trim() || !profileFields.lastName.trim()) {
      setError('Add your first and last name before saving.')
      return
    }

    try {
      await onSave({
        ...profileFields,
        enabled: profileFields.approved,
        reusableAnswers: profileFields.reusableAnswers || {},
        skills: parseList(profileFields.skills),
      })
      setProfileFields((current) => ({
        ...current,
        enabled: current.approved,
      }))
      setSuccess('Application profile saved.')
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  async function handleResumeChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    clearMessages()
    setIsUploading(true)

    try {
      const resume = await onUploadResume(file)
      setResumeDraft({
        id: resume.id,
        skills: formatList(resume.skills),
        text: resume.extractedText,
      })
      setProfileFields((current) => ({
        ...current,
        skills: formatList(
          [...new Set([...parseList(current.skills), ...resume.skills])],
        ),
      }))
      setSuccess('Resume uploaded and ready for future application assistance.')
    } catch (uploadError) {
      setError(uploadError.message)
    } finally {
      setIsUploading(false)
    }
  }

  async function handleResumeUpdate() {
    if (!resumeDraft.id || !resumeDraft.text.trim()) {
      return
    }

    clearMessages()
    setIsUpdatingResume(true)

    try {
      await onUpdateResume(
        resumeDraft.id,
        resumeDraft.text,
        parseList(resumeDraft.skills),
      )
      setSuccess('Detected resume skills updated.')
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setIsUpdatingResume(false)
    }
  }

  async function handleResumeDelete() {
    if (!primaryResume) {
      return
    }

    try {
      const deleted = await onDeleteResume(primaryResume)

      if (!deleted) {
        return
      }

      setResumeDraft({ id: null, skills: '', text: '' })
      setSuccess('Resume removed.')
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  async function handleResumeDownload() {
    if (!primaryResume) {
      return
    }

    clearMessages()
    setIsDownloadingResume(true)

    try {
      await onDownloadResume(primaryResume)
      setSuccess(`${primaryResume.fileName} downloaded.`)
    } catch (downloadError) {
      setError(downloadError.message)
    } finally {
      setIsDownloadingResume(false)
    }
  }

  return (
    <div className="agent-setup-layout">
      <aside className="agent-readiness" aria-label="Job Agent readiness">
        <div>
          <p className="eyebrow">Readiness</p>
          <h2>Application readiness</h2>
        </div>
        <ul>
          {readiness.map((item) => (
            <li className={item.complete ? 'complete' : ''} key={item.label}>
              <CheckCircle2 aria-hidden="true" size={18} />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
        <p className="agent-privacy-note">
          <ShieldCheck aria-hidden="true" size={18} />
          Your resume and application details are private to your account.
        </p>
      </aside>

      <div className="agent-setup-main">
        <JobAlertConnection
          inbox={inbox}
          isManaging={isManagingAlerts}
          messages={messages}
          onCreate={onCreateInbox}
          onRotate={onRotateInbox}
          onToggle={onToggleInbox}
        />

        <section className="agent-panel agent-resume-panel">
          <div className="agent-panel-heading">
            <div>
              <p className="eyebrow">Resume</p>
              <h2>Primary resume</h2>
              <p>PDF, DOCX, or TXT, up to 5 MB.</p>
            </div>
            <input
              ref={fileInputRef}
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              className="visually-hidden"
              type="file"
              onChange={handleResumeChange}
            />
            <button
              className="secondary-action"
              disabled={isUploading}
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload aria-hidden="true" size={18} />
              {isUploading ? 'Reading resume...' : primaryResume ? 'Replace resume' : 'Upload resume'}
            </button>
          </div>

          {primaryResume ? (
            <>
              <div className="agent-file-row">
                <span className="agent-file-icon"><FileText aria-hidden="true" size={20} /></span>
                <div>
                  <strong>{primaryResume.fileName}</strong>
                  <span>{Math.ceil(primaryResume.fileSize / 1024)} KB - Primary</span>
                </div>
                <div className="agent-file-actions">
                  <button
                    aria-label={`Download ${primaryResume.fileName}`}
                    className="icon-button"
                    disabled={isDownloadingResume}
                    title="Download resume"
                    type="button"
                    onClick={handleResumeDownload}
                  >
                    <Download aria-hidden="true" size={18} />
                  </button>
                  <button
                    aria-label="Delete resume"
                    className="icon-button danger-action"
                    title="Delete resume"
                    type="button"
                    onClick={handleResumeDelete}
                  >
                    <Trash2 aria-hidden="true" size={18} />
                  </button>
                </div>
              </div>

              <label>
                Detected resume skills
                <input
                  value={resumeDraft.skills}
                  onChange={(event) =>
                    setResumeDraft((current) => ({ ...current, skills: event.target.value }))
                  }
                  placeholder="React, SQL, customer service"
                />
              </label>
              <button
                className="secondary-action agent-inline-save"
                disabled={isUpdatingResume || !resumeDraft.text.trim()}
                type="button"
                onClick={handleResumeUpdate}
              >
                <Save aria-hidden="true" size={17} />
                {isUpdatingResume ? 'Saving...' : 'Save skill changes'}
              </button>
            </>
          ) : (
            <div className="agent-empty-inline">
              <FileText aria-hidden="true" size={24} />
              <span>Upload your resume so it is ready for future assisted applications.</span>
            </div>
          )}
        </section>

        <form className="agent-settings-form" onSubmit={handleSubmit}>
          <section className="agent-panel">
            <div className="agent-panel-heading">
              <div>
                <p className="eyebrow">Profile</p>
                <h2>Personal information</h2>
                <p>Your preferred name is used in ApplyTrack. Applications use your first and last name.</p>
              </div>
            </div>
            <div className="agent-form-grid agent-name-grid">
              <label>
                First name <span className="required-indicator">Required</span>
                <input
                  autoComplete="given-name"
                  required
                  value={profileFields.firstName}
                  onChange={(event) => updateProfile('firstName', event.target.value)}
                />
              </label>
              <label>
                Last name <span className="required-indicator">Required</span>
                <input
                  autoComplete="family-name"
                  required
                  value={profileFields.lastName}
                  onChange={(event) => updateProfile('lastName', event.target.value)}
                />
              </label>
              <label>
                Preferred name
                <input
                  autoComplete="nickname"
                  value={profileFields.preferredName}
                  onChange={(event) => updateProfile('preferredName', event.target.value)}
                  placeholder={profileFields.firstName || 'Optional'}
                />
              </label>
              <label>
                Phone
                <input
                  autoComplete="tel"
                  value={profileFields.phone}
                  onChange={(event) => updateProfile('phone', event.target.value)}
                  placeholder="Optional"
                />
              </label>
            </div>
          </section>

          <section className="agent-panel">
            <div className="agent-panel-heading">
              <div>
                <p className="eyebrow">Address</p>
                <h2>Application address</h2>
                <p>Street-level details are saved for application forms and are never sent to job-search providers.</p>
              </div>
            </div>
            <div className="agent-form-grid">
              <label className="agent-field-wide">
                Find your address
                <AddressSearchInput
                  countryCode={profileFields.addressCountryCode}
                  onSelect={handleAddressSelect}
                />
              </label>
              <label>
                Street address
                <input
                  autoComplete="address-line1"
                  value={profileFields.addressLine1}
                  onChange={(event) => updateProfile('addressLine1', event.target.value)}
                />
              </label>
              <label>
                Apartment, suite, or unit
                <input
                  autoComplete="address-line2"
                  value={profileFields.addressLine2}
                  onChange={(event) => updateProfile('addressLine2', event.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label>
                City
                <input
                  autoComplete="address-level2"
                  value={profileFields.city}
                  onChange={(event) => updateProfile('city', event.target.value)}
                />
              </label>
              <label>
                Province or state
                <input
                  autoComplete="address-level1"
                  value={profileFields.region}
                  onChange={(event) => updateProfile('region', event.target.value)}
                />
              </label>
              <label>
                Postal or ZIP code
                <input
                  autoComplete="postal-code"
                  value={profileFields.postalCode}
                  onChange={(event) => updateProfile('postalCode', event.target.value)}
                />
              </label>
              <label>
                Country
                <select
                  autoComplete="country"
                  value={profileFields.addressCountryCode}
                  onChange={(event) => updateProfile('addressCountryCode', event.target.value)}
                >
                  {countryOptions.map((country) => (
                    <option key={country.code} value={country.code}>{country.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="agent-panel">
            <div className="agent-panel-heading">
              <div>
                <p className="eyebrow">Eligibility</p>
                <h2>Work authorization and availability</h2>
                <p>Structured answers make future application reviews more consistent.</p>
              </div>
            </div>
            <div className="agent-form-grid">
              <label>
                Years of experience
                <input
                  min="0"
                  type="number"
                  value={profileFields.yearsExperience}
                  onChange={(event) => updateProfile('yearsExperience', event.target.value)}
                  placeholder="0"
                />
              </label>
              <label>
                Authorization country
                <select
                  value={profileFields.workAuthorizationCountry}
                  onChange={(event) => {
                    setProfileFields((current) => ({
                      ...current,
                      workAuthorizationCountry: event.target.value,
                      workAuthorizationStatus: '',
                    }))
                    clearMessages()
                  }}
                >
                  {countryOptions.map((country) => (
                    <option key={country.code} value={country.code}>{country.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Work authorization
                <select
                  value={profileFields.workAuthorizationStatus}
                  onChange={(event) => updateProfile('workAuthorizationStatus', event.target.value)}
                >
                  <option value="">Not specified</option>
                  {authorizationOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Sponsorship required now
                <select
                  value={profileFields.sponsorshipRequired}
                  onChange={(event) => updateProfile('sponsorshipRequired', event.target.value)}
                >
                  <option value="">Not specified</option>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </label>
              <label>
                Sponsorship required in the future
                <select
                  value={profileFields.futureSponsorshipRequired}
                  onChange={(event) => updateProfile('futureSponsorshipRequired', event.target.value)}
                >
                  <option value="">Not specified</option>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </label>
              <label>
                Notice period in days
                <input
                  max="365"
                  min="0"
                  type="number"
                  value={profileFields.noticePeriodDays}
                  onChange={(event) => updateProfile('noticePeriodDays', event.target.value)}
                  placeholder="0"
                />
                <small>Use 0 if you are available immediately.</small>
              </label>
              {profileFields.workAuthorizationStatus === 'other' && (
                <label className="agent-field-wide">
                  Authorization details
                  <input
                    value={profileFields.workAuthorizationDetails}
                    onChange={(event) => updateProfile('workAuthorizationDetails', event.target.value)}
                    placeholder="Describe your current authorization"
                  />
                </label>
              )}
              <label className="agent-field-wide">
                Skills
                <input
                  value={profileFields.skills}
                  onChange={(event) => updateProfile('skills', event.target.value)}
                  placeholder="React, JavaScript, SQL"
                />
                <small>These skills will support future application assistance.</small>
              </label>
            </div>
          </section>

          <section className="agent-panel">
            <div className="agent-panel-heading">
              <div>
                <p className="eyebrow">Professional links</p>
                <h2>Online presence</h2>
                <p>Saved for future assisted applications and always shown for review first.</p>
              </div>
            </div>
            <div className="agent-form-grid agent-links-grid">
              <label>
                LinkedIn
                <input
                  type="url"
                  value={profileFields.reusableAnswers.linkedinUrl || ''}
                  onChange={(event) => updateReusableAnswer('linkedinUrl', event.target.value)}
                  placeholder="https://linkedin.com/in/your-name"
                />
              </label>
              <label>
                GitHub
                <input
                  type="url"
                  value={profileFields.reusableAnswers.githubUrl || ''}
                  onChange={(event) => updateReusableAnswer('githubUrl', event.target.value)}
                  placeholder="https://github.com/your-name"
                />
              </label>
              <label>
                Portfolio website
                <input
                  type="url"
                  value={profileFields.reusableAnswers.portfolioUrl || ''}
                  onChange={(event) => updateReusableAnswer('portfolioUrl', event.target.value)}
                  placeholder="https://your-site.com"
                />
              </label>
              <label>
                Willing to relocate
                <select
                  value={profileFields.reusableAnswers.willingToRelocate || ''}
                  onChange={(event) => updateReusableAnswer('willingToRelocate', event.target.value)}
                >
                  <option value="">Not specified</option>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                  <option value="depends">Depends on the role</option>
                </select>
              </label>
            </div>
          </section>

          <section className="agent-panel agent-control-panel">
            <div>
              <p className="eyebrow">Control</p>
              <h2>Application profile</h2>
              <p>ApplyTrack imports your alerts and keeps this information ready for future assisted applications.</p>
            </div>
            <label className="agent-check-row">
              <input
                checked={profileFields.approved}
                type="checkbox"
                onChange={(event) => updateProfile('approved', event.target.checked)}
              />
              <span>I reviewed this profile and confirm the information is accurate.</span>
            </label>
          </section>

          <div className="agent-form-footer">
            <div>
              {success && <p className="form-success" role="status">{success}</p>}
              {error && <p className="form-error" role="alert">{error}</p>}
            </div>
            <button className="primary-action" disabled={isSaving} type="submit">
              <Save aria-hidden="true" size={18} />
              {isSaving ? 'Saving profile...' : 'Save profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default JobAgentSetup
