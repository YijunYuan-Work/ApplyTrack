import { useState } from 'react'
import { parseExcelApplications } from '../utils/excelImport'

function ExcelImportPanel({ onImportApplications }) {
  const [fileName, setFileName] = useState('')
  const [parsedApplications, setParsedApplications] = useState([])
  const [selectedIndexes, setSelectedIndexes] = useState([])
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const selectedApplications = selectedIndexes.map(
    (index) => parsedApplications[index],
  )
  const allSelected =
    parsedApplications.length > 0 &&
    selectedIndexes.length === parsedApplications.length

  async function handleFileChange(event) {
    const file = event.target.files?.[0]

    setError('')
    setSuccessMessage('')
    setParsedApplications([])
    setSelectedIndexes([])

    if (!file) {
      setFileName('')
      return
    }

    setFileName(file.name)
    setIsParsing(true)

    try {
      const applications = await parseExcelApplications(file)
      setParsedApplications(applications)
      setSelectedIndexes(applications.map((_application, index) => index))

      if (applications.length === 0) {
        setError('No rows with both company and role were found.')
      }
    } catch {
      setError('Could not read this spreadsheet. Try an .xlsx file.')
    } finally {
      setIsParsing(false)
    }
  }

  async function handleImport() {
    if (selectedApplications.length === 0) {
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
    } catch (importError) {
      setError(importError.message)
    } finally {
      setIsImporting(false)
    }
  }

  function handleToggleApplication(index) {
    setSelectedIndexes((currentIndexes) =>
      currentIndexes.includes(index)
        ? currentIndexes.filter((currentIndex) => currentIndex !== index)
        : [...currentIndexes, index],
    )
  }

  function handleToggleAll() {
    setSelectedIndexes(
      allSelected ? [] : parsedApplications.map((_application, index) => index),
    )
  }

  return (
    <section className="import-panel" aria-label="Import applications">
      <div className="import-copy">
        <p className="eyebrow">Import</p>
        <h2>Upload your Excel tracker</h2>
        <p>
          Bring in existing rows from `.xlsx` files. Rows need at least a company
          and role.
        </p>
      </div>

      <div className="import-controls">
        <label className="file-picker">
          Choose Excel file
          <input accept=".xlsx,.xls" type="file" onChange={handleFileChange} />
        </label>

        <button
          type="button"
          disabled={selectedApplications.length === 0 || isImporting}
          onClick={handleImport}
        >
          {isImporting
            ? 'Importing...'
            : selectedApplications.length > 0
              ? `Import ${selectedApplications.length} applications`
              : 'Import applications'}
        </button>
      </div>

      <div className="import-summary">
        <span>{fileName || 'No file selected'}</span>
        <strong>
          {isParsing ? 'Reading...' : `${parsedApplications.length} applications found`}
        </strong>
      </div>

      {parsedApplications.length > 0 && (
        <div className="import-preview">
          <div className="import-preview-header">
            <div>
              <span>Preview</span>
              <strong>{selectedApplications.length} selected</strong>
            </div>
            <button className="ghost-button" type="button" onClick={handleToggleAll}>
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
          </div>

          <div className="import-preview-list">
            {parsedApplications.map((application, index) => (
              <label className="import-preview-row" key={`${application.company}-${application.role}-${index}`}>
                <input
                  checked={selectedIndexes.includes(index)}
                  type="checkbox"
                  onChange={() => handleToggleApplication(index)}
                />
                <span>{application.company}</span>
                <strong>{application.role}</strong>
              </label>
            ))}
          </div>
        </div>
      )}

      {successMessage && <p className="form-success">{successMessage}</p>}
      {error && <p className="form-error">{error}</p>}
    </section>
  )
}

export default ExcelImportPanel
