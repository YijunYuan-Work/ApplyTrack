import { test, expect } from '@playwright/test'
import { demoApplications } from '../../../src/data/applications.js'
import { toApplicationRow } from '../../../src/data/applicationRows.js'
import { application, backend, nav, noOverflow, signIn, spreadsheet, userId } from './fixtures.js'

test.use({ timezoneId: 'America/Toronto' })
const control = (page, company = 'Synthetic 1') => page.getByRole('combobox', { name: `Status for ${company}`, exact: true }).filter({ visible: true })
const settled = (page) => expect(page.getByText('Saving status...', { exact: true })).toHaveCount(0)
const clock = (page, date) => page.clock.setFixedTime(new Date(`${date}T17:00:00Z`))
async function start(page, context, overrides = {}) {
  await clock(page, '2026-01-09')
  const state = await backend(context, [application(1, { applied_date: '2025-12-30', ...overrides })])
  await signIn(page)
  await nav(page, 'List')
  await expect(control(page)).toBeVisible()
  return state
}
async function pending(state, index, collection = 'statusUpdates') {
  await expect.poll(() => state[collection].length).toBe(index + 1)
  return state[collection][index]
}
async function calendar(page, date, company = 'Synthetic 1') {
  await nav(page, 'Progress')
  await expect(page.locator('.progress-summary')).toBeVisible({ timeout: 15000 })
  await nav(page, 'Calendar')
  const event = page.locator('.calendar-event-rejected').filter({ hasText: company })
  if (date === null) await expect(event).toHaveCount(0)
  else {
    await expect(event).toHaveCount(1)
    await expect(page.locator('.calendar-day').filter({ has: event }).locator('time')).toHaveAttribute('datetime', date)
  }
}
async function edit(page, company = 'Synthetic 1') {
  await nav(page, 'List')
  await page.locator('.application-card').filter({ hasText: company }).getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Edit application', exact: true })).toBeVisible()
}

test('Rejection dates: legacy NULL remains unknown through note edits, repeated Rejected and reopening', async ({ page, context }) => {
  const state = await start(page, context, { status: 'Rejected', last_updated: '2025-12-31' })
  await calendar(page, null)
  await nav(page, 'Dashboard')
  await edit(page)
  await page.getByLabel('Notes', { exact: true }).fill('Only a note changed')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/dashboard$/)
  expect(state.applications[0].rejected_date).toBeNull()
  await control(page).selectOption('Rejected')
  await settled(page)
  await control(page).selectOption('Applied')
  await expect(control(page)).toHaveValue('Applied')
  await settled(page)
  await calendar(page, null)
  expect(state.applications[0].rejected_date).toBeNull()
})

test('Rejection dates: first rejection uses local operation day, preserves Applied date, and repeated updates retain it', async ({ page, context }) => {
  const state = await start(page, context)
  await page.clock.setFixedTime(new Date('2026-01-10T04:30:00Z')) // Still January 9 in Toronto.
  await control(page).selectOption('Rejected')
  await expect(control(page)).toHaveValue('Rejected')
  await settled(page)
  expect(state.applications[0]).toMatchObject({ rejected_date: '2026-01-09', applied_date: '2025-12-30' })
  await clock(page, '2026-01-10')
  await control(page).selectOption('Rejected')
  await settled(page)
  expect(state.requests.filter((request) => request.method === 'PATCH')).toHaveLength(1)
  await page.reload()
  await expect(control(page)).toHaveValue('Rejected')
  await calendar(page, '2026-01-09')
})

