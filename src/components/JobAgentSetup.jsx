import { useMemo, useRef, useState } from 'react'
import {
  Check,
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
  employmentTypeOptions,
  emptyJobAgentProfile,
  emptyJobSearch,
  formatList,
  parseList,
  seniorityOptions,
  workArrangementOptions,
  workAuthorizationOptions,
} from '../data/jobAgent'
import {
  AddressSearchInput,
  PreferredLocationInput,
} from './LocationInputs'
import JobAlertConnection from './JobAlertConnection'
import TagInput from './TagInput'

function ToggleGroup({ ariaLabel, onChange, options, values }) {
  function toggle(value) {
    onChange(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    )
  }

  return (
    <div className="agent-toggle-group" aria-label={ariaLabel} role="group">
      {options.map((option) => {
        const selected = values.includes(option.value)

        return (
          <button
            aria-pressed={selected}
            className={selected ? 'selected' : ''}
            key={option.value}
            type="button"
            onClick={() => toggle(option.value)}
          >
            {selected && <Check aria-hidden="true" size={16} />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function PreferenceRow({ children, description, title }) {
  return (
    <div className="agent-preference-row">
      <div className="agent-preference-copy">
        <strong>{title}</strong>
        {description && <span>{description}</span>}
      </div>
      <div className="agent-preference-control">{children}</div>
    </div>
  )
}

function JobAgentSetup({
  inbox,
  initialProfile,
  initialSearch,
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
  const search = initialSearch || emptyJobSearch
  const [profileFields, setProfileFields] = useState({
    ...profile,
    reusableAnswers: { ...(profile.reusableAnswers || {}) },
    skills: formatList(profile.skills),
  })
  const [searchFields, setSearchFields] = useState({
    ...search,
    employmentTypes: [...(search.employmentTypes || [])],
    excludedCompanies: [...(search.excludedCompanies || [])],
    excludedKeywords: [...(search.excludedKeywords || [])],
    keywords: [...(search.keywords || [])],
    locations: [...(search.locations || [])],
    seniorityLevels: [...(search.seniorityLevels || [])],
    titles: [...(search.titles || [])],
    workArrangements:
      search.workArrangements?.length > 0
        ? [...search.workArrangements]
        : [...emptyJobSearch.workArrangements],
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
      {
        complete: searchFields.titles.length > 0,
        label: 'At least one target title',
      },
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
    [inbox?.enabled, messages.length, primaryResume, profileFields.approved, searchFields.titles.length],
  )

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  function updateProfile(field, value) {
    setProfileFields((current) => ({ ...current, [field]: value }))
    clearMessages()
  }

  function updateSearch(field, value) {
    setSearchFields((current) => ({ ...current, [field]: value }))
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

  function handleSearchCountryChange(countryCode) {
    const country = countryOptions.find((item) => item.code === countryCode)
    setSearchFields((current) => ({
      ...current,
      countryCode,
      salaryCurrency: country?.currency || current.salaryCurrency,
    }))
    clearMessages()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    clearMessages()
    const enablingDiscovery = profileFields.enabled || searchFields.enabled
    const salaryMin = searchFields.salaryMin === '' ? null : Number(searchFields.salaryMin)
    const salaryMax = searchFields.salaryMax === '' ? null : Number(searchFields.salaryMax)

    if (!profileFields.firstName.trim() || !profileFields.lastName.trim()) {
      setError('Add your first and last name before saving.')
      return
    }

    if (searchFields.titles.length === 0) {
      setError('Add at least one target job title.')
      return
    }

    if (searchFields.workArrangements.length === 0) {
      setError('Choose at least one work arrangement.')
      return
    }

    if (salaryMin !== null && salaryMax !== null && salaryMax < salaryMin) {
      setError('Maximum salary must be greater than or equal to minimum salary.')
      return
    }

    if (enablingDiscovery && !primaryResume) {
      setError('Upload a resume before enabling alert matching.')
      return
    }

    if (enablingDiscovery && !profileFields.approved) {
      setError('Review and approve your profile before enabling alert matching.')
      return
    }

    try {
      await onSave(
        {
          ...profileFields,
          enabled: enablingDiscovery,
          reusableAnswers: profileFields.reusableAnswers || {},
          skills: parseList(profileFields.skills),
        },
        {
          ...searchFields,
          enabled: enablingDiscovery,
        },
      )
      setProfileFields((current) => ({ ...current, enabled: enablingDiscovery }))
      setSearchFields((current) => ({ ...current, enabled: enablingDiscovery }))
      setSuccess('Job Agent settings saved.')
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
      setSuccess('Resume uploaded and ready for matching.')
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
      setProfileFields((current) => ({ ...current, enabled: false }))
      setSearchFields((current) => ({ ...current, enabled: false }))
      setSuccess('Resume removed. Discovery has been paused.')
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
          <h2>Before the first alert</h2>
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
              <span>Upload your resume to improve job match scores.</span>
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
                <small>These skills contribute to job-match scores.</small>
              </label>
            </div>
          </section>

          <section className="agent-panel">
            <div className="agent-panel-heading">
              <div>
                <p className="eyebrow">Search goals</p>
                <h2>Targeting preferences</h2>
                <p>Choose the roles and working conditions that fit your search.</p>
              </div>
            </div>
            <div className="agent-preference-list">
              <PreferenceRow
                description="Add every title you want included in matching."
                title="Target roles"
              >
                <TagInput
                  ariaLabel="Target roles"
                  placeholder="Add another role"
                  values={searchFields.titles}
                  onChange={(values) => updateSearch('titles', values)}
                />
              </PreferenceRow>
              <PreferenceRow
                description="Select locations and acceptable work arrangements."
                title="Preferred locations"
              >
                <PreferredLocationInput
                  countryCode={searchFields.countryCode}
                  values={searchFields.locations}
                  onChange={(values) => updateSearch('locations', values)}
                />
                <ToggleGroup
                  ariaLabel="Work arrangements"
                  options={workArrangementOptions}
                  values={searchFields.workArrangements}
                  onChange={(values) => updateSearch('workArrangements', values)}
                />
              </PreferenceRow>
              <PreferenceRow title="Seniority level">
                <ToggleGroup
                  ariaLabel="Seniority levels"
                  options={seniorityOptions}
                  values={searchFields.seniorityLevels}
                  onChange={(values) => updateSearch('seniorityLevels', values)}
                />
              </PreferenceRow>
              <PreferenceRow title="Employment type">
                <ToggleGroup
                  ariaLabel="Employment types"
                  options={employmentTypeOptions}
                  values={searchFields.employmentTypes}
                  onChange={(values) => updateSearch('employmentTypes', values)}
                />
              </PreferenceRow>
            </div>
          </section>

          <section className="agent-panel">
            <div className="agent-panel-heading">
              <div>
                <p className="eyebrow">Compensation</p>
                <h2>Expected salary range</h2>
                <p>The minimum can filter low-paying roles. The maximum is treated as a preference.</p>
              </div>
            </div>
            <div className="agent-compensation-grid">
              <label>
                Minimum annual salary
                <input
                  min="0"
                  step="1000"
                  type="number"
                  value={searchFields.salaryMin}
                  onChange={(event) => updateSearch('salaryMin', event.target.value)}
                  placeholder="60000"
                />
              </label>
              <label>
                Desired maximum
                <input
                  min="0"
                  step="1000"
                  type="number"
                  value={searchFields.salaryMax}
                  onChange={(event) => updateSearch('salaryMax', event.target.value)}
                  placeholder="100000"
                />
              </label>
              <label>
                Currency
                <select
                  value={searchFields.salaryCurrency}
                  onChange={(event) => updateSearch('salaryCurrency', event.target.value)}
                >
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="AUD">AUD</option>
                </select>
              </label>
              <label>
                Job market
                <select
                  value={searchFields.countryCode}
                  onChange={(event) => handleSearchCountryChange(event.target.value)}
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

          <details className="agent-panel agent-advanced-panel">
            <summary>Advanced search preferences</summary>
            <div className="agent-preference-list">
              <PreferenceRow title="Priority keywords">
                <TagInput
                  ariaLabel="Priority keywords"
                  placeholder="Add a skill or keyword"
                  values={searchFields.keywords}
                  onChange={(values) => updateSearch('keywords', values)}
                />
              </PreferenceRow>
              <PreferenceRow title="Excluded companies">
                <TagInput
                  ariaLabel="Excluded companies"
                  placeholder="Add a company to skip"
                  values={searchFields.excludedCompanies}
                  onChange={(values) => updateSearch('excludedCompanies', values)}
                />
              </PreferenceRow>
              <PreferenceRow title="Excluded keywords">
                <TagInput
                  ariaLabel="Excluded keywords"
                  placeholder="Add a keyword to exclude"
                  values={searchFields.excludedKeywords}
                  onChange={(values) => updateSearch('excludedKeywords', values)}
                />
              </PreferenceRow>
              <PreferenceRow title="Additional approved context">
                <textarea
                  value={profileFields.reusableAnswers.additionalContext || ''}
                  onChange={(event) => updateReusableAnswer('additionalContext', event.target.value)}
                  placeholder="Optional facts for future application review"
                />
              </PreferenceRow>
            </div>
          </details>

          <section className="agent-panel agent-control-panel">
            <div>
              <p className="eyebrow">Control</p>
              <h2>Review before apply</h2>
              <p>ApplyTrack imports and ranks alert jobs. It does not submit applications.</p>
            </div>
            <label className="agent-check-row">
              <input
                checked={profileFields.approved}
                type="checkbox"
                onChange={(event) => updateProfile('approved', event.target.checked)}
              />
              <span>I reviewed this profile and confirm the information is accurate.</span>
            </label>
            <label className="agent-check-row">
              <input
                checked={profileFields.enabled || searchFields.enabled}
                type="checkbox"
                onChange={(event) => {
                  updateProfile('enabled', event.target.checked)
                  updateSearch('enabled', event.target.checked)
                }}
              />
              <span>Enable matching for incoming job alerts.</span>
            </label>
          </section>

          <div className="agent-form-footer">
            <div>
              {success && <p className="form-success" role="status">{success}</p>}
              {error && <p className="form-error" role="alert">{error}</p>}
            </div>
            <button className="primary-action" disabled={isSaving} type="submit">
              <Save aria-hidden="true" size={18} />
              {isSaving ? 'Saving settings...' : 'Save Job Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default JobAgentSetup
