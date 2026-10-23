import * as XLSX from 'xlsx'

export const userId = '00000000-0000-4000-8000-000000000001'

export function application(id, overrides = {}) {
  return { id, user_id: userId, company: `Synthetic ${id}`, role: 'Engineer', location: 'Toronto', status: 'Applied', applied_date: `2026-01-${String(id % 28 + 1).padStart(2, '0')}`, last_updated: '2026-01-01', rejected_date: null, updated_at: '2026-01-01T00:00:00.000Z', follow_up: null, job_url: 'https://example.invalid/job', notes: '', salary: '', contact: '', cover_letter: 'No', referral: 'No', interview_count: 0, ...overrides }
}

export function lead(id, overrides = {}) {
  return { id, user_id: userId, external_id: String(id), source: id % 2 ? 'linkedin' : 'indeed', state: 'new', company: `Lead ${id}`, title: 'Engineer', location: 'Toronto', description: 'Easy Apply', apply_url: `https://www.linkedin.com/jobs/view/${id}`, discovered_at: new Date(Date.UTC(2026, 0, 1, 0, id)).toISOString(), ...overrides }
}

export function spreadsheet(rows) {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Applications')
  return { name: 'synthetic.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) }
}
