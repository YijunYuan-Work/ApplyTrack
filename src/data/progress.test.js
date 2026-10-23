import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { buildCalendarDays, buildCalendarEvents, buildProgressData, getDateFromKey, getDateKey, getLatestEventWeek, getLocalDateKey, getWeekKey, shiftWeek } from './progress.js'
import { demoApplications, normalizeApplication } from './applications.js'
import { fromApplicationRow, toApplicationRow } from './applicationRows.js'
import { buildProgressPresentation, percentage } from './progressPresentation.js'

const record = (id, status = 'Applied', interviewCount = 0, date = '') => ({ id, company: `Company ${id}`, role: 'Engineer', status, interviewCount, date })
const counts = (data) => Object.fromEntries(data.nodes.map(({ name, count }) => [name, count]))

test('Progress: outcome and conversion presentation derives from conserved branches, not interview rounds', () => {
  const rows = [record(1, 'Interview', 0), record(2, 'Offer', 4), record(3, 'Rejected', 2), record(4, 'Rejected'), record(5)]
  const progress = buildProgressData(rows)
  const result = buildProgressPresentation(rows, progress)
  assert.deepEqual(result.outcomes.map(({ count, percentage }) => [count, percentage]), [[3, 60], [1, 20], [1, 20], [1, 20], [1, 20], [1, 20]])
  assert.deepEqual(result.conversions.map(({ count, total }) => [count, total]), [[3, 5], [1, 3], [4, 5]])
  assert.equal(progress.summary.interviewEvents, 6)
  assert.equal(percentage(0, 0), 0)
})

test('Progress: six weekly buckets use only valid applied dates and preserve month/year boundaries', () => {
  const rows = [record(1, 'Applied', 0, '2025-12-31'), record(2, 'Rejected', 0, '2026-01-01'), record(3, 'Applied', 0, '2026-01-04'),
    { ...record(4, 'Rejected', 0, '2026-02-30'), rejectedDate: '2099-01-01', lastUpdated: '2099-12-31' }]
  const before = structuredClone(rows)
  const result = buildProgressPresentation(rows, buildProgressData(rows))
  assert.deepEqual(result.weeks, [
    { date: '2025-11-30', count: 0 }, { date: '2025-12-07', count: 0 }, { date: '2025-12-14', count: 0 },
    { date: '2025-12-21', count: 0 }, { date: '2025-12-28', count: 2 }, { date: '2026-01-04', count: 1 },
  ])
  assert.deepEqual(rows, before)
})

test('Progress: sparse, empty, undated and leap-day datasets have finite truthful presentation', () => {
  for (const rows of [[], [record(1)], [record(1, 'Applied', 0, '2024-02-29')], [record(1, 'Offer')]]) {
    const result = buildProgressPresentation(rows, buildProgressData(rows), new Date(2026, 0, 4))
    assert.equal(result.weeks.length, 6)
    assert.equal(result.weeks.reduce((n, week) => n + week.count, 0), rows[0]?.date ? 1 : 0)
    result.outcomes.forEach(outcome => assert.ok(Number.isFinite(outcome.percentage)))
    result.conversions.forEach(item => assert.ok(Number.isFinite(percentage(item.count, item.total))))
  }
})

function assertConservation({ nodes, links }) {
  nodes.forEach((node, index) => {
    const incoming = links.filter((link) => link.target === index)
    const outgoing = links.filter((link) => link.source === index)
    if (index !== 0) assert.equal(incoming.reduce((sum, link) => sum + link.value, 0), node.count)
    if (outgoing.length || index === 0) assert.equal(outgoing.reduce((sum, link) => sum + link.value, 0), node.count)
  })
  links.forEach(({ source, target, value }) => {
    assert.ok(source < target)
    assert.ok(Number.isInteger(value) && value > 0)
  })
}

test('Progress: independently counted mixed stages preserve totals and conserve each Sankey branch', () => {
  const input = [record(1), record(2, 'Applied', 2), record(3, 'Interview'), record(4, 'Interview', 3),
    record(5, 'Offer'), record(6, 'Offer', 2), record(7, 'Rejected'), record(8, 'Rejected', 1)]
  const { summary, data } = buildProgressData(input)
  assert.deepEqual(summary, { applications: 8, interviewEvents: 8, interviewedApplications: 6, offers: 2 })
  assert.deepEqual(counts(data), { Applications: 8, 'Reached interview': 6, Offers: 2,
    'Rejected after interview': 1, 'Still in progress': 3, 'No interview yet': 1, 'Rejected before interview': 1 })
  assertConservation(data)
})

