import assert from 'node:assert/strict'
import test from 'node:test'
import { fromApplicationRow, toApplicationRow, toApplicationStatusRow } from './applicationRows.js'
import { getRejectionDate, normalizeApplication, normalizeRejectedDate } from './applications.js'
import { applicationFormChanges, mergeApplicationFormChanges, prepareApplicationForm, validateApplicationForm } from './applicationForm.js'

test('Application rows: required fields validate trimmed values without changing literal notes', () => {
  assert.deepEqual(validateApplicationForm({ company: ' \t ', role: ' \n ' }), {
    company: 'Enter a company name.', role: 'Enter a role name.',
  })
  const input = normalizeApplication({ company: '  Acme  ', role: '  Engineer  ', salary: '  90000 ', notes: ' \r\nReferral: No  ' })
  assert.deepEqual(validateApplicationForm(input), {})
  const prepared = prepareApplicationForm(input)
  assert.equal(prepared.company, 'Acme')
  assert.equal(prepared.role, 'Engineer')
  assert.equal(prepared.salary, '90000')
  assert.equal(prepared.notes, input.notes)
  assert.equal(prepared.location, 'Not specified')
})

test('Application rows: edit intent excludes unchanged status/rounds and optional fields', () => {
  const initial = fromApplicationRow({ ...baseRow, notes: 'Original', salary: '90000' })
  const prepared = prepareApplicationForm({ ...initial, notes: 'Edited note', salary: ' 100000 ' }, initial.id)
  assert.deepEqual(applicationFormChanges(prepared, initial), {
    notes: 'Edited note', salary: '100000', lastUpdated: prepared.lastUpdated,
  })
})

test('Application rows: explicit form status/count edits retain the Interview promotion business rule', () => {
  const initial = normalizeApplication({ id: 1, company: 'Acme', role: 'Engineer', interviewCount: 0 })
  const prepared = prepareApplicationForm({ ...initial, status: 'Interview' }, initial.id)
  assert.equal(prepared.interviewCount, 1)
  const changes = applicationFormChanges(prepared, initial)
  assert.equal(changes.status, 'Interview')
  assert.equal(changes.interviewCount, 1)
})

test('Application rows: Real/Demo merges promote existing Interview/zero and preserve fresh unrelated data', () => {
  const current = normalizeApplication({ id: 1, company: 'Acme', role: 'Engineer', status: 'Interview', interviewCount: 0, notes: 'Server note\r\nReferral: No', salary: 'Fresh salary', date: '2025-12-30' })
  const merged = mergeApplicationFormChanges(current, { role: 'Updated role', lastUpdated: '2026-10-12' })
  assert.deepEqual(merged, { ...current, role: 'Updated role', lastUpdated: '2026-10-12', interviewCount: 1 })
  assert.equal(mergeApplicationFormChanges({ ...current, interviewCount: 4 }, { notes: 'Edit' }).interviewCount, 4)
})

const baseRow = {
  id: 1, company: 'Synthetic', role: 'Engineer', status: 'Applied',
  applied_date: '2026-01-02', last_updated: '2026-01-03',
  cover_letter: 'No', referral: 'Yes', interview_count: 2,
}

test('Application rows: quick status payload is partial and promotes only zero interview rounds', () => {
  assert.deepEqual(toApplicationStatusRow('Interview', 0, '2026-10-12'), {
    status: 'Interview', last_updated: '2026-10-12', interview_count: 1,
  })
  for (const [status, count] of [['Interview', 2], ['Offer', 3]]) {
    assert.deepEqual(toApplicationStatusRow(status, count, '2026-10-12'), {
      status, last_updated: '2026-10-12',
    })
  }
  assert.deepEqual(toApplicationStatusRow('Rejected', 0, '2026-10-12', 'Applied'), {
    status: 'Rejected', last_updated: '2026-10-12', rejected_date: '2026-10-12',
  })
  assert.deepEqual(toApplicationStatusRow('Rejected', 0, '2026-10-13', 'Rejected'), {
    status: 'Rejected', last_updated: '2026-10-13',
  })
})

test('Application rows: row mapping preserves nullable/explicit dates without inferring legacy history', () => {
  for (const value of [undefined, null, '', '2024-02-30', '2026-01-01T00:00:00Z']) {
    const model = fromApplicationRow({ ...baseRow, status: 'Rejected', rejected_date: value })
    assert.equal(model.rejectedDate, null)
    assert.equal(toApplicationRow(model, 'synthetic').rejected_date, null)
  }
  const model = fromApplicationRow({ ...baseRow, rejected_date: '2024-02-29' })
  assert.equal(model.rejectedDate, '2024-02-29')
  assert.equal(toApplicationRow(model, 'synthetic').rejected_date, '2024-02-29')
  assert.equal(normalizeApplication({ status: 'Rejected' }).rejectedDate, null)
  assert.equal(normalizeRejectedDate('2024-02-29'), '2024-02-29')
})