test('Rejection dates: full-form rejection, salary edit, reopen and re-entry retain only the latest event', async ({ page, context }) => {
  const state = await start(page, context)
  await edit(page)
  await page.locator('form').getByRole('combobox', { name: 'Status', exact: true }).selectOption('Rejected')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/dashboard$/)
  expect(state.applications[0].rejected_date).toBe('2026-01-09')
  await clock(page, '2026-01-10')
  await edit(page)
  await page.getByLabel('Salary range', { exact: true }).fill('100000')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/dashboard$/)
  expect(state.requests.filter((request) => request.method === 'PATCH').at(-1).body).not.toHaveProperty('rejected_date')
  await control(page).selectOption('Interview')
  await expect(control(page)).toHaveValue('Interview')
  await settled(page)
  await calendar(page, '2026-01-09')
  await nav(page, 'Dashboard')
  await clock(page, '2026-01-12')
  await control(page).selectOption('Rejected')
  await expect(control(page)).toHaveValue('Rejected')
  await settled(page)
  expect(state.applications[0].rejected_date).toBe('2026-01-12')
  await calendar(page, '2026-01-12')
  await nav(page, 'Previous week')
  await expect(page.locator('.calendar-event-rejected')).toHaveCount(0)
})

test('Rejection dates: failed quick write adds no event; a later retry records its own operation day', async ({ page, context }) => {
  const state = await start(page, context)
  state.controlStatus = true
  await control(page).selectOption('Rejected')
  await (await pending(state, 0)).fail()
  await settled(page)
  await expect(page.getByRole('alert')).toContainText('Synthetic status failure')
  expect(state.applications[0].rejected_date).toBeNull()
  await clock(page, '2026-01-10')
  await control(page).selectOption('Rejected')
  await (await pending(state, 1)).respond()
  await settled(page)
  await calendar(page, '2026-01-10')
})

for (const path of ['quick', 'form']) {
  test(`Rejection dates: lost ${path} response reconciles/reads canonical date and next-day retry cannot restamp`, async ({ page, context }) => {
    const state = await start(page, context)
    state.controlStatus = path === 'quick'
    state.controlSaves = path === 'form'
    if (path === 'quick') await control(page).selectOption('Rejected')
    else {
      await edit(page)
      await page.locator('form').getByRole('combobox', { name: 'Status', exact: true }).selectOption('Rejected')
      await page.locator('button[type="submit"]').click()
    }
    const collection = path === 'quick' ? 'statusUpdates' : 'saves'
    const first = await pending(state, 0, collection)
    first.commit()
    await first.abort()
    if (path === 'quick') await settled(page)
    await expect(page.getByRole('alert')).toBeVisible()
    await clock(page, '2026-01-10')
    if (path === 'quick') await control(page).selectOption('Rejected')
    else await page.locator('button[type="submit"]').click()
    const retry = await pending(state, 1, collection)
    expect(retry.body).not.toHaveProperty('rejected_date')
    await retry.respond()
    if (path === 'quick') await settled(page)
    else await expect(page).toHaveURL(/dashboard$/)
    expect(state.applications[0].rejected_date).toBe('2026-01-09')
    await calendar(page, '2026-01-09')
  })
}

for (const commitFirst of ['quick', 'form']) {
  test(`Rejection dates: concurrent note edit and rejection preserve date when ${commitFirst} commits first`, async ({ page, context }) => {
    const state = await start(page, context)
    state.controlStatus = true
    state.controlSaves = true
    await control(page).selectOption('Rejected')
    const quick = await pending(state, 0)
    await clock(page, '2026-01-10')
    await edit(page)
    await page.getByLabel('Notes', { exact: true }).fill('Fresh notes')
    await page.locator('button[type="submit"]').click()
    const form = await pending(state, 0, 'saves')
    expect(form.body).not.toHaveProperty('rejected_date')
    if (commitFirst === 'quick') {
      quick.commit()
      await form.respond()
      const retry = await pending(state, 1, 'saves')
      expect(retry.body).not.toHaveProperty('rejected_date')
      await retry.respond()
      await quick.respond()
    } else {
      await form.respond()
      await quick.respond()
      const retry = await pending(state, 1)
      expect(retry.body.rejected_date).toBe('2026-01-09')
      await retry.respond()
    }
    await expect(page).toHaveURL(/dashboard$/)
    await settled(page)
    expect(state.applications[0]).toMatchObject({ rejected_date: '2026-01-09', notes: 'Fresh notes', status: 'Rejected' })
    await calendar(page, '2026-01-09')
  })
}

