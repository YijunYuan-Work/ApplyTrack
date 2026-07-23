import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatList,
  getJobLeadPresentation,
  parseList,
} from './jobAgent.js'

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

  assert.equal(presentation.salaryLabel, '$90,000 - $120,000')
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
