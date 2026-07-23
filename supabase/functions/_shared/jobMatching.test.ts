import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateJob, type JobProfile, type JobSearch, type NormalizedJob } from './jobMatching.ts'

const search: JobSearch = {
  country_code: 'ca',
  employment_types: ['full time'],
  excluded_companies: [],
  excluded_keywords: ['senior'],
  keywords: ['TypeScript'],
  locations: ['Toronto'],
  remote_preference: 'any',
  salary_max: 100000,
  salary_min: 60000,
  seniority_levels: ['entry', 'mid'],
  titles: ['Frontend Developer'],
  work_arrangements: ['remote', 'hybrid', 'onsite'],
}

const profile: JobProfile = {
  skills: ['React', 'SQL'],
  years_experience: 2,
}

const job: NormalizedJob = {
  category: 'Software development',
  company: 'Example Labs',
  contractType: 'full time permanent',
  description: 'Build React products with TypeScript and SQL.',
  externalId: 'job-1',
  location: 'Toronto, Ontario',
  postedAt: null,
  salaryMax: 85000,
  salaryMin: 70000,
  title: 'Frontend Developer',
  url: 'https://example.com/jobs/1',
}

test('evaluateJob explains a strong deterministic match', () => {
  const result = evaluateJob(job, search, profile)

  assert.equal(result.filtered, false)
  assert.ok(result.score >= 80)
  assert.ok(result.matchReasons.some((reason) => reason.includes('Title matches')))
  assert.ok(result.matchReasons.some((reason) => reason.includes('Skills match')))
})

test('evaluateJob applies hard exclusions without hiding the reason', () => {
  const result = evaluateJob(
    { ...job, company: 'Blocked Company' },
    { ...search, excluded_companies: ['Blocked Company'] },
    profile,
  )

  assert.equal(result.filtered, true)
  assert.deepEqual(result.filterReasons, ['Company is on your exclusion list'])
})

test('evaluateJob respects work arrangement and seniority selections', () => {
  const result = evaluateJob(
    { ...job, description: 'Senior role working remotely with React.' },
    {
      ...search,
      seniority_levels: ['entry'],
      work_arrangements: ['onsite'],
    },
    profile,
  )

  assert.equal(result.filtered, true)
  assert.ok(result.filterReasons.includes('Work arrangement is remote'))
  assert.ok(result.filterReasons.includes('Seniority is senior'))
})

test('evaluateJob does not guess an unspecified work arrangement', () => {
  const result = evaluateJob(
    job,
    {
      ...search,
      employment_types: ['full_time'],
      work_arrangements: ['remote'],
    },
    profile,
  )

  assert.equal(result.filtered, false)
  assert.ok(!result.filterReasons.some((reason) => reason.includes('Work arrangement')))
})

test('evaluateJob treats a selected country as matching jobs from that country feed', () => {
  const result = evaluateJob(
    { ...job, location: 'Ottawa, Ontario' },
    { ...search, locations: ['Canada'] },
    profile,
  )

  assert.equal(result.filtered, false)
  assert.ok(!result.filterReasons.includes('Outside your preferred locations'))
})
