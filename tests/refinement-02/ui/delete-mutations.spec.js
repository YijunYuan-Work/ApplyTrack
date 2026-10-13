import { expect, test } from '@playwright/test'
import { application, backend, nav, noOverflow, signIn, userId } from './fixtures.js'

const card = (page, company) => page.locator('.application-card').filter({ has: page.getByText(company, { exact: true }) })
const selected = (page, count) => expect(page.getByText(`${count} selected`, { exact: true })).toBeVisible()
const error = (page) => page.getByRole('alert')
const busy = (page) => page.getByRole('status').filter({ hasText: 'Deleting applications...' })
async function setup(page, context, rows = [application(1), application(2)]) {
  const state = await backend(context, rows)
  state.controlDeletes = true
  await signIn(page)
  await nav(page, 'List')
  return state
}
async function operation(state, index = 0) {
  await expect.poll(() => state.deletes.length).toBe(index + 1)
  return state.deletes[index]
}
async function select(page, company) {
  const item = card(page, company)
  if (!await item.getByRole('checkbox').isChecked()) await item.locator('.card-select').click()
}
async function startBulk(page) {
  page.once('dialog', (dialog) => dialog.accept())
  await nav(page, 'Delete selected')
}
async function startSingle(page, company) {
  page.once('dialog', (dialog) => dialog.accept())
  await card(page, company).getByRole('button', { name: 'Delete', exact: true }).click()
}

for (const view of ['Board', 'List']) {
  test(`bulk cancellation preserves exact selection and never requests DELETE in ${view}`, async ({ page, context }) => {
    const state = await setup(page, context)
    await nav(page, view)
    await nav(page, 'Enter multi-select')
    await nav(page, 'Select all')
    await selected(page, 2)
    page.once('dialog', (dialog) => dialog.dismiss())
    await nav(page, 'Delete selected')
    await expect(busy(page)).toHaveCount(0)
    await selected(page, 2)
    expect(state.requests.filter((r) => r.method === 'DELETE')).toEqual([])
    expect(state.applications).toHaveLength(2)
  })
}

test('bulk failure keeps checked records; retry deletes exact IDs and clears the error', async ({ page, context }) => {
  const state = await setup(page, context, [application(1), application(2), application(3, { notes: 'Keep me', salary: '100000' })])
  await nav(page, 'Enter multi-select')
  await select(page, 'Synthetic 1')
  await select(page, 'Synthetic 2')
  await startBulk(page)
  const first = await operation(state)
  const query = new URLSearchParams(first.query)
  expect(query.get('user_id')).toBe(`eq.${userId}`)
  expect(query.get('select')).toBe('id')
  expect(query.get('id')).toBe('in.(1,2)')
  await first.fail()
  await expect(error(page)).toContainText('Synthetic delete failure')
  await expect(error(page)).toContainText('Reload to check')
  await selected(page, 2)
  await expect(card(page, 'Synthetic 1').getByRole('checkbox')).toBeChecked()
  await expect(card(page, 'Synthetic 2').getByRole('checkbox')).toBeChecked()
  await startBulk(page)
  await (await operation(state, 1)).respond()
  await expect(busy(page)).toHaveCount(0)
  await expect(error(page)).toHaveCount(0)
  await selected(page, 0)
  await expect(page.locator('.application-card')).toHaveCount(1)
  expect(state.applications).toEqual([application(3, { notes: 'Keep me', salary: '100000' })])
  await page.reload()
  await expect(page.getByText('Synthetic 3', { exact: true })).toBeVisible()
  await expect(page.getByText('Synthetic 1', { exact: true })).toHaveCount(0)
  expect(state.blocked).toEqual([])
})