test('Application rows: fresh canonical transition, reopen/re-enter and duplicate rejection semantics', () => {
  const initial = normalizeApplication({ company: 'Synthetic', role: 'Engineer', status: 'Applied' })
  const rejected = mergeApplicationFormChanges(initial, { status: 'Rejected', lastUpdated: '2026-01-09' })
  assert.equal(rejected.rejectedDate, '2026-01-09')
  const notes = mergeApplicationFormChanges(rejected, { notes: 'Edited', salary: '100000', rejectedDate: null, lastUpdated: '2026-01-10' })
  assert.equal(notes.rejectedDate, '2026-01-09')
  const duplicate = mergeApplicationFormChanges(notes, { status: 'Rejected', lastUpdated: '2026-01-11' })
  assert.equal(duplicate.rejectedDate, '2026-01-09')
  const reopened = mergeApplicationFormChanges(duplicate, { status: 'Interview', lastUpdated: '2026-01-12' })
  assert.equal(reopened.rejectedDate, '2026-01-09')
  assert.equal(mergeApplicationFormChanges(reopened, { status: 'Rejected', lastUpdated: '2026-01-13' }).rejectedDate, '2026-01-13')
  assert.equal(getRejectionDate({ status: 'Rejected' }, 'Rejected', '2026-01-14'), null)
  assert.throws(() => getRejectionDate(initial, 'Rejected', '2026-02-30'), /valid local date/)
})

test('Application rows: stale form cannot clear a canonical rejection date or force an artificial transition', () => {
  const initial = normalizeApplication({ id: 1, company: 'Synthetic', role: 'Engineer' })
  const intent = applicationFormChanges(prepareApplicationForm({ ...initial, notes: 'Note', rejectedDate: '2020-01-01' }, 1), initial)
  assert.equal(Object.hasOwn(intent, 'rejectedDate'), false)
  const current = { ...initial, status: 'Rejected', rejectedDate: '2026-01-09' }
  assert.equal(mergeApplicationFormChanges(current, intent).rejectedDate, '2026-01-09')
  assert.equal(mergeApplicationFormChanges(current, { ...intent, status: 'Rejected' }).rejectedDate, '2026-01-09')
  assert.equal(prepareApplicationForm({ ...initial, status: 'Rejected' }).rejectedDate, null)
  assert.equal(prepareApplicationForm({ ...initial, status: 'Rejected', rejectedDate: '2024-02-29' }).rejectedDate, '2024-02-29')
})

for (const [name, notes] of [
  ['normal', 'Follow up with the recruiter.'],
  ['cover letter label', 'Cover letter: Yes'],
  ['referral label', 'Referral: No'],
  ['non-date label', 'Last updated: interview pending'],
  ['repeated labels', 'Cover letter: Yes; Cover letter: No\nReferral: Yes\nReferral: No'],
  ['multiline whitespace', '  First line\n\n\tCover letter: Yes\nReferral: No  \nLast updated: interview pending\n  '],
  ['CRLF', '  First line\r\nReferral: No\r\n\tLast updated: interview pending\r\n'],
  ['whitespace only', ' \t\r\n '],
  ['empty', ''],
]) {
  test(`Application rows: ${name} notes survive reading and role-only write/read roundtrip`, () => {
    const mapped = fromApplicationRow({ ...baseRow, notes })
    assert.equal(mapped.notes, notes)
    const written = toApplicationRow({ ...mapped, role: 'Updated role' }, 'synthetic-user')
    assert.equal(written.notes, notes)
    assert.equal(fromApplicationRow(written).notes, notes)
    assert.equal(written.role, 'Updated role')
    assert.equal(written.user_id, 'synthetic-user')
    assert.equal(mapped.coverLetter, 'No')
    assert.equal(mapped.referral, 'Yes')
    assert.equal(mapped.lastUpdated, '2026-01-03')
    assert.equal(mapped.interviewCount, 2)
  })
}

for (const [name, notes] of [
  ['null', null], ['undefined', undefined], ['number', 42], ['object', {}],
]) {
  test(`Application rows: ${name} notes normalize to an empty UI string at read/write boundaries`, () => {
    assert.equal(fromApplicationRow({ ...baseRow, notes }).notes, '')
    assert.equal(normalizeApplication({ notes }).notes, '')
    assert.equal(toApplicationRow({ notes }, 'synthetic-user').notes, '')
  })
}

test('Application rows: missing notes and a nullable row do not prevent a mixed list mapping', () => {
  assert.equal(fromApplicationRow(baseRow).notes, '')
  const rows = [baseRow, { ...baseRow, id: 2, notes: null }, { ...baseRow, id: 3, notes: 'Keep this' }]
  assert.deepEqual(rows.map(fromApplicationRow).map(({ notes }) => notes), ['', '', 'Keep this'])
})

test('Application rows: unversioned historical notes are preserved without guessing structured fields', () => {
  const notes = 'Original note\nCover letter: Yes\nReferral: Yes\nInterview stage: 2\nLast updated: 2020-01-01'
  for (const value of [undefined, null, '']) {
    const mapped = fromApplicationRow({
      company: 'Legacy', role: 'Engineer', applied_date: '2026-01-02', notes,
      cover_letter: value, referral: value, last_updated: value,
    })
    assert.equal(mapped.notes, notes)
    assert.equal(mapped.coverLetter, 'No')
    assert.equal(mapped.referral, 'No')
    assert.equal(mapped.lastUpdated, '2026-01-02')
    assert.equal(mapped.interviewCount, 0)
  }
})
