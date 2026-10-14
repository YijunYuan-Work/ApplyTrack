import { expect, test } from '@playwright/test'
import { application, backend, nav, noOverflow, signIn } from './fixtures.js'

const statuses = ['Applied', 'Interview', 'Offer', 'Rejected']
const mixedRows = () => Array.from({ length: 25 }, (_, i) => application(i + 1, { status: statuses[i % 4] }))
const selected = (page, count) => expect(page.getByText(`${count} selected`, { exact: true })).toBeVisible()
const listCard = (page, company) => page.locator('.application-card').filter({ has: page.getByText(company, { exact: true }) })
const visibleBoard = (page) => page.locator('.board-card').filter({ visible: true })

async function noToolbarOverlap(page) {
  const boxes = await page.locator('.tracker-control-bar').evaluate((toolbar) =>
    [...toolbar.querySelectorAll('button, input, select, .bulk-toolbar > span')].map((control) => {
      const { left, right, top, bottom } = control.getBoundingClientRect()
      return { left, right, top, bottom }
    }),
  )
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i], b = boxes[j]
      expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true)
    }
  }
}

async function stage(page, status) {
  await page.locator('.board-stage-tabs').getByRole('button', { name: new RegExp(`^${status} `) }).click()
}

async function cancelDelete(page, count) {
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain(`Delete ${count} selected`)
    await dialog.dismiss()
  })
  await nav(page, 'Delete selected')
  await selected(page, count)
}

async function pendingDelete(page, state, index = 0) {
  page.once('dialog', (dialog) => dialog.accept())
  await nav(page, 'Delete selected')
  await expect.poll(() => state.deletes.length).toBe(index + 1)
  return state.deletes[index]
}

function deleteIds(operation) {
  return new URLSearchParams(operation.query).get('id').slice(4, -1).split(',').map(Number).sort((a, b) => a - b)
}

for (const width of [1440, 901, 900, 899, 768, 390]) {
  test(`Board scope matches actual visible stages at ${width}px`, async ({ page, context }, info) => {
    const rows = mixedRows()
    const state = await backend(context, rows)
    state.controlDeletes = true
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    const viewport = await page.evaluate(() => ({
      innerWidth, clientWidth: document.documentElement.clientWidth,
      mediaWidth: matchMedia('(max-width: 900px)').matches,
      dpr: devicePixelRatio, visualWidth: visualViewport.width,
      columns: [...document.querySelectorAll('.board-column')].map((column) => ({
        label: column.getAttribute('aria-label'), display: getComputedStyle(column).display,
      })),
    }))
    console.log(JSON.stringify({ browser: info.project.name, requestedWidth: width, ...viewport }))
    await info.attach('selection-viewport', { body: JSON.stringify(viewport), contentType: 'application/json' })
    const displayedColumnCount = viewport.columns.filter((column) => column.display !== 'none').length
    expect(displayedColumnCount).toBe(viewport.mediaWidth ? 1 : 4)
    if (width !== 900) expect(viewport.mediaWidth).toBe(width < 900)
    const scope = displayedColumnCount === 4 ? rows : rows.filter((row) => row.status === 'Applied')
    await expect(visibleBoard(page)).toHaveCount(scope.length)
    await nav(page, 'Enter multi-select')
    await nav(page, 'Select all')
    await selected(page, scope.length)
    await expect(page.getByRole('button', { name: 'Unselect all', exact: true })).toBeEnabled()
    await cancelDelete(page, scope.length)
    expect(state.deletes).toEqual([])
    await noOverflow(page)
    await noToolbarOverlap(page)
    await page.screenshot({ path: info.outputPath(`board-selection-${width}.png`), fullPage: true })
    const op = await pendingDelete(page, state)
    expect(deleteIds(op)).toEqual(scope.map((row) => row.id).sort((a, b) => a - b))
    await op.respond()
    await selected(page, 0)
    expect(state.applications.map((row) => row.id)).toEqual(rows.filter((row) => !scope.includes(row)).map((row) => row.id))
    expect(state.blocked).toEqual([])
  })
}

test('List bulk toggles only the current page, preserves other pages, and respects page size', async ({ page, context }) => {
  await backend(context, Array.from({ length: 25 }, (_, i) => application(i + 1)))
  await signIn(page)
  await expect(visibleBoard(page)).toHaveCount(25)
  await nav(page, 'List')
  await expect(page.locator('.application-card')).toHaveCount(10)
  await nav(page, 'Enter multi-select')
  await nav(page, 'Select all')
  await selected(page, 10)
  await expect(page.locator('.application-card input[type="checkbox"]:checked')).toHaveCount(10)
  await page.getByRole('button', { name: 'Next', exact: true }).first().click()
  await expect(page.getByText('Page 2 of 3').first()).toBeVisible()
  await nav(page, 'Select all')
  await selected(page, 20)
  await nav(page, 'Unselect all')
  await selected(page, 10)
  await expect(page.locator('.application-card input[type="checkbox"]:checked')).toHaveCount(0)
  await page.getByRole('button', { name: 'Previous', exact: true }).first().click()
  await expect(page.locator('.application-card input[type="checkbox"]:checked')).toHaveCount(10)
  await nav(page, 'Unselect all')
  await selected(page, 0)
  await page.getByRole('combobox', { name: 'Per page' }).first().selectOption('5')
  await nav(page, 'Select all')
  await selected(page, 5)
  await page.getByRole('combobox', { name: 'Per page' }).first().selectOption('20')
  await expect(page.locator('.application-card')).toHaveCount(20)
  await selected(page, 5)
  await nav(page, 'Select all')
  await selected(page, 20)
  await nav(page, 'Unselect all')
  await selected(page, 0)
})

