import assert from 'node:assert/strict'
import test from 'node:test'
import * as XLSX from 'xlsx'
import { parseExcelApplications } from './excelImport.js'
import { fromApplicationRow, toApplicationRow } from '../data/applicationRows.js'

function spreadsheetFile(rows, bookType = 'xlsx') {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Applications')
  const bytes = XLSX.write(workbook, { type: 'array', bookType })
  const arrayBuffer = bytes instanceof ArrayBuffer ? bytes : Uint8Array.from(bytes).buffer

  return {
    name: bookType === 'biff8' ? 'applications.xls' : 'applications.xlsx',
    size: arrayBuffer.byteLength,
    arrayBuffer: async () => arrayBuffer,
  }
}

test('parses .xlsx spreadsheets with alternate field names and dates', async () => {
  const file = spreadsheetFile([
    ['Employer', 'Job Title', 'Status', 'Applied Date', 'Notes'],
    ['Example Inc', 'Software Engineer', 'Interview', '2026-08-04', 'Phone screen'],
    ['Another Co', 'QA Engineer', 'Rejected', '2026-08-05', ''],
  ])

  const applications = await parseExcelApplications(file)

  assert.equal(applications.length, 2)
  assert.equal(applications[0].company, 'Example Inc')
  assert.equal(applications[0].role, 'Software Engineer')
  assert.equal(applications[0].status, 'Interview')
  assert.equal(applications[0].date, '2026-08-04')
  assert.equal(applications[0].notes, 'Phone screen')
  assert.equal(applications[1].status, 'Rejected')
})

test('preserves support for legacy .xls workbooks', async () => {
  const file = spreadsheetFile([
    ['Company', 'Role'],
    ['Old format Co', 'Developer'],
  ], 'biff8')

  const applications = await parseExcelApplications(file)

  assert.equal(applications.length, 1)
  assert.equal(applications[0].company, 'Old format Co')
})

test('RF-03: Excel notes retain labels and whitespace through the production row mappers', async () => {
  const notes = '  Cover letter: Yes\n\nReferral: No\nLast updated: interview pending  \n'
  for (const bookType of ['xlsx', 'biff8']) {
    const [parsed] = await parseExcelApplications(spreadsheetFile([
      ['Company', 'Role', 'Notes', 'Cover Letter', 'Referral', 'Last Updated', 'Interview Stage'],
      ['Synthetic', 'Engineer', notes, 'No', 'Yes', '2026-01-01', '2'],
    ], bookType))
    assert.equal(parsed.notes, `${notes}\nInterview stage: 2`)
    const mapped = fromApplicationRow(toApplicationRow(parsed, 'synthetic-user'))
    assert.equal(mapped.notes, parsed.notes)
    assert.equal(mapped.coverLetter, 'No')
    assert.equal(mapped.referral, 'Yes')
    assert.equal(mapped.lastUpdated, '2026-01-01')
    assert.equal(mapped.interviewCount, 2)
  }
})

test('requires recognizable company and role headers', async () => {
  const file = spreadsheetFile([
    ['Organization', 'Unrecognized position column'],
    ['Example Inc', 'Engineer'],
  ])

  await assert.rejects(
    parseExcelApplications(file),
    /must include Company and Role columns/,
  )
})

test('rejects unsupported extensions before attempting to parse', async () => {
  await assert.rejects(
    parseExcelApplications({ name: 'applications.csv', size: 10 }),
    /Choose an \.xlsx or \.xls spreadsheet/,
  )
})

test('rejects empty and oversized spreadsheets', async () => {
  for (const size of [0, 5 * 1024 * 1024 + 1]) {
    await assert.rejects(
      parseExcelApplications({ name: 'applications.xlsx', size }),
      /between 1 byte and 5 MB/,
    )
  }
})
