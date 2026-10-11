import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'
import * as XLSX from 'xlsx'
import { normalizeApplication } from '../../src/data/applications.js'
import { getJobLeadPresentation } from '../../src/data/jobAgent.js'
import { parseExcelApplications } from '../../src/utils/excelImport.js'

export function workbookFile(rows, extraRows) {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Applications')
  if (extraRows) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(extraRows), 'Ignored')
  const bytes = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })
  return { name: 'audit.xlsx', size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }
}

test('API mapper characterization: legitimate note labels are stripped and null notes crash', async () => {
  const server = await createServer({
    server: { middlewareMode: true }, appType: 'custom',
    plugins: [{ name: 'audit-no-backend', enforce: 'pre', resolveId(id) { if (id.endsWith('/lib/supabase')) return '\0audit-supabase' }, load(id) { if (id === '\0audit-supabase') return 'export const supabase = null' } }],
  })
  try {
    const { fromApplicationRow } = await server.ssrLoadModule('/src/api/applications.js')
    const row = { id: 1, company: 'Synthetic', role: 'Engineer', notes: 'Cover letter: Yes\nReferral: No\nLast updated: interview pending\nKeep this', cover_letter: 'No', referral: 'Yes', last_updated: '2026-01-01' }
    assert.equal(fromApplicationRow(row).notes, 'Keep this')
    assert.throws(() => fromApplicationRow({ ...row, notes: null }), TypeError)
  } finally { await server.close() }
})

test('Excel first sheet, alias mapping, dates, skipped incomplete rows and unknown columns', async () => {
  const rows = await parseExcelApplications(workbookFile([
    ['Employer', 'Job Title', 'Applied Date', 'Follow-up', 'Salary', 'Contact', 'Mystery'],
    ['Synthetic A', 'Engineer', '2026-12-31', '2027-01-02', '90000', 'Recruiter', 'ignored'],
    ['', 'Incomplete', '', '', '', '', ''],
  ], [['Company', 'Role'], ['Must not import', 'Other']]))
  assert.equal(rows.length, 1)
  assert.equal(rows[0].date, '2026-12-31')
  assert.equal(rows[0].followUp, '2027-01-02')
  assert.equal(rows[0].salary, '90000')
  assert.equal(rows[0].contact, 'Recruiter')
  assert.equal(rows[0].company, 'Synthetic A')
})

test('Excel characterization: interview status without stage has zero rounds; unknown status falls back', async () => {
  const rows = await parseExcelApplications(workbookFile([
    ['Company', 'Role', 'Status', 'Interview Stage', 'Applied Date'],
    ['Interview fixture', 'Engineer', 'Interview', '', 'not a date'],
    ['Unknown fixture', 'Engineer', 'Unrecognized', '2nd round', 46022],
  ]))
  assert.equal(rows[0].interviewCount, 0)
  assert.equal(rows[0].date, '')
  assert.equal(rows[1].status, 'Interview')
  assert.equal(rows[1].interviewCount, 2)
})

test('Excel errors: missing headers, random binary, empty worksheet', async () => {
  await assert.rejects(parseExcelApplications(workbookFile([['Mystery'], ['Value']])), /Company and Role/)
  assert.deepEqual(await parseExcelApplications(workbookFile([])), [])
  const bytes = new Uint8Array([0, 255, 0, 254, 0, 253])
  await assert.rejects(parseExcelApplications({ name: 'bad.xlsx', size: bytes.length, arrayBuffer: async () => bytes.buffer }))
})

test('Normalization characterization: non-finite counts survive; invalid status defaults to Applied', () => {
  assert.equal(normalizeApplication({ interviewCount: Infinity }).interviewCount, Infinity)
  assert.equal(normalizeApplication({ interviewCount: -2 }).interviewCount, 0)
  assert.equal(normalizeApplication({ interviewCount: 'nonsense' }).interviewCount, 0)
  assert.equal(normalizeApplication({ status: 'arbitrary' }).status, 'Applied')
})

test('Job presentation: optional salary, deduplicated chips, annual and hourly salaries', () => {
  assert.equal(getJobLeadPresentation({ description: '' }).salaryLabel, null)
  const annual = getJobLeadPresentation({ description: 'Remote | $90,000 - $120,000 a year | Easily apply | Easy Apply | 1 company alum' })
  assert.deepEqual(annual.highlights, ['1 company alum', 'Easy Apply', 'Remote'])
  assert.match(annual.salaryLabel, /90,000.*120,000/)
  assert.match(getJobLeadPresentation({ description: '$40 per hour' }).salaryLabel, /40 per hour/)
})

test('Job salary characterization: shorthand $90k is interpreted as $90', () => {
  const result = getJobLeadPresentation({ description: '$90k - $120k a year' })
  assert.match(result.salaryLabel, /90/)
  assert.doesNotMatch(result.salaryLabel, /90,000/)
})