test('selected single-record cancellation/failure preserve selection; success clears only that ID', async ({ page, context }) => {
  const state = await setup(page, context)
  await nav(page, 'Enter multi-select')
  await nav(page, 'Select all')
  page.once('dialog', (dialog) => dialog.dismiss())
  await card(page, 'Synthetic 1').getByRole('button', { name: 'Delete', exact: true }).click()
  await selected(page, 2)
  expect(state.deletes).toEqual([])
  await startSingle(page, 'Synthetic 1')
  await (await operation(state)).fail()
  await expect(error(page)).toContainText('Synthetic delete failure')
  await selected(page, 2)
  await startSingle(page, 'Synthetic 1')
  await (await operation(state, 1)).respond()
  await expect(card(page, 'Synthetic 1')).toHaveCount(0)
  await selected(page, 1)
  await expect(card(page, 'Synthetic 2').getByRole('checkbox')).toBeChecked()
  await expect(error(page)).toHaveCount(0)
  expect(state.applications).toEqual([application(2)])
})

test('selection changes during pending deletion keep newly selected unrelated IDs; duplicate attempts are ignored', async ({ page, context }) => {
  const state = await setup(page, context)
  await nav(page, 'Enter multi-select')
  await select(page, 'Synthetic 1')
  let confirmations = 0
  page.on('dialog', async (dialog) => { confirmations += 1; await dialog.accept() })
  await nav(page, 'Delete selected')
  const first = await operation(state)
  await expect(busy(page)).toBeVisible()
  await select(page, 'Synthetic 2')
  await card(page, 'Synthetic 1').locator('.card-select').click()
  await selected(page, 1)
  await expect(page.getByRole('button', { name: 'Delete selected', exact: true })).toBeDisabled()
  await expect(card(page, 'Synthetic 2').getByRole('button', { name: 'Delete', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Delete selected', exact: true }).evaluate((button) => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await first.respond()
  await expect(busy(page)).toHaveCount(0)
  await selected(page, 1)
  await expect(card(page, 'Synthetic 2').getByRole('checkbox')).toBeChecked()
  expect(confirmations).toBe(1)
  expect(state.deletes).toHaveLength(1)
  expect(state.applications).toEqual([application(2)])
})

test('filtered paginated List selection snapshots delete only original selected IDs', async ({ page, context }) => {
  const state = await setup(page, context, Array.from({ length: 20 }, (_, i) => application(i + 1)))
  await nav(page, 'Enter multi-select')
  await select(page, 'Synthetic 20')
  await page.getByRole('button', { name: 'Next', exact: true }).first().click()
  await select(page, 'Synthetic 10')
  await startBulk(page)
  const first = await operation(state)
  await page.getByLabel('Search', { exact: true }).fill('Synthetic 3')
  await select(page, 'Synthetic 3')
  await first.respond()
  await selected(page, 1)
  await expect(card(page, 'Synthetic 3').getByRole('checkbox')).toBeChecked()
  expect(state.applications.map((r) => r.id)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1).filter((id) => ![20, 10].includes(id)))
})

for (const failure of [false, true]) {
  test(`navigation/remount during DELETE preserves destination and blocks duplicates; old ${failure ? 'error' : 'success'} stays scoped`, async ({ page, context }) => {
    const state = await setup(page, context)
    await startSingle(page, 'Synthetic 1')
    const first = await operation(state)
    await nav(page, 'Progress')
    if (failure) {
      await nav(page, 'Dashboard')
      await nav(page, 'List')
      await expect(card(page, 'Synthetic 2').getByRole('button', { name: 'Delete', exact: true })).toBeDisabled()
      await nav(page, 'Progress')
      await first.fail()
      await nav(page, 'Dashboard')
      await nav(page, 'List')
      await expect(card(page, 'Synthetic 1')).toBeVisible()
      await expect(error(page)).toHaveCount(0)
      await expect(busy(page)).toHaveCount(0)
    } else {
      await first.respond()
      await expect(page.locator('.progress-summary article').first().locator('strong')).toHaveText('1')
      await expect(page).toHaveURL(/progress$/)
      await nav(page, 'Dashboard')
      await expect(page.getByText('Synthetic 1', { exact: true })).toHaveCount(0)
    }
  })
}

test('late confirmed removal also prunes selection in a remounted Dashboard without losing other IDs', async ({ page, context }) => {
  const state = await setup(page, context)
  await startSingle(page, 'Synthetic 1')
  const first = await operation(state)
  await nav(page, 'Progress')
  await nav(page, 'Dashboard')
  await nav(page, 'List')
  await nav(page, 'Enter multi-select')
  await nav(page, 'Select all')
  await selected(page, 2)
  await first.respond()
  await expect(card(page, 'Synthetic 1')).toHaveCount(0)
  await selected(page, 1)
  await expect(card(page, 'Synthetic 2').getByRole('checkbox')).toBeChecked()
  await startBulk(page)
  const next = await operation(state, 1)
  expect(new URLSearchParams(next.query).get('id')).toBe('in.(2)')
  await next.respond()
  await selected(page, 0)
})

for (const [sameAccount, failed] of [[false, false], [true, false], [false, true]]) {
  test(`old ${failed ? 'failed' : 'successful'} DELETE cannot mutate ${sameAccount ? 're-signed-in' : 'other'} workspace or unlock its pending deletion`, async ({ page, context }) => {
    const state = await setup(page, context)
    await startSingle(page, 'Synthetic 1')
    const first = await operation(state)
    await nav(page, 'Sign out')
    const nextId = sameAccount ? userId : '00000000-0000-4000-8000-000000000002'
    state.user = { ...state.user, id: nextId }
    state.applications.push(application(3, { user_id: nextId, company: 'Current workspace' }))
    await signIn(page)
    await nav(page, 'List')
    await nav(page, 'Enter multi-select')
    await select(page, 'Current workspace')
    await startSingle(page, 'Current workspace')
    const second = await operation(state, 1)
    if (failed) await first.fail()
    else await first.respond()
    await expect(card(page, 'Current workspace').getByRole('button', { name: 'Delete', exact: true })).toBeDisabled()
    await expect(error(page)).toHaveCount(0)
    await second.respond()
    await expect(busy(page)).toHaveCount(0)
    await selected(page, 0)
    await expect(card(page, 'Current workspace')).toHaveCount(0)
    if (!sameAccount) await expect(page.getByText('Synthetic 2', { exact: true })).toHaveCount(0)
    expect(state.applications).toEqual(failed ? [application(1), application(2)] : [application(2)])
  })
}

for (const allowed of [[], [1]]) {
  test(`zero/partial RLS-style DELETE result (${allowed.length} rows) never acknowledges complete success`, async ({ page, context }) => {
    const state = await setup(page, context)
    state.deleteAllowedIds = allowed
    await nav(page, 'Enter multi-select')
    await nav(page, 'Select all')
    await startBulk(page)
    await (await operation(state)).respond()
    await expect(error(page)).toContainText('did not confirm deletion of every requested application')
    await selected(page, 2)
    await expect(page.locator('.application-card')).toHaveCount(2)
    expect(state.applications.map((row) => row.id)).toEqual([1, 2].filter((id) => !allowed.includes(id)))
    await expect(page.getByRole('button', { name: 'Delete selected', exact: true })).toBeEnabled()
  })
}

for (const response of [null, [{ id: 999 }], [{ id: 1 }, { id: 1 }]]) {
  test(`invalid DELETE confirmation ${JSON.stringify(response)} preserves records and selection`, async ({ page, context }) => {
    const state = await setup(page, context)
    await nav(page, 'Enter multi-select')
    await nav(page, 'Select all')
    await startBulk(page)
    await (await operation(state)).respond(response)
    await expect(error(page)).toContainText('could not be confirmed')
    await selected(page, 2)
    expect(state.applications).toHaveLength(2)
  })
}

test('committed DELETE with lost HTTP response stays explicit; retry zero rows is not false success', async ({ page, context }) => {
  const state = await setup(page, context, [application(1)])
  await nav(page, 'Enter multi-select')
  await nav(page, 'Select all')
  await startBulk(page)
  const first = await operation(state)
  first.commit()
  await first.abort()
  await expect(error(page)).toContainText('Deletion could not be confirmed')
  await selected(page, 1)
  await expect(card(page, 'Synthetic 1')).toBeVisible()
  expect(state.applications).toHaveLength(0)
  await startBulk(page)
  await (await operation(state, 1)).respond()
  await expect(error(page)).toContainText('did not confirm deletion of every requested application')
  await selected(page, 1)
  await page.reload()
  await expect(page.getByText('Synthetic 1', { exact: true })).toHaveCount(0)
})

for (const bulk of [false, true]) {
  test(`Demo ${bulk ? 'bulk' : 'single'} cancellation preserves selection and success deletes only intended samples`, async ({ page, context }) => {
    const state = await backend(context)
    await page.goto('/#/demo')
    await nav(page, 'List')
    await nav(page, 'Enter multi-select')
    await select(page, 'Northstar Labs')
    await select(page, 'Brightline Health')
    page.once('dialog', (dialog) => dialog.dismiss())
    if (bulk) await nav(page, 'Delete selected')
    else await card(page, 'Northstar Labs').getByRole('button', { name: 'Delete', exact: true }).click()
    await selected(page, 2)
    if (bulk) await startBulk(page)
    else await startSingle(page, 'Northstar Labs')
    await expect(card(page, 'Northstar Labs')).toHaveCount(0)
    await selected(page, bulk ? 0 : 1)
    await expect(page.locator('.application-card')).toHaveCount(bulk ? 4 : 5)
    expect(state.requests.filter((r) => r.method === 'DELETE')).toEqual([])
  })
}

test('delayed status response cannot resurrect a deleted record or disturb unrelated data', async ({ page, context }) => {
  const state = await setup(page, context)
  state.controlStatus = true
  await page.getByRole('combobox', { name: 'Status for Synthetic 1', exact: true }).filter({ visible: true }).selectOption('Interview')
  await expect.poll(() => state.statusUpdates.length).toBe(1)
  state.statusUpdates[0].commit()
  await startSingle(page, 'Synthetic 1')
  await (await operation(state)).respond()
  await expect(card(page, 'Synthetic 1')).toHaveCount(0)
  await state.statusUpdates[0].respond()
  await expect(card(page, 'Synthetic 2')).toBeVisible()
  await expect(error(page)).toHaveCount(0)
  expect(state.applications).toEqual([application(2)])
  await page.reload()
  await expect(page.getByText('Synthetic 1', { exact: true })).toHaveCount(0)
})

test('full edit response after deletion cannot restore its old snapshot', async ({ page, context }) => {
  const state = await setup(page, context)
  state.controlSaves = true
  await card(page, 'Synthetic 1').getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Pending edit')
  await page.locator('button[type="submit"]').click()
  await expect.poll(() => state.saves.length).toBe(1)
  state.saves[0].commit()
  await nav(page, 'Dashboard')
  await nav(page, 'List')
  await startSingle(page, 'Synthetic 1')
  await (await operation(state)).respond()
  await expect(card(page, 'Synthetic 1')).toHaveCount(0)
  await state.saves[0].respond()
  await expect(card(page, 'Synthetic 2')).toBeVisible()
  await expect(error(page)).toHaveCount(0)
  expect(state.applications).toEqual([application(2)])
})

test('pending deletion leaves unrelated editing usable and preserves newly saved fields', async ({ page, context }) => {
  const state = await setup(page, context)
  await startSingle(page, 'Synthetic 1')
  const first = await operation(state)
  await card(page, 'Synthetic 2').getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Keep the new note')
  await page.getByLabel('Salary range').fill('130000')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/dashboard$/)
  await first.respond()
  await nav(page, 'List')
  await expect(page.locator('.notes-block p')).toHaveText('Keep the new note')
  await expect(page.locator('.detail-salary dd')).toHaveText('130000')
  expect(state.applications[0]).toMatchObject({ id: 2, notes: 'Keep the new note', salary: '130000' })
  expect(state.applications).toHaveLength(1)
})

for (const width of [1440, 768, 390]) {
  test(`deletion pending/error feedback remains usable and announced at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 })
    const state = await setup(page, context, [application(1)])
    await nav(page, 'Enter multi-select')
    await nav(page, 'Select all')
    await startBulk(page)
    const first = await operation(state)
    await expect(busy(page)).toBeVisible()
    await noOverflow(page)
    await first.fail()
    await expect(error(page)).toContainText('Synthetic delete failure')
    await selected(page, 1)
    await noOverflow(page)
    await page.screenshot({ path: `tmp/rf09-tests.local/delete-error-${width}.png`, fullPage: true })
  })
}
