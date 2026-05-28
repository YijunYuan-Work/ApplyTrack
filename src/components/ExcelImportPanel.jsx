import { useState } from 'react'
import { parseExcelApplications } from '../utils/excelImport'

function ExcelImportPanel({ onImportApplications }) {
  const [fileName, setFileName] = useState('')
  const [parsedApplications, setParsedApplications] = useState([])
  const [error, setError] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  async function handleFileChange(event) {
    const file = event.target.files?.[0]

    setError('')
    setParsedApplications([])

    if (!file) {
      setFileName('')
      return
    }

    setFileName(file.name)
    setIsParsing(true)

    try {
      const applications = await parseExcelApplications(file)
      setParsedApplications(applications)

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
    if (parsedApplications.length === 0) {
      return
    }

    setIsImporting(true)
    setError('')

    try {
      await onImportApplications(parsedApplications)
      setFileName('')
      setParsedApplications([])
    } catch (importError) {
      setError(importError.message)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <section className="import-panel" aria-label="Import applications">
      <div>
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

        <div className="import-summary">
          <span>{fileName || 'No file selected'}</span>
          <strong>
            {isParsing
              ? 'Reading...'
              : `${parsedApplications.length} applications ready`}
          </strong>
        </div>

        <button
          type="button"
          disabled={parsedApplications.length === 0 || isImporting}
          onClick={handleImport}
        >
          {isImporting ? 'Importing...' : 'Import applications'}
        </button>
      </div>

      {parsedApplications.length > 0 && (
        <div className="import-preview">
          <span>Preview</span>
          <p>
            {parsedApplications[0].company} - {parsedApplications[0].role}
          </p>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
    </section>
  )
}

export default ExcelImportPanel
