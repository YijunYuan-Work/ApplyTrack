import { Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  downloadExcelTemplate,
  parseExcelApplications,
} from '../utils/excelImport'

function getApplicationKey(application) {
  return [application.company, application.role, application.date]
    .map((value) => String(value || '').trim().toLowerCase())
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

function ExcelImportPanel({ applications = [], onImportApplications }) {
  const [fileName, setFileName] = useState('')
  const [parsedApplications, setParsedApplications] = useState([])
  const [selectedIndexes, setSelectedIndexes] = useState([])
  const [duplicateIndexes, setDuplicateIndexes] = useState(new Set())
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const selectedApplications = selectedIndexes.map(
    (index) => parsedApplications[index],
  )
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

  async function handleFileChange(event) {
    const file = event.target.files?.[0]

    setError('')
    setSuccessMessage('')
    setParsedApplications([])
    setSelectedIndexes([])
    setDuplicateIndexes(new Set())

    if (!file) {
      setFileName('')
      return
    }

    setFileName(file.name)
    setIsParsing(true)

    try {
      const importedApplications = await parseExcelApplications(file)
      const possibleDuplicates = findDuplicateIndexes(
        importedApplications,
        applications,
      )
      const recommendedSelections = importedApplications
        .map((_application, index) => index)
        .filter((index) => !possibleDuplicates.has(index))

      setParsedApplications(importedApplications)
      setDuplicateIndexes(possibleDuplicates)
      setSelectedIndexes(recommendedSelections)

      if (importedApplications.length === 0) {
        setError('No rows with both company and role were found.')
      }
    } catch {
      setError('Could not read this spreadsheet. Try an .xlsx or .xls file.')
    } finally {
      setIsParsing(false)
    }
  }

  async function handleImport() {
    if (selectedApplications.length === 0) {
      return
    }

    const selectedDuplicateCount = selectedIndexes.filter((index) =>
      duplicateIndexes.has(index),
    ).length
    const confirmationMessage = selectedDuplicateCount
      ? `Import ${selectedApplications.length} selected applications, including ${selectedDuplicateCount} possible duplicates?`
      : `Import ${selectedApplications.length} selected applications?`

    if (!window.confirm(confirmationMessage)) {
      return
    }

    setIsImporting(true)
    setError('')
    setSuccessMessage('')

    try {
      await onImportApplications(selectedApplications)
      setSuccessMessage(
        `${selectedApplications.length} applications imported successfully.`,
      )
      setFileName('')
      setParsedApplications([])
      setSelectedIndexes([])
      setDuplicateIndexes(new Set())
    } catch (importError) {
      setError(importError.message)
    } finally {
      setIsImporting(false)
    }
  }

  async function handleDownloadTemplate() {
    setError('')

    try {
      await downloadExcelTemplate()
    } catch {
      setError('Could not create the import template. Please try again.')
    }
  }

  function handleToggleApplication(index) {
    setSelectedIndexes((currentIndexes) =>
      currentIndexes.includes(index)
        ? currentIndexes.filter((currentIndex) => currentIndex !== index)
        : [...currentIndexes, index],
    )
  }

  function handleToggleRecommended() {
    setSelectedIndexes((currentIndexes) =>
      allRecommendedSelected
        ? currentIndexes.filter((index) => !recommendedIndexes.includes(index))
        : [...new Set([...currentIndexes, ...recommendedIndexes])],
    )
  }

  return (
    <section className="import-panel" aria-label="Import applications">
      <div className="import-copy">
        <div>
          <p className="eyebrow">Import</p>
          <h2>Upload your Excel tracker</h2>
          <p>
            Bring in existing rows from `.xlsx` or `.xls` files. Rows need at
            least a company and role.
          </p>
        </div>
        <button
          className="ghost-button import-template-button"
          type="button"
          onClick={handleDownloadTemplate}
        >
          <Download aria-hidden="true" size={18} />
          Download template
        </button>
      </div>

      <div className="import-controls">
        <label className="file-picker">
          Choose Excel file
          <input
            accept=".xlsx,.xls"
            type="file"
            disabled={isParsing || isImporting}
            onChange={handleFileChange}
          />
        </label>

        <button
          type="button"
          disabled={
            selectedApplications.length === 0 || isImporting || isParsing
          }
          onClick={handleImport}
        >
          {isImporting
            ? 'Importing...'
            : selectedApplications.length > 0
              ? `Import ${selectedApplications.length} applications`
              : 'Import applications'}
        </button>
      </div>

      <div className="import-summary" aria-live="polite">
        <span>{fileName || 'No file selected'}</span>
        <strong>
          {isParsing
            ? 'Reading spreadsheet...'
            : `${parsedApplications.length} applications found`}
        </strong>
        {duplicateIndexes.size > 0 && (
          <small>{duplicateIndexes.size} possible duplicates deselected</small>
        )}
      </div>

      {parsedApplications.length > 0 && (
        <div className="import-preview">
          <div className="import-preview-header">
            <div>
              <span>Preview</span>
              <strong>{selectedApplications.length} selected</strong>
            </div>
            <button
              className="ghost-button"
              type="button"
              disabled={recommendedIndexes.length === 0}
              onClick={handleToggleRecommended}
            >
              {allRecommendedSelected ? 'Clear recommended' : 'Select recommended'}
            </button>
          </div>

          <div className="import-preview-list">
            {parsedApplications.map((application, index) => (
              <label
                className={`import-preview-row ${
                  duplicateIndexes.has(index) ? 'import-preview-row-duplicate' : ''
                }`}
                key={`${application.company}-${application.role}-${index}`}
              >
                <input
                  checked={selectedIndexes.includes(index)}
                  type="checkbox"
                  onChange={() => handleToggleApplication(index)}
                />
                <span>{application.company}</span>
                <strong>{application.role}</strong>
                {duplicateIndexes.has(index) && (
                  <small>Possible duplicate</small>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {successMessage && (
        <p className="form-success" role="status">
          {successMessage}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

export default ExcelImportPanel
