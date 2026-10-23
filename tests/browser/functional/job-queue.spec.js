import { expect, test } from '@playwright/test'
import { application, backend, lead, nav, noOverflow, signIn, userId } from './fixtures.js'

async function openQueue(page) {
  await page.goto('/#/job-agent/matches')
  await expect(page.getByRole('heading', { name: 'Jobs waiting for you' })).toBeVisible({ timeout: 15000 })
}

async function removeAll(page, count, accept = true) {
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain(`Remove all ${count} jobs`)
    if (accept) await dialog.accept()
    else await dialog.dismiss()
  })
  await nav(page, 'Remove all')
}

async function deletion(state, index = 0) {
  await expect.poll(() => state.leadDeletes.length).toBe(index + 1)
  return state.leadDeletes[index]
}

for (const count of [0, 1, 499, 500, 501, 1203]) {
  test(`queue ${count}: exact counts, bounded page and all-waiting removal`, async ({ page, context }) => {
    const preserved = application(9000)
    const state = await backend(context, [preserved], [
      ...Array.from({ length: count }, (_, i) => lead(i + 1)),
      lead(9000, { state: 'applied', application_id: preserved.id }), lead(9001, { state: 'expired' }),
      lead(9002, { user_id: 'other-user' }),
    ])
    // Returned rows capped independently of exact counts, also during bulk scans.
    state.leadMaxRows = 37
    await signIn(page)
    await expect(page.getByText(`${count} jobs waiting to be applied`, { exact: true })).toBeVisible()
    await openQueue(page)
    await expect(page.getByText(`${count} waiting`, { exact: true })).toBeVisible()
    await expect(page.locator('.agent-lead')).toHaveCount(Math.min(20, count))
    if (count) {
      await expect(page.locator('.agent-lead').first()).toContainText(`Lead ${count}`)
      await removeAll(page, count)
      await expect(page.getByRole('status').filter({ hasText: 'removals confirmed' })).toContainText(`${count} removals confirmed`)
    } else await expect(page.getByRole('button', { name: 'Remove all' })).toBeDisabled()
    await expect(page.getByRole('heading', { name: 'No applications waiting' })).toBeVisible()
    expect(state.leads.map((row) => row.id)).toEqual([9000, 9001, 9002])
    expect(state.applications).toEqual([preserved])
    await page.reload()
    await expect(page.getByText('0 waiting', { exact: true })).toBeVisible()
    await nav(page, 'Dashboard')
    await expect(page.getByText('0 jobs waiting to be applied', { exact: true })).toBeVisible()
    const writes = state.requests.filter((r) => r.method === 'DELETE')
    expect(writes.every((r) => r.table === 'job_leads' && new URLSearchParams(r.query).get('state') === 'eq.new' && new URLSearchParams(r.query).get('application_id') === 'is.null')).toBe(true)
    expect(state.blocked).toEqual([])
  })
}