test('Progress: stage/count matrix and every subset conserve flows without zero branches', () => {
  const matrix = ['Applied', 'Interview', 'Offer', 'Rejected'].flatMap((status, i) =>
    [0, 1, 3].map((count, j) => record(i * 3 + j, status, count)),
  )
  for (let mask = 0; mask < 2 ** matrix.length; mask += 1) {
    const input = matrix.filter((_, index) => mask & (1 << index))
    const { summary, data } = buildProgressData(input)
    const expectedInterviewed = input.filter((row) => row.interviewCount > 0 || ['Interview', 'Offer'].includes(row.status))
    assert.equal(summary.interviewEvents, input.reduce((sum, row) => sum + row.interviewCount, 0))
    assert.equal(summary.interviewedApplications, expectedInterviewed.length)
    assert.equal(summary.offers, input.filter((row) => row.status === 'Offer').length)
    assert.equal(counts(data)['Rejected after interview'] || 0, expectedInterviewed.filter((row) => row.status === 'Rejected').length)
    assert.equal(counts(data)['Rejected before interview'] || 0, input.filter((row) => row.status === 'Rejected' && row.interviewCount === 0).length)
    assertConservation(data)
  }
})

test('Progress: empty datasets have zero summaries and no links', () => {
  const { data, summary } = buildProgressData([])
  assert.deepEqual(summary, { applications: 0, interviewEvents: 0, interviewedApplications: 0, offers: 0 })
  assert.deepEqual(counts(data), { Applications: 0 })
  assert.deepEqual(data.links, [])
  assert.equal(buildCalendarEvents([]).size, 0)
})

test('Progress: invalid rounds cannot poison Progress totals; no inferred completed rounds', () => {
  const { summary, data } = buildProgressData([record(1, 'Applied', Infinity), record(2, 'Applied', -2),
    record(3, 'Rejected', 'invalid'), record(4, 'Interview', NaN), record(5, 'Offer', null), record(6, 'Applied', '2')])
  assert.deepEqual(summary, { applications: 6, interviewEvents: 2, interviewedApplications: 3, offers: 1 })
  assertConservation(data)
})

test('Progress: valid dates, century leap rules and ISO prefixes; malformed dates are excluded', () => {
  for (const date of ['2024-02-29', '2000-02-29', '0099-06-01', '2026-12-31']) {
    assert.equal(getDateKey(date), date)
    assert.equal(getLocalDateKey(getDateFromKey(date)), date)
  }
  assert.equal(getDateKey('2026-01-01T23:30:00-08:00'), '2026-01-01')
  for (const invalid of ['', null, undefined, 123, 'garbage', '2026-02-29', '1900-02-29', '2026-04-31',
    '2026-13-01', '2026-00-01', '2026-01-00', '0000-01-01', '2026-1-01', '2026-01-01 junk', '2026-01-01Tjunk']) {
    assert.equal(getDateKey(invalid), '')
  }
})

test('Progress: Applied/Rejected events share dates, sort deterministically, and ignore unrelated dates', () => {
  const input = [
    { ...record(2, 'Rejected', 0, '2024-02-29'), company: 'Zeta', rejectedDate: '2024-02-29', lastUpdated: '2099-01-01' },
    { ...record(1, 'Interview', 1, '2024-02-29'), company: 'Alpha', lastUpdated: '2099-01-01', followUp: '2099-01-01' },
    { ...record(3, 'Offer', 0, ''), lastUpdated: '2099-01-01' },
    { ...record(4, 'Rejected', 0, 'bad'), rejectedDate: '2024-02-30' },
  ]
  const before = structuredClone(input)
  const events = buildCalendarEvents(input)
  assert.deepEqual([...events.keys()], ['2024-02-29'])
  assert.deepEqual(events.get('2024-02-29').map(({ key }) => key), ['1-applied', '2-applied', '2-rejected'])
  assert.deepEqual(input, before)
  assert.equal(getLatestEventWeek(events), '2024-02-25')
  assert.deepEqual(buildCalendarEvents([...input].reverse()), events)
})

test('Progress: invalid latest date cannot shift the week or crash; all-undated falls back to local today', () => {
  const events = buildCalendarEvents([record(1, 'Applied', 0, '2026-02-28'), record(2, 'Applied', 0, 'zzzz'),
    { ...record(3, 'Rejected', 0, '2026-02-30'), rejectedDate: '9999-99-99' }])
  assert.equal(getLatestEventWeek(events), '2026-02-22')
  const today = new Date(2026, 0, 1, 0, 30)
  assert.equal(getLatestEventWeek(new Map(), today), '2025-12-28')
  assert.equal(buildCalendarDays('2025-12-28', new Map()).flatMap((day) => day.events).length, 0)
})

