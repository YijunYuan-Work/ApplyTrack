import assert from 'node:assert/strict'
import test from 'node:test'
import { fromApplicationRow, toApplicationRow, toApplicationStatusRow } from './applicationRows.js'
import { normalizeApplication } from './applications.js'

const baseRow = {
  id: 1, company: 'Synthetic', role: 'Engineer', status: 'Applied',
  applied_date: '2026-01-02', last_updated: '2026-01-03',
  cover_letter: 'No', referral: 'Yes', interview_count: 2,
}

test('RF-07: quick status payload is partial and promotes only zero interview rounds', () => {
  assert.deepEqual(toApplicationStatusRow('Interview', 0, '2026-10-12'), {
    status: 'Interview', last_updated: '2026-10-12', interview_count: 1,
  })
  for (const [status, count] of [['Interview', 2], ['Rejected', 0], ['Offer', 3]]) {
    assert.deepEqual(toApplicationStatusRow(status, count, '2026-10-12'), {
      status, last_updated: '2026-10-12',
    })
  }
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
  test(`RF-03: ${name} notes survive reading and role-only write/read roundtrip`, () => {
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
  test(`RF-03: ${name} notes normalize to an empty UI string at read/write boundaries`, () => {
    assert.equal(fromApplicationRow({ ...baseRow, notes }).notes, '')
    assert.equal(normalizeApplication({ notes }).notes, '')
    assert.equal(toApplicationRow({ notes }, 'synthetic-user').notes, '')
  })
}

test('RF-03: missing notes and a nullable row do not prevent a mixed list mapping', () => {
  assert.equal(fromApplicationRow(baseRow).notes, '')
  const rows = [baseRow, { ...baseRow, id: 2, notes: null }, { ...baseRow, id: 3, notes: 'Keep this' }]
  assert.deepEqual(rows.map(fromApplicationRow).map(({ notes }) => notes), ['', '', 'Keep this'])
})

test('RF-03: unversioned historical notes are preserved without guessing structured fields', () => {
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
