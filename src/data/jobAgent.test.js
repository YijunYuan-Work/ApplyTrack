import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatList,
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