test('Rejection dates: a full-form rejection conflict re-reads already-Rejected state rather than replacing another transition day', async ({ page, context }) => {
  const state = await start(page, context)
  state.controlSaves = true
  await edit(page)
  await page.locator('form').getByRole('combobox', { name: 'Status', exact: true }).selectOption('Rejected')
  await page.getByLabel('Notes', { exact: true }).fill('Form note')
  await page.locator('button[type="submit"]').click()
  const first = await pending(state, 0, 'saves')
  Object.assign(state.applications[0], { status: 'Rejected', rejected_date: '2026-01-08', updated_at: '2026-01-08T00:00:00.000Z' })
  await first.respond()
  const retry = await pending(state, 1, 'saves')
  expect(retry.body).not.toHaveProperty('rejected_date')
  await retry.respond()
  await expect(page).toHaveURL(/dashboard$/)
  await calendar(page, '2026-01-08')
})

test('Rejection dates: quick rejection conflict preserves a concurrent canonical transition day', async ({ page, context }) => {
  const state = await start(page, context)
  state.controlStatus = true
  await control(page).selectOption('Rejected')
  const first = await pending(state, 0)
  Object.assign(state.applications[0], { status: 'Rejected', rejected_date: '2026-01-08', updated_at: '2026-01-08T00:00:00.000Z' })
  await first.respond()
  const retry = await pending(state, 1)
  expect(retry.body).not.toHaveProperty('rejected_date')
  await retry.respond()
  await settled(page)
  await calendar(page, '2026-01-08')
})

test('Rejection dates: a late quick response cannot replace a newer full-form rejection date', async ({ page, context }) => {
  const state = await start(page, context)
  state.controlStatus = true
  await control(page).selectOption('Rejected')
  const first = await pending(state, 0)
  first.commit()
  await clock(page, '2026-01-10')
  await edit(page)
  await page.locator('form').getByRole('combobox', { name: 'Status', exact: true }).selectOption('Interview')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/dashboard$/)
  await clock(page, '2026-01-12')
  await edit(page)
  await page.locator('form').getByRole('combobox', { name: 'Status', exact: true }).selectOption('Rejected')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/dashboard$/)
  await first.respond()
  await settled(page)
  expect(state.applications[0].rejected_date).toBe('2026-01-12')
  await calendar(page, '2026-01-12')
})

test('Rejection dates: an uncommitted full-form failure does not stamp history and a later retry uses its new day', async ({ page, context }) => {
  const state = await start(page, context)
  state.controlSaves = true
  await edit(page)
  await page.locator('form').getByRole('combobox', { name: 'Status', exact: true }).selectOption('Rejected')
  await page.locator('button[type="submit"]').click()
  await (await pending(state, 0, 'saves')).fail()
  await expect(page.getByRole('alert')).toBeVisible()
  expect(state.applications[0].rejected_date).toBeNull()
  await clock(page, '2026-01-10')
  await page.locator('button[type="submit"]').click()
  await (await pending(state, 1, 'saves')).respond()
  await expect(page).toHaveURL(/dashboard$/)
  await calendar(page, '2026-01-10')
})

test('Rejection dates: a delayed full rejection response cannot hide a later reopened canonical date', async ({ page, context }) => {
  const state = await start(page, context)
  state.controlSaves = true
  await edit(page)
  await page.locator('form').getByRole('combobox', { name: 'Status', exact: true }).selectOption('Rejected')
  await page.locator('button[type="submit"]').click()
  const form = await pending(state, 0, 'saves')
  form.commit()
  await nav(page, 'Dashboard')
  await control(page).selectOption('Interview')
  await expect(control(page)).toHaveValue('Interview')
  await settled(page)
  await form.respond()
  await calendar(page, '2026-01-09')
  expect(state.applications[0].status).toBe('Interview')
})

