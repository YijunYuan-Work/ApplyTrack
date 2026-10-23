import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatList,
  getJobLeadPresentation,
  parseList,
  sortJobLeadsNewestFirst,
} from './jobAgent.js'
import { parseSalaryText } from '../../supabase/functions/_shared/salary.js'
import { salaryCases, rejectedSalaryCases } from '../../tests/fixtures/salaryCases.js'

test('parseList trims, deduplicates, and accepts commas or new lines', () => {
  assert.deepEqual(parseList('React, SQL\nReact; Supabase'), [
    'React',
    'SQL',
    'Supabase',
  ])
})

test('formatList produces editable comma-separated text', () => {
  assert.equal(formatList(['Toronto', 'Remote']), 'Toronto, Remote')
})

test('job lead presentation extracts salary, tags, and summary text', () => {
  const presentation = getJobLeadPresentation({
    description:
      '- Remote · $90,000 - $120,000 a year · Easily apply · Build business applications.',
    salaryMax: null,
    salaryMin: null,
  })

  assert.equal(presentation.salaryLabel, '$90,000 - $120,000 a year')
  assert.deepEqual(presentation.highlights, ['Easy Apply', 'Remote'])
  assert.equal(presentation.summary, 'Build business applications')
})

test('job lead presentation deduplicates repeated alert highlights', () => {
  const presentation = getJobLeadPresentation({
    description: '1 company alum Easy Apply · 1 company alum · Easy Apply',
    salaryMax: null,
    salaryMin: null,
  })

  assert.deepEqual(presentation.highlights, ['1 company alum', 'Easy Apply'])
  assert.equal(presentation.summary, '')
})

test('job lead presentation omits salary when none is available', () => {
  const presentation = getJobLeadPresentation({
    description: 'Easy Apply',
    salaryMax: null,
    salaryMin: null,
  })

  assert.equal(presentation.salaryLabel, null)
})

test('sortJobLeadsNewestFirst orders leads by import date with newest first', () => {
  const leads = [
    { discoveredAt: '2026-08-04T10:00:00.000Z', id: 'older' },
    { discoveredAt: '2026-08-06T10:00:00.000Z', id: 'newest' },
    { discoveredAt: '2026-08-05T10:00:00.000Z', id: 'middle' },
  ]

  assert.deepEqual(
    sortJobLeadsNewestFirst(leads).map((lead) => lead.id),
    ['newest', 'middle', 'older'],
  )
  assert.equal(leads[0].id, 'older')
})

for (const [text, minimum, maximum, period] of salaryCases) {
  test(`Salary parsing: complete salary expression ${text}`, () => {
    assert.deepEqual(parseSalaryText(text), { minimum, maximum, period, matchedText: text })
    const presentation = getJobLeadPresentation({ description: `${text} · Build tools` })
    assert.equal(presentation.salaryLabel, text)
    assert.equal(presentation.summary, 'Build tools')
  })
}

for (const text of rejectedSalaryCases) {
  test(`Salary parsing: reject without salvaging or stripping ${text}`, () => {
    assert.equal(parseSalaryText(text), null)
    const presentation = getJobLeadPresentation({ description: `Build tools · ${text} · Keep details` })
    assert.equal(presentation.salaryLabel, null)
    assert.ok(presentation.summary.includes(text), presentation.summary)
  })
}

test('Salary parsing: structured bounds take precedence without fabricating currency or units', () => {
  assert.equal(getJobLeadPresentation({ salaryMin: 95000, salaryMax: 125000 }).salaryLabel, '95,000 - 125,000')
  assert.equal(getJobLeadPresentation({ salaryMax: '125000.50' }).salaryLabel, '125,000.5')
  assert.equal(getJobLeadPresentation({ salaryMin: 0, salaryMax: 125000 }).salaryLabel, '0 - 125,000')
  assert.equal(getJobLeadPresentation({ salaryMin: 0 }).salaryLabel, '0')
  const conflict = getJobLeadPresentation({ salaryMin: 95000, salaryMax: 125000, description: 'USD $90k - $120k a year' })
  assert.equal(conflict.salaryLabel, '95,000 - 125,000')
  assert.equal(conflict.summary, 'USD $90k - $120k a year')
  const matching = getJobLeadPresentation({ salaryMin: 90000, salaryMax: 120000, description: 'USD $90k - $120k a year' })
  assert.equal(matching.salaryLabel, 'USD $90k - $120k a year')
  assert.equal(matching.summary, '')
  for (const bounds of [
    { salaryMin: -1 }, { salaryMin: NaN }, { salaryMin: Infinity }, { salaryMin: '' },
    { salaryMin: 'not a number' }, { salaryMin: 120000, salaryMax: 90000 },
  ]) {
    const result = getJobLeadPresentation({ ...bounds, description: '$100k a year' })
    assert.equal(result.salaryLabel, null)
    assert.equal(result.summary, '$100k a year')
  }
})

test('Salary parsing: salary extraction retains surrounding prose and does not infer an annual period', () => {
  const value = getJobLeadPresentation({ description: 'Competitive pay $100k with benefits · Build tools' })
  assert.equal(value.salaryLabel, '$100k')
  assert.equal(value.summary, 'Competitive pay with benefits · Build tools')
  assert.equal(parseSalaryText('$100k').period, null)
  assert.deepEqual(parseSalaryText('Pay $100k a year. Build tools.'), {
    minimum: 100000, maximum: null, period: 'year', matchedText: '$100k a year',
  })
})

test('Salary parsing: decimal shorthand expands exactly, without floating point salary noise', () => {
  for (let whole = 1; whole < 100; whole += 1) {
    for (let fraction = 1; fraction < 100; fraction += 1) {
      const text = `$${whole}.${String(fraction).padStart(2, '0')}k a year`
      assert.equal(parseSalaryText(text).minimum, whole * 1000 + fraction * 10, text)
    }
  }
})