test('switching List/Board deduplicates selection and unselects only each view scope', async ({ page, context }) => {
  await backend(context, Array.from({ length: 25 }, (_, i) => application(i + 1)))
  await signIn(page)
  await expect(visibleBoard(page)).toHaveCount(25)
  await nav(page, 'List')
  await expect(page.locator('.application-card')).toHaveCount(10)
  await nav(page, 'Enter multi-select')
  await page.getByRole('button', { name: 'Next', exact: true }).first().click()
  await nav(page, 'Select all')
  await selected(page, 10)
  await nav(page, 'Board')
  await nav(page, 'Select all')
  await selected(page, 25)
  await nav(page, 'List')
  await expect(page.getByText('Page 1 of 3').first()).toBeVisible()
  await expect(page.locator('.application-card input[type="checkbox"]:checked')).toHaveCount(10)
  await nav(page, 'Unselect all')
  await selected(page, 15)
  await nav(page, 'Board')
  await nav(page, 'Select all')
  await selected(page, 25)
  await nav(page, 'Unselect all')
  await selected(page, 0)
})

test('search/filter/sort changes retain valid hidden selections without broadening bulk scope', async ({ page, context }) => {
  const rows = Array.from({ length: 25 }, (_, i) => application(i + 1, {
    company: i < 12 ? `Group A ${i + 1}` : `Group B ${i + 1}`,
    status: i % 2 ? 'Interview' : 'Applied', last_updated: i < 12 ? '2026-02-01' : '2026-03-01',
  }))
  const state = await backend(context, rows)
  state.controlDeletes = true
  await signIn(page)
  await nav(page, 'Enter multi-select')
  await page.getByLabel('Search', { exact: true }).fill('Group A')
  await expect(visibleBoard(page)).toHaveCount(12)
  await nav(page, 'Select all')
  await selected(page, 12)
  await page.getByLabel('Search', { exact: true }).fill('Group B')
  await selected(page, 12)
  await nav(page, 'Select all')
  await selected(page, 25)
  await nav(page, 'Unselect all')
  await selected(page, 12)
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('Interview')
  await expect(page.locator('.application-card')).toHaveCount(6)
  await selected(page, 12)
  await nav(page, 'Select all')
  await selected(page, 18)
  await page.getByRole('combobox', { name: 'Sort', exact: true }).selectOption('lastUpdated')
  await nav(page, 'Unselect all')
  await selected(page, 12)
  await page.getByLabel('Search', { exact: true }).fill('no-such-record')
  await expect(page.getByRole('button', { name: 'Select all', exact: true })).toBeDisabled()
  await selected(page, 12)
  await cancelDelete(page, 12)
  const op = await pendingDelete(page, state)
  expect(deleteIds(op)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1))
  await op.fail()
  await selected(page, 12)
  await nav(page, 'Exit multi-select')
  await expect(page.getByText('12 selected', { exact: true })).toHaveCount(0)
  await nav(page, 'Clear filters')
  await nav(page, 'Enter multi-select')
  await selected(page, 0)
})

test('mobile stage switches retain selection; empty stage cannot select hidden applications', async ({ page, context }) => {
  const state = await backend(context, [application(1), application(2), application(3, { status: 'Interview' })])
  await page.setViewportSize({ width: 390, height: 900 })
  await signIn(page)
  await nav(page, 'Enter multi-select')
  await nav(page, 'Select all')
  await selected(page, 2)
  await stage(page, 'Interview')
  await expect(visibleBoard(page)).toHaveCount(1)
  await nav(page, 'Select all')
  await selected(page, 3)
  await nav(page, 'Unselect all')
  await selected(page, 2)
  await stage(page, 'Offer')
  await expect(visibleBoard(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Select all', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Exit multi-select' })).toBeEnabled()
  await cancelDelete(page, 2)
  await stage(page, 'Applied')
  await nav(page, 'Unselect all')
  await selected(page, 0)
  expect(state.requests.filter((r) => r.method === 'DELETE')).toEqual([])
})