test('Progress: year/month/leap boundaries and reversible week navigation', () => {
  for (const [week, dates] of [
    ['2025-12-28', ['2025-12-28', '2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03']],
    ['2024-02-25', ['2024-02-25', '2024-02-26', '2024-02-27', '2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02']],
    ['2026-02-22', ['2026-02-22', '2026-02-23', '2026-02-24', '2026-02-25', '2026-02-26', '2026-02-27', '2026-02-28']],
  ]) {
    const events = buildCalendarEvents(dates.map((date, index) => record(index, 'Applied', 0, date)))
    const days = buildCalendarDays(week, events)
    assert.deepEqual(days.map((day) => day.dateKey), dates)
    assert.deepEqual(days.map((day) => day.events.length), [1, 1, 1, 1, 1, 1, 1])
    assert.equal(shiftWeek(shiftWeek(week, 1), -1), week)
    assert.equal(getWeekKey(getDateFromKey(dates[6])), week)
  }
})

test('Progress: Real row mapping and Demo normalization yield identical analytics', () => {
  const real = demoApplications.map((row) => fromApplicationRow({ ...toApplicationRow(row, 'synthetic'), id: row.id }))
  const demo = demoApplications.map(normalizeApplication)
  assert.deepEqual(buildProgressData(real), buildProgressData(demo))
  const signature = (rows) => [...buildCalendarEvents(rows)].map(([date, events]) => [date, events.map(({ key, type }) => ({ key, type }))])
  assert.deepEqual(signature(real), signature(demo))
})

test('Progress: unknown rejection dates have no event; reopened records retain only latest known event', () => {
  const unknown = { ...record(1, 'Rejected', 0, '2026-01-01'), rejectedDate: null, lastUpdated: '2026-01-09' }
  assert.deepEqual([...buildCalendarEvents([unknown]).keys()], ['2026-01-01'])
  assert.equal(buildProgressData([unknown]).data.nodes.at(-1).name, 'Rejected before interview')
  const reopened = { ...unknown, status: 'Applied', rejectedDate: '2026-01-08' }
  assert.equal(buildCalendarEvents([reopened]).get('2026-01-08')[0].type, 'Rejected')
  const rerejected = { ...reopened, status: 'Rejected', rejectedDate: '2026-01-10' }
  assert.deepEqual([...buildCalendarEvents([rerejected]).keys()], ['2026-01-01', '2026-01-10'])
})

test('Progress: weeks can straddle the edges of four-digit event years without invalid internal dates', () => {
  for (const value of ['0001-01-01', '9999-12-31']) {
    const events = buildCalendarEvents([record(1, 'Applied', 0, value)])
    const week = getLatestEventWeek(events)
    assert.equal(buildCalendarDays(week, events).flatMap((day) => day.events).length, 1)
    assert.equal(buildCalendarDays(shiftWeek(week, 1), events).length, 7)
    assert.equal(shiftWeek(shiftWeek(week, 1), -1), week)
  }
})

for (const timezone of ['UTC', 'America/Toronto', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Asia/Kolkata']) {
  test(`Progress: local date-only weeks, DST and midnight boundaries in ${timezone}`, () => {
    const moduleUrl = new URL('./progress.js', import.meta.url).href
    execFileSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { getDateFromKey, getDateKey, getLocalDateKey, getWeekKey, getLatestEventWeek, buildCalendarDays, shiftWeek } from ${JSON.stringify(moduleUrl)};
      assert.equal(getLocalDateKey(getDateFromKey('2026-01-01')), '2026-01-01');
      assert.equal(getDateKey('2026-01-01T00:30:00+14:00'), '2026-01-01');
      assert.equal(getDateKey('2025-12-31T23:30:00-08:00'), '2025-12-31');
      assert.equal(getLatestEventWeek(new Map(), new Date(2026, 0, 4, 0, 1)), '2026-01-04');
      assert.equal(getWeekKey(new Date(2026, 0, 3, 23, 59)), '2025-12-28');
      for (const week of ['2026-03-08', '2026-11-01']) {
        const days = buildCalendarDays(week, new Map());
        assert.equal(days.length, 7);
        assert.equal(new Set(days.map(day => day.dateKey)).size, 7);
        assert.equal(days[6].date.getDay(), 6);
        assert.equal(shiftWeek(shiftWeek(week, 1), -1), week);
      }
    `], { env: { ...process.env, TZ: timezone }, stdio: 'pipe' })
  })
}
