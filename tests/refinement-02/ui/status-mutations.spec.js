import { expect, test } from '@playwright/test'
import { application, backend, nav, noOverflow, signIn } from './fixtures.js'

const control = (page, company = 'Synthetic 1') => page.getByRole('combobox', { name: `Status for ${company}`, exact: true }).filter({ visible: true })
const settled = (page) => expect(page.getByText('Saving status...', { exact: true })).toHaveCount(0)
async function operation(state, index) {
  await expect.poll(() => state.statusUpdates.length).toBe(index + 1)
  return state.statusUpdates[index]
}
async function setup(page, context, rows = [application(1)]) {
  const state = await backend(context, rows)
  state.controlStatus = true
  await signIn(page)
  await expect(control(page)).toBeVisible()
  return state
}

test('rapid FIFO changes preserve dates/rounds, partial payloads and reload persistence', async ({ page, context }) => {
  const row = application(1, { notes: 'Keep\r\nReferral: No', salary: '95000', follow_up: '2027-01-02', contact: 'Recruiter' })
  const state = await setup(page, context, [row])
  await control(page).selectOption('Interview')
  const first = await operation(state, 0)
  await control(page).selectOption('Rejected')
  await control(page).selectOption('Offer')
  expect(state.statusUpdates).toHaveLength(1)
  expect(first.body).toEqual({ status: 'Interview', last_updated: expect.any(String), interview_count: 1 })
  await expect(page.getByText('Saving status...')).toBeVisible()
  await first.respond()
  const second = await operation(state, 1)
  expect(second.body).toEqual({ status: 'Rejected', last_updated: first.body.last_updated })
  await second.respond()
  await (await operation(state, 2)).respond()
  await settled(page)
  await expect(control(page)).toHaveValue('Offer')
  expect(state.applications[0]).toMatchObject({ ...row, status: 'Offer', interview_count: 1, last_updated: first.body.last_updated, updated_at: expect.any(String) })
  await page.reload()
  await expect(control(page)).toHaveValue('Offer')
  expect(state.blocked).toEqual([])
})

test('late abandoned database write cannot undo a later confirmed change', async ({ page, context }) => {
  const state = await setup(page, context)
  await control(page).selectOption('Interview')
  const first = await operation(state, 0)
  await control(page).selectOption('Rejected')
  await first.abort()
  const second = await operation(state, 1)
  await second.respond()
  await settled(page)
  expect(first.commit()).toEqual([])
  expect(state.applications[0].status).toBe('Rejected')
  await expect(control(page)).toHaveValue('Rejected')
  await page.reload()
  await expect(control(page)).toHaveValue('Rejected')
})

test('conditional conflict re-reads current rounds and preserves concurrent unrelated edits', async ({ page, context }) => {
  const state = await setup(page, context)
  await control(page).selectOption('Interview')
  const first = await operation(state, 0)
  Object.assign(state.applications[0], { notes: 'New server note', salary: '100000', interview_count: 4, updated_at: '2026-01-02T00:00:00.000Z' })
  await first.respond()
  const retry = await operation(state, 1)
  expect(retry.body).toEqual({ status: 'Interview', last_updated: expect.any(String) })
  await retry.respond()
  await settled(page)
  expect(state.applications[0]).toMatchObject({ notes: 'New server note', salary: '100000', interview_count: 4, status: 'Interview' })
  await nav(page, 'List')
  await expect(page.locator('.detail-interviews dd')).toHaveText('4')
})

test('abandoned write committing before the later write causes a guarded retry, not a lost intent', async ({ page, context }) => {
  const state = await setup(page, context)
  await control(page).selectOption('Interview')
  const first = await operation(state, 0)
  await control(page).selectOption('Rejected')
  await first.abort()
  const second = await operation(state, 1)
  expect(first.commit()).toHaveLength(1)
  await second.respond()
  const retry = await operation(state, 2)
  await retry.respond()
  await settled(page)
  await expect(control(page)).toHaveValue('Rejected')
  expect(state.applications[0]).toMatchObject({ status: 'Rejected', interview_count: 1 })
})

