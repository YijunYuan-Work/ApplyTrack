import assert from 'node:assert/strict'
import test from 'node:test'
import { detectResumeSkills } from './resumeParser.js'

test('detectResumeSkills finds whole skill names without partial matches', () => {
  assert.deepEqual(
    detectResumeSkills('Built React apps with JavaScript, SQL, and Supabase.'),
    ['JavaScript', 'React', 'SQL', 'Supabase'],
  )
})

test('detectResumeSkills does not mistake JavaScript for Java', () => {
  assert.deepEqual(detectResumeSkills('JavaScript developer'), ['JavaScript'])
})
