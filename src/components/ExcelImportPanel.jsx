import {
  CalendarDays,
  Check,
  Download,
  FileSpreadsheet,
  Info,
  LoaderCircle,
  MapPin,
  Upload,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { downloadExcelTemplate, parseExcelApplications } from '../utils/excelImport'
import ImportConfirmation from './ImportConfirmation'
import '../styles/import.css'

function getApplicationKey(application) {
  return [application.company, application.role, application.date]
    .map((value) =>
      String(value || '')
        .trim()
        .toLowerCase(),
    )
    .join('|')
}

function findDuplicateIndexes(applications, existingApplications) {
  const seenKeys = new Set(existingApplications.map(getApplicationKey))
  const duplicateIndexes = new Set()

  applications.forEach((application, index) => {
    const key = getApplicationKey(application)

    if (seenKeys.has(key)) {
      duplicateIndexes.add(index)
    } else {
      seenKeys.add(key)
    }
  })

  return duplicateIndexes
}

const columns = [
  'Company',
  'Role',
  'Location',
  'Status',
  'Applied Date',
  'Follow Up',
  'Job Link',
  'Contact',
  'Salary',
  'Cover Letter',
  'Referral',
  'Interview Stage',
  'Last Updated',
  'Rejected Date',
  'Notes',
]

function ExcelImportPanel({ applications = [], demoRows = [], onImportApplications, onDashboard }) {
  const [fileName, setFileName] = useState('')
  const [parsedApplications, setParsedApplications] = useState([])
  const [selectedIndexes, setSelectedIndexes] = useState([])
  const [duplicateIndexes, setDuplicateIndexes] = useState(new Set())
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [confirmation, setConfirmation] = useState(null)
  const active = useRef(true)
  const busy = useRef(false)
  const dragDepth = useRef(0)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const selectedApplications = selectedIndexes.map((index) => parsedApplications[index])
  const selectedDuplicateCount = selectedIndexes.filter((index) =>
    duplicateIndexes.has(index),
  ).length
  const recommendedIndexes = useMemo(
    () =>
      parsedApplications
        .map((_application, index) => index)
        .filter((index) => !duplicateIndexes.has(index)),
    [duplicateIndexes, parsedApplications],
  )
  const allRecommendedSelected =
    recommendedIndexes.length > 0 &&
    recommendedIndexes.every((index) => selectedIndexes.includes(index))
  const pending = isParsing || isImporting

  function loadApplications(importedApplications, nextFileName) {
    const possibleDuplicates = findDuplicateIndexes(importedApplications, applications)
    setFileName(nextFileName)
    setParsedApplications(importedApplications)
    setDuplicateIndexes(possibleDuplicates)
    setSelectedIndexes(
      importedApplications
        .map((_application, index) => index)
        .filter((index) => !possibleDuplicates.has(index)),
    )
    if (importedApplications.length === 0)
      setError('No rows with both company and role were found.')
  }

  async function readFile(file) {
    if (busy.current) return
    setError('')
    setSuccessMessage('')
    setParsedApplications([])
    setSelectedIndexes([])
    setDuplicateIndexes(new Set())
    if (!file) {
      setFileName('')
      return
    }
    busy.current = true
    setFileName(file.name)
    setIsParsing(true)
    try {
      const importedApplications = await parseExcelApplications(file)
      if (active.current) loadApplications(importedApplications, file.name)
    } catch (parseError) {
      const expectedMessages = [
        'Choose an .xlsx or .xls spreadsheet.',
        'Spreadsheets must be between 1 byte and 5 MB.',
        'The spreadsheet must include Company and Role columns.',
      ]
      if (active.current)
        setError(
          expectedMessages.includes(parseError?.message)
            ? parseError.message
            : 'Could not read this spreadsheet. Try an .xlsx or .xls file.',
        )
    } finally {
      busy.current = false
      if (active.current) setIsParsing(false)
    }
  }

  function handleLoadDemoRows() {
    if (busy.current) return
    setError('')
    setSuccessMessage('')
    loadApplications(
      demoRows.map((application) => ({ ...application })),
      'ApplyTrack-sample.xlsx',
    )
  }

  async function handleImport() {
    if (busy.current || !confirmation?.items.length) return
    const items = confirmation.items
    busy.current = true
    setConfirmation(null)
    setIsImporting(true)
    setError('')
    setSuccessMessage('')
    try {
      await onImportApplications(items)
      if (!active.current) return
      setSuccessMessage(
        `${items.length} ${items.length === 1 ? 'application' : 'applications'} imported successfully.`,
      )
      setFileName('')
      setParsedApplications([])
      setSelectedIndexes([])
      setDuplicateIndexes(new Set())
    } catch (importError) {
      if (active.current)
        setError(
          importError.message ||
            'Could not confirm the import. Check your dashboard before retrying.',
        )
    } finally {
      busy.current = false
      if (active.current) setIsImporting(false)
    }
  }

  async function handleDownloadTemplate() {
    setError('')
    try {
      await downloadExcelTemplate()
    } catch {
      if (active.current) setError('Could not create the import template. Please try again.')
    }
  }

  function handleToggleApplication(index) {
    if (busy.current) return
    setSelectedIndexes((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    )
  }

  function handleToggleRecommended() {
    if (busy.current) return
    setSelectedIndexes((current) =>
      allRecommendedSelected
        ? current.filter((index) => !recommendedIndexes.includes(index))
        : [...new Set([...current, ...recommendedIndexes])],
    )
  }

  const picker = (
    <label
      className={`import-file-picker ui-button ${parsedApplications.length ? 'ui-button-ghost' : 'ui-button-primary'}`}
    >
      {!parsedApplications.length && <Upload aria-hidden="true" size={18} />}
      {parsedApplications.length ? 'Choose another file' : 'Choose Excel file'}
      <input
        accept=".xlsx,.xls"
        type="file"
        disabled={pending}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          readFile(file)
        }}
      />
    </label>
  )

  return (
    <section className="import-page" aria-label="Import applications">
      <header className="import-page-header">
        <div>
          <p className="eyebrow">Import Excel</p>
          <h1>Bring in your existing tracker.</h1>
          <p>Upload a spreadsheet and add its rows to your application list.</p>
        </div>
        <button
          className="ui-button ui-button-ghost import-template-button"
          disabled={pending}
          type="button"
          onClick={handleDownloadTemplate}
        >
          <Download aria-hidden="true" size={18} />
          Download template
        </button>
      </header>
      {successMessage && (
        <div className="import-success" role="status">
          <Check aria-hidden="true" size={20} />
          <div>
            <strong>{successMessage}</strong>
            <p>They're now on your dashboard.</p>
          </div>
          {onDashboard && (
            <button type="button" className="ui-button ui-button-ghost" onClick={onDashboard}>
              View dashboard
            </button>
          )}
        </div>
      )}
      {error && (
        <p className="import-error" role="alert">
          <Info aria-hidden="true" size={20} />
          {error}
        </p>
      )}
      <div className="import-layout">
        <div className="import-main">
          {!parsedApplications.length ? (
            <section
              className={`import-drop-zone ${dragging ? 'dragging' : ''}`}
              aria-label="Upload spreadsheet"
              onDragEnter={(event) => {
                event.preventDefault()
                dragDepth.current++
                if (!busy.current) setDragging(true)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = busy.current ? 'none' : 'copy'
              }}
              onDragLeave={(event) => {
                event.preventDefault()
                dragDepth.current--
                if (dragDepth.current <= 0) setDragging(false)
              }}
              onDrop={(event) => {
                event.preventDefault()
                dragDepth.current = 0
                setDragging(false)
                if (!busy.current) readFile(event.dataTransfer.files?.[0])
              }}
            >
              <span className="import-upload-icon">
                {isParsing ? (
                  <LoaderCircle aria-hidden="true" className="import-spinner" size={24} />
                ) : (
                  <FileSpreadsheet aria-hidden="true" size={24} />
                )}
              </span>
              <div>
                <h2>
                  {isParsing ? (
                    'Reading spreadsheet...'
                  ) : dragging ? (
                    'Drop to preview'
                  ) : (
                    <>
                      <span className="import-desktop-copy">Drop your Excel tracker here</span>
                      <span className="import-mobile-copy">Choose your Excel tracker</span>
                    </>
                  )}
                </h2>
                <p>{isParsing ? fileName : "You'll review every row before anything is saved."}</p>
              </div>
              <div className="import-picker-actions">
                {picker}
                {demoRows.length > 0 && (
                  <button
                    className="ui-button ui-button-ghost"
                    type="button"
                    disabled={pending}
                    onClick={handleLoadDemoRows}
                  >
                    Preview sample file
                  </button>
                )}
              </div>
              <div className="import-file-hints">
                <span>.xlsx or .xls</span>
                <span>Up to 5 MB</span>
                <span>First sheet only</span>
              </div>
              {isParsing && (
                <p role="status" className="visually-hidden">
                  Reading spreadsheet...
                </p>
              )}
            </section>
          ) : (
            <section className="import-preview" aria-label="Preview">
              <header className="import-preview-file">
                <span className="import-icon">
                  <FileSpreadsheet aria-hidden="true" size={20} />
                </span>
                <div className="import-file-name">
                  <strong title={fileName}>{fileName}</strong>
                  <span>
                    {parsedApplications.length}{' '}
                    {parsedApplications.length === 1 ? 'application' : 'applications'} found
                  </span>
                </div>
                {picker}
              </header>
              {duplicateIndexes.size > 0 && (
                <p className="import-duplicate-notice">
                  <Info aria-hidden="true" size={18} />
                  <span>
                    <strong>
                      {duplicateIndexes.size} possible{' '}
                      {duplicateIndexes.size === 1 ? 'duplicate' : 'duplicates'}.
                    </strong>{' '}
                    Match by company, role and applied date, including earlier rows in this file.
                    Select them only if you want a second copy.
                  </span>
                </p>
              )}
              <div className="import-preview-header">
                <div>
                  <span>Preview</span>
                  <strong>
                    {selectedApplications.length} of {parsedApplications.length} selected
                  </strong>
                </div>
                <button
                  className="ui-button ui-button-ghost"
                  disabled={pending || recommendedIndexes.length === 0}
                  type="button"
                  onClick={handleToggleRecommended}
                >
                  {allRecommendedSelected ? 'Clear recommended' : 'Select recommended'}
                </button>
              </div>
              <div className="import-table-wrap">
                <table className="import-table" aria-label="Spreadsheet rows">
                  <thead>
                    <tr>
                      <th>
                        <span className="visually-hidden">Selection</span>
                      </th>
                      <th>Company</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Applied</th>
                      <th className="import-location">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedApplications.map((application, index) => (
                      <tr
                        key={index}
                        className={`import-preview-row ${selectedIndexes.includes(index) ? 'selected' : ''}`}
                        style={{ '--row-delay': `${Math.min(index, 10) * 35}ms` }}
                      >
                        <td className="import-selection">
                          <label className="import-selection-control">
                            <input
                              checked={selectedIndexes.includes(index)}
                              type="checkbox"
                              disabled={pending}
                              onChange={() => handleToggleApplication(index)}
                              aria-label={`Select ${application.company}, ${application.role}${duplicateIndexes.has(index) ? ' (possible duplicate)' : ''}`}
                            />
                          </label>
                        </td>
                        <td className="import-company">
                          <strong>{application.company}</strong>
                          {duplicateIndexes.has(index) && (
                            <small>
                              <span>Possible duplicate</span>
                            </small>
                          )}
                        </td>
                        <td className="import-role">{application.role}</td>
                        <td className="import-status">
                          <span
                            className={`import-status-chip status-${application.status.toLowerCase()}`}
                          >
                            {application.status}
                          </span>
                        </td>
                        <td className="import-date">
                          <CalendarDays className="import-meta-icon" aria-hidden="true" size={14} />
                          <span>{application.date || 'Not set'}</span>
                        </td>
                        <td className="import-location">
                          <MapPin className="import-meta-icon" aria-hidden="true" size={14} />
                          <span>{application.location || 'Not listed'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className="import-actions">
                <span>
                  {isImporting
                    ? 'Saving to your workspace...'
                    : selectedApplications.length === 0
                      ? 'Select at least one row to import.'
                      : selectedDuplicateCount
                        ? `${selectedDuplicateCount} possible ${selectedDuplicateCount === 1 ? 'duplicate' : 'duplicates'} included.`
                        : 'Duplicates are left out by default.'}
                </span>
                <button
                  className="ui-button ui-button-add"
                  type="button"
                  disabled={pending || !selectedApplications.length}
                  aria-busy={isImporting}
                  onClick={(event) => {
                    if (!busy.current && selectedApplications.length) {
                      // Safari does not focus pointer-activated buttons by default.
                      event.currentTarget.focus({ preventScroll: true })
                      setConfirmation({
                        items: [...selectedApplications],
                        duplicates: selectedDuplicateCount,
                      })
                    }
                  }}
                >
                  {isImporting && (
                    <LoaderCircle aria-hidden="true" className="import-spinner" size={18} />
                  )}
                  {isImporting
                    ? 'Importing...'
                    : `Import ${selectedApplications.length} ${selectedApplications.length === 1 ? 'application' : 'applications'}`}
                </button>
              </footer>
              {isImporting && (
                <p role="status" className="visually-hidden">
                  Importing selected applications...
                </p>
              )}
            </section>
          )}
        </div>
        <aside className="import-column-guide">
          <div>
            <p className="eyebrow">Columns</p>
            <h2>What ApplyTrack reads</h2>
            <p>
              Rows need at least a company and role. Rows missing either are skipped. Unrecognised
              columns are ignored.
            </p>
          </div>
          <div className="import-column-chips">
            {columns.map((column, index) => (
              <span className={index < 2 ? 'required-column' : ''} key={column}>
                {column}
              </span>
            ))}
          </div>
          <ul>
            <li>
              <Check aria-hidden="true" size={15} />
              Status text with "interview", "offer" or "reject" maps to that stage. Anything else
              becomes Applied.
            </li>
            <li>
              <Check aria-hidden="true" size={15} />
              Interview Stage is added to notes.
            </li>
            <li>
              <Check aria-hidden="true" size={15} />
              Nothing is saved until you confirm.
            </li>
          </ul>
        </aside>
      </div>
      {confirmation && (
        <ImportConfirmation
          count={confirmation.items.length}
          duplicateCount={confirmation.duplicates}
          onCancel={() => setConfirmation(null)}
          onConfirm={handleImport}
        />
      )}
    </section>
  )
}

export default ExcelImportPanel