test('live viewport changes use the CSS 900/901 boundary without clearing selection', async ({ page, context }) => {
  const rows = mixedRows()
  await backend(context, rows)
  await signIn(page)
  await nav(page, 'Enter multi-select')
  await nav(page, 'Select all')
  await selected(page, 25)
  await page.setViewportSize({ width: 899, height: 900 })
  await expect(visibleBoard(page)).toHaveCount(7)
  await nav(page, 'Unselect all')
  await selected(page, 18)
  await stage(page, 'Interview')
  await expect(visibleBoard(page)).toHaveCount(6)
  await nav(page, 'Unselect all')
  await selected(page, 12)
  await page.setViewportSize({ width: 901, height: 900 })
  await expect(visibleBoard(page)).toHaveCount(25)
  await nav(page, 'Select all')
  await selected(page, 25)
  await page.setViewportSize({ width: 390, height: 900 })
  await expect(visibleBoard(page)).toHaveCount(6)
  await nav(page, 'Unselect all')
  await selected(page, 19)
  await nav(page, 'Clear')
  await selected(page, 0)
})

test('confirmed status change changes stage scope, not the selected record identity', async ({ page, context }) => {
  const state = await backend(context, [application(1), application(2), application(3, { status: 'Interview' })])
  state.controlStatus = true
  await page.setViewportSize({ width: 768, height: 900 })
  await signIn(page)
  await nav(page, 'Enter multi-select')
  await nav(page, 'Select all')
  await selected(page, 2)
  await page.getByRole('combobox', { name: 'Status for Synthetic 1', exact: true }).filter({ visible: true }).selectOption('Interview')
  await expect.poll(() => state.statusUpdates.length).toBe(1)
  await state.statusUpdates[0].respond()
  await expect(visibleBoard(page)).toHaveCount(1)
  await selected(page, 2)
  await nav(page, 'Unselect all')
  await selected(page, 1)
  await stage(page, 'Interview')
  await nav(page, 'Select all')
  await selected(page, 2)
  await nav(page, 'List')
  await expect(listCard(page, 'Synthetic 1').getByRole('checkbox')).toBeChecked()
  await expect(listCard(page, 'Synthetic 3').getByRole('checkbox')).toBeChecked()
  await expect(listCard(page, 'Synthetic 2').getByRole('checkbox')).not.toBeChecked()
})

test('pending Board deletion retains newer stage selection; failure, cancel and retry preserve exact IDs', async ({ page, context }) => {
  const rows = [application(1), application(2), application(3, { status: 'Interview' }), application(4, { status: 'Offer' })]
  const state = await backend(context, rows)
  state.controlDeletes = true
  await page.setViewportSize({ width: 390, height: 900 })
  await signIn(page)
  await nav(page, 'Enter multi-select')
  await nav(page, 'Select all')
  const first = await pendingDelete(page, state)
  expect(deleteIds(first)).toEqual([1, 2])
  await stage(page, 'Interview')
  await nav(page, 'Select all')
  await selected(page, 3)
  await expect(page.getByRole('button', { name: 'Delete selected' })).toBeDisabled()
  await first.respond()
  await selected(page, 1)
  await expect(page.getByRole('button', { name: 'Unselect all' })).toBeEnabled()
  await cancelDelete(page, 1)
  const second = await pendingDelete(page, state, 1)
  expect(deleteIds(second)).toEqual([3])
  await second.fail()
  await expect(page.getByRole('alert')).toContainText('Synthetic delete failure')
  await selected(page, 1)
  const retry = await pendingDelete(page, state, 2)
  expect(deleteIds(retry)).toEqual([3])
  await retry.respond()
  await selected(page, 0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Select all', exact: true })).toBeDisabled()
  expect(state.applications).toEqual([rows[3]])
})

for (const width of [1440, 768, 390]) {
  test(`Demo scope and selection retention match Real at ${width}px without backend requests`, async ({ page, context }, info) => {
    const state = await backend(context)
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/#/demo')
    await expect(visibleBoard(page)).toHaveCount(width > 900 ? 6 : 2)
    await nav(page, 'Enter multi-select')
    await nav(page, 'Select all')
    await selected(page, width > 900 ? 6 : 2)
    if (width <= 900) {
      await stage(page, 'Interview')
      await nav(page, 'Select all')
      await selected(page, 3)
    }
    await nav(page, 'List')
    if (width <= 900) await nav(page, 'Select all')
    await selected(page, 6)
    await expect(page.locator('.application-card input[type="checkbox"]:checked')).toHaveCount(6)
    await cancelDelete(page, 6)
    await nav(page, 'Unselect all')
    await selected(page, 0)
    await nav(page, 'Board')
    await page.getByLabel('Search', { exact: true }).fill('Northstar')
    await expect(visibleBoard(page)).toHaveCount(width > 900 ? 1 : 0)
    if (width <= 900) await stage(page, 'Applied')
    await nav(page, 'Select all')
    await selected(page, 1)
    await noOverflow(page)
    await noToolbarOverlap(page)
    await page.screenshot({ path: info.outputPath(`demo-selection-${width}.png`), fullPage: true })
    page.once('dialog', (dialog) => dialog.accept())
    await nav(page, 'Delete selected')
    await selected(page, 0)
    await nav(page, 'Clear filters')
    await nav(page, 'List')
    await expect(page.locator('.application-card')).toHaveCount(5)
    await expect(page.getByText('Northstar Labs', { exact: true })).toHaveCount(0)
    expect(state.requests).toEqual([])
    expect(state.blocked).toEqual([])
  })
}