test('Rejection dates: old-session rejection response and queued work cannot modify a new workspace', async ({ page, context }) => {
  const state = await start(page, context)
  state.controlStatus = true
  await control(page).selectOption('Rejected')
  const old = await pending(state, 0)
  old.commit()
  await control(page).selectOption('Applied')
  await nav(page, 'Sign out')
  const other = '00000000-0000-4000-8000-000000000002'
  state.user = { ...state.user, id: other }
  state.applications = [application(2, { user_id: other, status: 'Rejected', rejected_date: '2025-12-31', applied_date: '2025-12-30' })]
  await signIn(page)
  await old.respond()
  await calendar(page, '2025-12-31', 'Synthetic 2')
  expect(state.statusUpdates).toHaveLength(1)
  expect(state.applications[0].rejected_date).toBe('2025-12-31')
})

test('Rejection dates: creation/import keep unknown dates NULL while explicit Excel history appears in Calendar', async ({ page, context }) => {
  const state = await start(page, context)
  await nav(page, 'Add application')
  await page.getByLabel('Company', { exact: false }).fill('New rejected')
  await page.getByLabel('Role', { exact: false }).fill('Engineer')
  await page.locator('form').getByRole('combobox', { name: 'Status', exact: true }).selectOption('Rejected')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/dashboard$/)
  expect(state.applications.find((row) => row.company === 'New rejected').rejected_date).toBeNull()
  await nav(page, 'Import Excel')
  await page.locator('input[type="file"]').setInputFiles(spreadsheet([
    ['Company', 'Role', 'Status', 'Applied Date', 'Rejected Date'],
    ['Import unknown', 'Engineer', 'Rejected', '2024-02-20', ''],
    ['Import explicit', 'Engineer', 'Rejected', '2024-02-20', '2026-01-08'],
  ]))
  await page.getByRole('button', { name: 'Import 2 applications', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Import 2 applications', exact: true }).click()
  await expect.poll(() => state.applications.some((row) => row.company === 'Import explicit')).toBe(true)
  expect(state.applications.find((row) => row.company === 'Import unknown').rejected_date).toBeNull()
  expect(state.applications.find((row) => row.company === 'Import explicit').rejected_date).toBe('2026-01-08')
  await calendar(page, '2026-01-08', 'Import explicit')
  await expect(page.locator('.calendar-event-rejected').filter({ hasText: 'Import unknown' })).toHaveCount(0)
})

for (const mode of ['Real', 'Demo']) {
  for (const width of [1440, 390]) {
    test(`Rejection dates: ${mode} reject/edit/reopen/reject calendar semantics at ${width}px`, async ({ page, context }) => {
      await clock(page, '2026-08-01')
      const state = await backend(context, mode === 'Real' ? demoApplications.map((row, index) => application(index + 1, toApplicationRow(row, userId))) : [])
      await page.setViewportSize({ width, height: 900 })
      if (mode === 'Demo') await page.goto('/#/demo')
      else await signIn(page)
      await nav(page, 'List')
      const company = 'Brightline Health'
      await control(page, company).selectOption('Rejected')
      await expect(control(page, company)).toHaveValue('Rejected')
      await settled(page)
      await clock(page, '2026-08-03')
      await edit(page, company)
      await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Same historical date')
      await page.locator('button[type="submit"]').click()
      await expect(page).toHaveURL(/\/(dashboard|demo)$/)
      await nav(page, 'List')
      await expect(control(page, company)).toBeVisible()
      await control(page, company).selectOption('Applied')
      await expect(control(page, company)).toHaveValue('Applied')
      await settled(page)
      await calendar(page, '2026-08-01', company)
      await nav(page, 'Dashboard')
      await nav(page, 'List')
      await clock(page, '2026-08-10')
      await control(page, company).selectOption('Rejected')
      await expect(control(page, company)).toHaveValue('Rejected')
      await settled(page)
      await calendar(page, '2026-08-10', company)
      await noOverflow(page)
      if (mode === 'Demo') expect(state.requests).toEqual([])
      expect(state.blocked).toEqual([])
    })
  }
}