test('search beyond 500, literal punctuation, source filters and page reset', { tag: '@smoke' }, async ({ page, context }) => {
  const state = await backend(context, [], Array.from({ length: 1101 }, (_, i) => lead(i + 1)))
  state.leads[0].company = 'Rare %,_("job")'
  await signIn(page)
  await openQueue(page)
  await expect(page.getByText('1101 waiting', { exact: true })).toBeVisible()
  const search = page.getByLabel('Search jobs waiting to be applied')
  await search.fill('Rare %,_("job")')
  await expect(page.locator('.agent-lead')).toHaveCount(1)
  await expect(page.getByText('1 matching jobs', { exact: true })).toBeVisible()
  await search.fill('missing')
  await expect(page.getByRole('heading', { name: 'No matching jobs' })).toBeVisible()
  await expect(page.getByText('1101 waiting', { exact: true })).toBeVisible()
  await nav(page, 'Clear filters')
  await expect(page.getByText('Page 1 of 56')).toBeVisible()
  await nav(page, 'Next')
  await expect(page.getByText('Page 2 of 56')).toBeVisible()
  await page.getByRole('group', { name: 'Source', exact: true }).getByRole('button', { name: 'Indeed', exact: true }).click()
  await expect(page.getByText('Page 1 of 28')).toBeVisible()
  await expect(page.getByText('550 matching jobs', { exact: true })).toBeVisible()
  await search.fill('Rare')
  await expect(page.getByRole('heading', { name: 'No matching jobs' })).toBeVisible()
  await nav(page, 'Clear filters')
  await expect(search).toHaveValue('')
  await expect(page.getByRole('group', { name: 'Source', exact: true }).getByRole('button', { name: 'All alerts', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('empty source-filtered results are not an empty queue', async ({ page, context }) => {
  await backend(context, [], [lead(1)])
  await signIn(page)
  await openQueue(page)
  await page.getByRole('group', { name: 'Source', exact: true }).getByRole('button', { name: 'Indeed', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No matching jobs' })).toBeVisible()
  await expect(page.getByText('1 waiting', { exact: true })).toBeVisible()
  await nav(page, 'Clear filters')
  await expect(page.locator('.agent-lead')).toHaveCount(1)
})

test('cancel is write-free, filtered Remove All still uses entire queue', async ({ page, context }) => {
  const state = await backend(context, [], [lead(1), lead(2)])
  await signIn(page)
  await openQueue(page)
  await page.getByRole('group', { name: 'Source', exact: true }).getByRole('button', { name: 'Indeed', exact: true }).click()
  await expect(page.locator('.agent-lead')).toHaveCount(1)
  await removeAll(page, 2, false)
  await expect(page.getByRole('button', { name: 'Remove all' })).toBeEnabled()
  expect(state.leads).toHaveLength(2)
  expect(state.requests.filter((r) => r.method === 'DELETE')).toEqual([])
  await removeAll(page, 2)
  await expect(page.getByRole('heading', { name: 'No applications waiting' })).toBeVisible()
})

for (const mode of ['failure', 'partial', 'lost', 'invalid']) {
  test(`${mode} deletion has explicit outcome, refreshed counts and safe retry`, async ({ page, context }) => {
    const state = await backend(context, [], [lead(1), lead(2)])
    state.controlLeadDeletes = true
    await signIn(page)
    await openQueue(page)
    await expect(page.getByText('2 waiting', { exact: true })).toBeVisible()
    await removeAll(page, 2)
    const op = await deletion(state)
    if (mode === 'failure') await op.fail()
    if (mode === 'partial') { state.leadDeleteAllowedIds = [1]; await op.respond() }
    if (mode === 'lost') { op.commit(); await op.abort() }
    if (mode === 'invalid') await op.respond([{ id: 999 }])
    await expect(page.getByRole('alert')).toContainText('could not be confirmed')
    await expect(page.getByText(`${state.leads.length} waiting`, { exact: true })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'removals confirmed' })).toHaveCount(0)
    const remaining = state.leads.length
    if (remaining) {
      state.leadDeleteAllowedIds = null
      state.controlLeadDeletes = false
      await removeAll(page, remaining)
      await expect(page.getByRole('alert')).toHaveCount(0)
    }
    await expect(page.getByRole('heading', { name: 'No applications waiting' })).toBeVisible()
    await page.reload()
    await expect(page.getByText('0 waiting', { exact: true })).toBeVisible()
  })
}

test('failure after earlier batch commit reports partial progress and retry covers remaining batches', async ({ page, context }) => {
  const state = await backend(context, [], Array.from({ length: 201 }, (_, i) => lead(i + 1)))
  state.controlLeadDeletes = true
  await signIn(page)
  await openQueue(page)
  await expect(page.getByText('201 waiting', { exact: true })).toBeVisible()
  await removeAll(page, 201)
  await (await deletion(state)).respond()
  await (await deletion(state, 1)).fail()
  await expect(page.getByRole('alert')).toContainText('100 removals confirmed')
  await expect(page.getByText('101 waiting', { exact: true })).toBeVisible()
  state.controlLeadDeletes = false
  await removeAll(page, 101)
  await expect(page.getByRole('heading', { name: 'No applications waiting' })).toBeVisible()
})

test('server cap changes after scan: committed batch with truncated IDs is not fully confirmed', async ({ page, context }) => {
  const state = await backend(context, [], Array.from({ length: 100 }, (_, i) => lead(i + 1)))
  state.controlLeadDeletes = true
  await signIn(page)
  await openQueue(page)
  await expect(page.getByText('100 waiting', { exact: true })).toBeVisible()
  await removeAll(page, 100)
  const op = await deletion(state)
  state.leadMaxRows = 7
  await op.respond()
  await expect(page.getByRole('alert')).toContainText('7 removals confirmed')
  await expect(page.getByRole('alert')).toContainText('confirmations were incomplete')
  await expect(page.getByText('0 waiting', { exact: true })).toBeVisible()
  expect(state.leads).toHaveLength(0)
  await expect(page.getByRole('status').filter({ hasText: 'removals confirmed' })).toHaveCount(0)
})

test('single removal rechecks Applied state and association at commit time', async ({ page, context }) => {
  const state = await backend(context, [], [lead(1)])
  state.controlLeadDeletes = true
  await signIn(page)
  await openQueue(page)
  await expect(page.getByText('1 waiting', { exact: true })).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await nav(page, 'Remove')
  const op = await deletion(state)
  const saved = application(77)
  state.applications.push(saved)
  Object.assign(state.leads[0], { state: 'applied', application_id: saved.id })
  await op.respond()
  await expect(page.getByRole('alert')).toContainText('Removal could not be confirmed')
  await expect(page.getByText('0 waiting', { exact: true })).toBeVisible()
  expect(state.leads).toHaveLength(1)
  expect(state.applications).toEqual([saved])
})

test('Dashboard count failure is explicit rather than a fabricated zero', async ({ page, context }) => {
  const state = await backend(context, [], [lead(1)])
  state.omitLeadCount = true
  await signIn(page)
  await expect(page.getByRole('alert')).toContainText('Job queue count unavailable')
  await expect(page.getByText('0 jobs waiting to be applied', { exact: true })).toHaveCount(0)
  state.omitLeadCount = false
  await page.reload()
  await expect(page.getByText('1 jobs waiting to be applied', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('conversion wins pending DELETE and new arrival survives snapshot boundary', async ({ page, context }) => {
  const state = await backend(context, [], [lead(1), lead(2)])
  state.controlLeadDeletes = true
  await signIn(page)
  await openQueue(page)
  await expect(page.getByText('2 waiting', { exact: true })).toBeVisible()
  await removeAll(page, 2)
  const op = await deletion(state)
  const saved = application(44)
  state.applications.push(saved)
  Object.assign(state.leads[0], { state: 'applied', application_id: saved.id })
  state.leads.push(lead(3))
  await op.respond()
  await expect(page.getByRole('status').filter({ hasText: 'removals confirmed' })).toContainText('1 removals confirmed')
  await expect(page.getByText('1 waiting', { exact: true })).toBeVisible()
  expect(state.leads.map((row) => row.id)).toEqual([1, 3])
  expect(state.applications).toEqual([saved])
  await page.reload()
  await expect(page.locator('.agent-lead')).toHaveCount(1)
  await expect(page.locator('.agent-lead')).toContainText('Lead 3')
})

test('stale New association is protected, not reported as removed', async ({ page, context }) => {
  const saved = application(44)
  const state = await backend(context, [saved], [lead(1, { application_id: saved.id })])
  await signIn(page)
  await openQueue(page)
  await expect(page.getByText('1 waiting', { exact: true })).toBeVisible()
  await removeAll(page, 1)
  await expect(page.getByRole('alert')).toContainText('0 removals confirmed')
  expect(state.applications).toEqual([saved])
  expect(state.leads).toHaveLength(1)
})

test('duplicate actions and remount share pending lock; late failures do not leak feedback', async ({ page, context }) => {
  const state = await backend(context, [], [lead(1), lead(2)])
  state.controlLeadDeletes = true
  await signIn(page)
  await openQueue(page)
  await expect(page.getByText('2 waiting', { exact: true })).toBeVisible()
  await removeAll(page, 2)
  const op = await deletion(state)
  await expect(page.getByRole('button', { name: 'Remove all' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Finished applying' }).first()).toBeDisabled()
  await nav(page, 'Dashboard')
  await expect(page.getByRole('heading', { name: 'Your application pipeline' })).toBeVisible()
  await openQueue(page)
  await expect(page.getByRole('button', { name: 'Remove all' })).toBeDisabled()
  await op.fail()
  await expect(page.getByRole('button', { name: 'Remove all' })).toBeEnabled()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(state.leadDeletes).toHaveLength(1)
})

for (const sameAccount of [false, true]) {
  test(`old bulk response cannot affect ${sameAccount ? 're-signed-in' : 'different-user'} session or issue more batches`, async ({ page, context }) => {
    const state = await backend(context, [], Array.from({ length: 201 }, (_, i) => lead(i + 1)))
    state.controlLeadDeletes = true
    await signIn(page)
    await openQueue(page)
    await expect(page.getByText('201 waiting', { exact: true })).toBeVisible()
    await removeAll(page, 201)
    const old = await deletion(state)
    await nav(page, 'Sign out')
    const nextId = sameAccount ? userId : '00000000-0000-4000-8000-000000000002'
    state.user = { ...state.user, id: nextId }
    if (!sameAccount) state.leads.push(lead(1000, { user_id: nextId }))
    await page.getByLabel('Username').fill('auditor')
    await page.getByLabel('Password', { exact: true }).fill('synthetic-password')
    await page.locator('button[type="submit"]').click()
    await expect(page.getByRole('heading', { name: 'Your application pipeline' })).toBeVisible()
    await openQueue(page)
    await expect(page.getByText(`${sameAccount ? 201 : 1} waiting`, { exact: true })).toBeVisible()
    await removeAll(page, sameAccount ? 201 : 1)
    const current = await deletion(state, 1)
    await old.respond()
    await expect(page.getByRole('button', { name: 'Remove all' })).toBeDisabled()
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(state.leadDeletes).toHaveLength(2)
    state.controlLeadDeletes = false
    await current.respond()
    await expect(page.getByRole('button', { name: 'Remove all' })).toBeDisabled()
    await expect(page.getByText('0 waiting', { exact: true })).toBeVisible()
    expect(state.leads.filter((row) => row.user_id === nextId)).toHaveLength(0)
  })
}

for (const failure of ['read', 'count', 'cap']) {
  test(`unavailable ${failure} never claims queue empty; reload recovers`, async ({ page, context }) => {
    const state = await backend(context, [], Array.from({ length: 30 }, (_, i) => lead(i + 1)))
    await signIn(page)
    if (failure === 'read') state.failLeadReads = true
    if (failure === 'count') state.omitLeadCount = true
    if (failure === 'cap') state.leadMaxRows = 7
    await openQueue(page)
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'No applications waiting' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Remove all' })).toBeDisabled()
    state.failLeadReads = state.omitLeadCount = false
    state.leadMaxRows = 1000
    await nav(page, 'Reload queue')
    await expect(page.getByText('30 waiting', { exact: true })).toBeVisible()
  })
}

test('delayed old filter response cannot replace the latest page', async ({ page, context }) => {
  const state = await backend(context, [], Array.from({ length: 30 }, (_, i) => lead(i + 1)))
  await signIn(page)
  await openQueue(page)
  await expect(page.locator('.agent-lead')).toHaveCount(20)
  state.controlLeadReads = true
  await page.getByLabel('Search jobs waiting to be applied').fill('missing')
  await expect.poll(() => state.leadReads.length).toBe(1)
  await page.getByLabel('Search jobs waiting to be applied').fill('Lead 30')
  await expect.poll(() => state.leadReads.length).toBe(2)
  await state.leadReads[1].respond()
  await expect(page.locator('.agent-lead')).toHaveCount(1)
  await state.leadReads[0].respond()
  await expect(page.locator('.agent-lead')).toContainText('Lead 30')
  await expect(page.getByRole('heading', { name: 'No matching jobs' })).toHaveCount(0)
})

test('removing last record on last page clamps pagination and updates Dashboard count', async ({ page, context }) => {
  await backend(context, [], Array.from({ length: 21 }, (_, i) => lead(i + 1)))
  await signIn(page)
  await openQueue(page)
  await nav(page, 'Next')
  await expect(page.getByText('Page 2 of 2')).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await nav(page, 'Remove')
  await expect(page.locator('.agent-lead')).toHaveCount(20)
  await expect(page.getByText('20 waiting', { exact: true })).toBeVisible()
  await expect(page.getByText('Page 2 of 2')).toHaveCount(0)
  await nav(page, 'Dashboard')
  await expect(page.getByText('20 jobs waiting to be applied', { exact: true })).toBeVisible()
})

for (const width of [1440, 768, 390]) {
  test(`Demo and Real queue workflows stay responsive at ${width}px`, async ({ page, context }, info) => {
    const state = await backend(context, [], [lead(1)])
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    await openQueue(page)
    await expect(page.getByText('1 waiting', { exact: true })).toBeVisible()
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath(`real-${width}.png`), fullPage: true })
    const beforeDemo = state.requests.length
    await page.goto('/#/demo/job-agent/matches')
    await expect(page.locator('.agent-lead')).toHaveCount(3)
    await page.getByLabel('Search jobs waiting to be applied').fill('missing')
    await expect(page.getByRole('heading', { name: 'No matching jobs' })).toBeVisible()
    await nav(page, 'Clear filters')
    await removeAll(page, 3, false)
    await expect(page.locator('.agent-lead')).toHaveCount(3)
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath(`demo-${width}.png`), fullPage: true })
    await removeAll(page, 3)
    await expect(page.getByRole('heading', { name: 'No applications waiting' })).toBeVisible()
    expect(state.requests.slice(beforeDemo)).toEqual([])
    expect(state.blocked).toEqual([])
  })
}