test('status response merges only status fields and cannot clobber a completed full edit', async ({ page, context }) => {
  const state = await setup(page, context)
  await control(page).selectOption('Interview')
  const first = await operation(state, 0)
  first.commit()
  await nav(page, 'Edit')
  await page.getByLabel('Notes', { exact: true }).fill('Edited while status response was delayed')
  await page.getByLabel('Salary range', { exact: true }).fill('Updated salary')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/dashboard$/)
  await first.respond()
  await settled(page)
  await nav(page, 'List')
  await expect(page.locator('.notes-block')).toContainText('Edited while status response was delayed')
  await expect(page.locator('.detail-salary dd')).toHaveText('Updated salary')
  await expect(control(page)).toHaveValue(state.applications[0].status)
  expect(state.applications[0].notes).toBe('Edited while status response was delayed')
})

test('first failure does not strand a later successful requested status', async ({ page, context }) => {
  const state = await setup(page, context)
  await control(page).selectOption('Interview')
  const first = await operation(state, 0)
  await control(page).selectOption('Rejected')
  await first.fail()
  await (await operation(state, 1)).respond()
  await settled(page)
  await expect(control(page)).toHaveValue('Rejected')
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(state.applications[0].interview_count).toBe(0)
})

test('latest failure restores confirmed state, announces error and permits retry in List', async ({ page, context }) => {
  const state = await setup(page, context)
  await nav(page, 'List')
  await control(page).selectOption('Interview')
  const first = await operation(state, 0)
  await control(page).selectOption('Rejected')
  await first.respond()
  await (await operation(state, 1)).fail()
  await settled(page)
  await expect(control(page)).toHaveValue('Interview')
  await expect(page.getByRole('alert')).toContainText('Synthetic status failure')
  expect(state.applications[0].status).toBe('Interview')
  await control(page).selectOption('Rejected')
  await (await operation(state, 2)).respond()
  await settled(page)
  await expect(control(page)).toHaveValue('Rejected')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('committed write with failed response reconciles but still reports the failure', async ({ page, context }) => {
  const state = await setup(page, context)
  await control(page).selectOption('Offer')
  const first = await operation(state, 0)
  first.commit()
  await first.fail()
  await settled(page)
  await expect(control(page)).toHaveValue('Offer')
  await expect(page.getByRole('alert')).toContainText('Synthetic status failure')
  // Retrying even the reconciled same status clears the error only on success.
  await control(page).selectOption('Offer')
  await (await operation(state, 1)).respond()
  await settled(page)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('failed reconciliation is explicit and a later retry recovers', async ({ page, context }) => {
  const state = await setup(page, context)
  await control(page).selectOption('Interview')
  const first = await operation(state, 0)
  state.failStatusReads = true
  await first.fail()
  await settled(page)
  await expect(control(page)).toHaveValue('Applied')
  await expect(page.getByRole('alert')).toContainText('Could not confirm the saved status')
  state.failStatusReads = false
  await control(page).selectOption('Interview')
  await (await operation(state, 1)).respond()
  await settled(page)
  await expect(control(page)).toHaveValue('Interview')
})

test('same-status selections are no-ops; selecting original status during a pending change is not', async ({ page, context }) => {
  const state = await setup(page, context)
  await control(page).selectOption('Applied')
  expect(state.statusUpdates).toHaveLength(0)
  await control(page).selectOption('Interview')
  const first = await operation(state, 0)
  await control(page).selectOption('Interview')
  await control(page).selectOption('Applied')
  await first.respond()
  await (await operation(state, 1)).respond()
  await settled(page)
  await expect(control(page)).toHaveValue('Applied')
  expect(state.statusUpdates).toHaveLength(2)
  expect(state.applications[0].interview_count).toBe(1)
})

test('different records write independently and reverse responses preserve per-record errors', async ({ page, context }) => {
  const state = await setup(page, context, [application(1), application(2)])
  await control(page).selectOption('Interview')
  const first = await operation(state, 0)
  await control(page, 'Synthetic 2').selectOption('Offer')
  const second = await operation(state, 1)
  await second.respond()
  await expect(control(page, 'Synthetic 2')).toHaveValue('Offer')
  await first.fail()
  await settled(page)
  await expect(control(page)).toHaveValue('Applied')
  await expect(page.getByRole('alert')).toContainText('Synthetic status failure')
  await control(page, 'Synthetic 2').selectOption('Rejected')
  await (await operation(state, 2)).respond()
  await settled(page)
  await expect(page.getByRole('alert')).toContainText('Synthetic status failure')
  expect(state.applications.map((row) => row.status)).toEqual(['Applied', 'Rejected'])
})

test('conditional contention is bounded and zero-row writes are never acknowledged', async ({ page, context }) => {
  const state = await setup(page, context)
  await control(page).selectOption('Interview')
  for (let i = 0; i < 3; i += 1) {
    const next = await operation(state, i)
    state.applications[0].updated_at = `2026-02-0${i + 1}T00:00:00.000Z`
    await next.respond()
  }
  await settled(page)
  await expect(control(page)).toHaveValue('Applied')
  await expect(page.getByRole('alert')).toContainText('changed while saving')
  expect(state.applications[0].status).toBe('Applied')
})

test('missing server version fails closed without an unguarded PATCH', async ({ page, context }) => {
  const state = await setup(page, context, [application(1, { updated_at: null })])
  await control(page).selectOption('Interview')
  await settled(page)
  await expect(page.getByRole('alert')).toContainText('Cannot safely update')
  expect(state.statusUpdates).toHaveLength(0)
})

test('same-user auth refresh during a pending change does not reload stale applications', async ({ page, context }) => {
  const state = await setup(page, context)
  const listReads = () => state.requests.filter((req) => req.method === 'GET' && req.table === 'applications' && new URLSearchParams(req.query).get('select') === '*').length
  const before = listReads()
  await control(page).selectOption('Offer')
  const first = await operation(state, 0)
  await page.evaluate(async () => {
    const { supabase } = await import('/src/lib/supabase.js')
    const { error } = await supabase.auth.refreshSession()
    if (error) throw error
  })
  await first.respond()
  await settled(page)
  expect(listReads()).toBe(before)
  await expect(control(page)).toHaveValue('Offer')
})

test('delayed initial list cannot discard a successful creation', async ({ page, context }) => {
  const state = await backend(context, [application(1)])
  state.holdReads = true
  await signIn(page)
  await expect.poll(() => state.reads.length).toBe(1)
  await nav(page, 'Add application')
  await page.getByLabel('Company', { exact: false }).fill('Fresh creation')
  await page.getByLabel('Role', { exact: false }).fill('Engineer')
  await page.locator('button[type="submit"]').click()
  await expect.poll(() => state.applications.length).toBe(2)
  state.holdReads = false
  await state.reads[0]()
  await expect(page.locator('.board-card')).toHaveCount(2)
  await expect(page.getByText('Fresh creation', { exact: true })).toBeVisible()
})

test('old-session status response and queued requests cannot mutate a different user workspace', async ({ page, context }) => {
  const state = await setup(page, context)
  await control(page).selectOption('Interview')
  const first = await operation(state, 0)
  first.commit()
  await control(page).selectOption('Rejected')
  await nav(page, 'Sign out')
  const nextId = '00000000-0000-4000-8000-000000000002'
  state.user = { ...state.user, id: nextId }
  state.applications.push(application(2, { user_id: nextId, company: 'Other workspace' }))
  await signIn(page)
  await expect(control(page, 'Other workspace')).toHaveValue('Applied')
  await first.respond()
  await expect(control(page, 'Synthetic 1')).toHaveCount(0)
  await expect(page.getByText('Saving status...')).toHaveCount(0)
  expect(state.statusUpdates).toHaveLength(1)
})

test('delayed list from previous user is ignored after switching accounts', async ({ page, context }) => {
  const state = await backend(context, [application(1)])
  state.holdReads = true
  await signIn(page)
  await expect.poll(() => state.reads.length).toBe(1)
  await nav(page, 'Sign out')
  const nextId = '00000000-0000-4000-8000-000000000002'
  state.user = { ...state.user, id: nextId }
  state.applications.push(application(2, { user_id: nextId, company: 'Other workspace' }))
  state.holdReads = false
  await signIn(page)
  await expect(control(page, 'Other workspace')).toHaveValue('Applied')
  await state.reads[0]()
  await expect(control(page, 'Synthetic 1')).toHaveCount(0)
  await expect(control(page, 'Other workspace')).toHaveValue('Applied')
})

test('signing back into the same account creates a new workspace epoch', async ({ page, context }) => {
  const state = await setup(page, context)
  await control(page).selectOption('Interview')
  const first = await operation(state, 0)
  first.commit()
  await control(page).selectOption('Rejected')
  await nav(page, 'Sign out')
  Object.assign(state.applications[0], { status: 'Offer', updated_at: '2026-01-03T00:00:00.000Z' })
  await signIn(page)
  await expect(control(page)).toHaveValue('Offer')
  await first.respond()
  await expect(control(page)).toHaveValue('Offer')
  await settled(page)
  expect(state.statusUpdates).toHaveLength(1)
})

test('delayed initial getUser cannot restore a previous account after auth events', async ({ page, context }) => {
  const state = await setup(page, context)
  state.holdUsers = true
  await page.reload()
  await expect.poll(() => state.users.length).toBeGreaterThan(0)
  const nextId = '00000000-0000-4000-8000-000000000002'
  state.user = { ...state.user, id: nextId, user_metadata: { ...state.user.user_metadata, name: 'Other' } }
  state.applications.push(application(2, { user_id: nextId, company: 'Other workspace' }))
  state.holdUsers = false
  // Inject an incoming cross-tab SDK notification without starting another auth writer.
  await page.evaluate((user) => {
    const cookie = document.cookie.split(';').map((item) => decodeURIComponent(item.trim().split('=')[0])).find((name) => name.endsWith('-auth-token.chunks'))
    const channel = new BroadcastChannel(cookie.replace(/\.chunks$/, ''))
    channel.postMessage({ event: 'SIGNED_OUT', session: null })
    channel.postMessage({ event: 'SIGNED_IN', session: { user } })
    channel.close()
  }, state.user)
  await expect(page.getByText("Other's workspace", { exact: true })).toBeVisible()
  for (const respond of state.users) await respond()
  await expect(control(page, 'Synthetic 1')).toHaveCount(0)
  await expect(control(page, 'Other workspace')).toHaveValue('Applied')
})

test('initial stored session still respects a failed server getUser validation', async ({ page, context }) => {
  const state = await setup(page, context)
  state.failUsers = true
  await page.reload()
  await expect(page.getByLabel('Username')).toBeVisible()
  await expect(page.locator('.board-card')).toHaveCount(0)
})

for (const width of [1440, 768, 390]) {
  test(`pending/error controls remain usable with no overflow at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 })
    const state = await setup(page, context)
    await nav(page, 'List')
    await control(page).selectOption('Interview')
    const first = await operation(state, 0)
    await expect(control(page)).toHaveAttribute('aria-busy', 'true')
    await noOverflow(page)
    await first.fail()
    await settled(page)
    await expect(page.getByRole('alert')).toBeVisible()
    await noOverflow(page)
    await page.locator('.application-card').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `tmp/rf07-tests.local/status-error-${width}.png` })
  })
}

test('public Demo retains synchronous status/round behavior in Board and List without writes', async ({ page, context }) => {
  const state = await backend(context)
  await page.goto('/#/demo')
  const first = page.locator('.board-card select').filter({ visible: true }).first()
  // Follow the selected record after it moves to another board column.
  const card = first.locator('xpath=ancestor::article')
  const company = await card.locator('.company').textContent()
  await first.selectOption('Interview')
  await nav(page, 'List')
  await page.getByLabel('Search', { exact: true }).fill(company)
  await control(page, company).selectOption('Rejected')
  await expect(control(page, company)).toHaveValue('Rejected')
  await expect(page.locator('.detail-interviews dd')).toHaveText('1')
  expect(state.requests.filter((req) => req.method === 'PATCH')).toEqual([])
})
