import { test, expect } from '@playwright/test'
import { demoApplications } from '../../../src/data/applications.js'
import { toApplicationRow } from '../../../src/data/applicationRows.js'
import { application, backend, nav, noOverflow, signIn } from './fixtures.js'

const day = (page, date) => page.locator('.calendar-day').filter({ has: page.locator(`time[datetime="${date}"]`) })
const totals = (page) => page.locator('.progress-summary strong')

for (const width of [1440, 768, 390]) {
  test(`G03: Real/Demo Progress parity and rendered outcomes/calendar at ${width}px`, { tag: width === 768 ? ['@smoke'] : [] }, async ({ page, context }, info) => {
    const state = await backend(context, demoApplications.map((row) => ({ ...toApplicationRow(row, '00000000-0000-4000-8000-000000000001'), id: row.id })))
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    await nav(page, 'Progress')
    await expect(page.locator('.progress-summary')).toBeVisible({ timeout: 15000 })
    await expect(totals(page)).toHaveText(['6', '5', '3', '1'])
    if (width < 640) {
      await expect(page.locator('.compact-progress-row > div')).toHaveText([
        'Reached interview3', 'No interview yet2', 'Rejected before interview1', 'Offers1', 'Still in progress1', 'Rejected after interview1',
      ])
      await expect(page.locator('.compact-progress-row small')).toHaveText([
        '50% of applications', '33% of applications', '17% of applications',
        '17% of applications', '17% of applications', '17% of applications',
      ])
    } else {
      await expect(page.getByRole('group', { name: 'Application flow: 6 applications, 3 reached an interview, and 1 received an offer.' })).toBeVisible()
      await expect(page.locator('.progress-node-count')).toHaveText(['6', '3', '1', '1', '1', '2', '1'])
      await expect(page.locator('.recharts-sankey-link')).toHaveCount(6)
    }
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath(`progress-map-${width}.png`), fullPage: true })
    await nav(page, 'Calendar')
    await expect(page.locator('.calendar-range')).toContainText('June 28, 2026 - July 4, 2026')
    await expect(page.locator('.calendar-range p')).toHaveText('3 events this week')
    await expect(day(page, '2026-07-01').locator('li')).toHaveText(['RejectedAtlas CommerceSoftware Developer'])
    const realCalendar = await page.locator('.calendar-grid').textContent()
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath(`progress-calendar-${width}.png`), fullPage: true })
    const previousRequests = state.requests.length
    await page.goto('/#/demo/progress')
    await expect(totals(page)).toHaveText(['6', '5', '3', '1'])
    await nav(page, 'Calendar')
    await expect(page.locator('.calendar-grid')).toHaveText(realCalendar)
    expect(state.requests.length).toBe(previousRequests)
    expect(state.blocked).toEqual([])
  })
}

test('G03: invalid dates do not crash Progress or choose a phantom latest week', async ({ page, context }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await backend(context, [application(1, { applied_date: '2024-02-29' }),
    application(2, { applied_date: 'zzzz', status: 'Rejected', rejected_date: '9999-99-99' }),
    application(3, { applied_date: '2024-02-30', last_updated: '2024-02-30' }),
    application(4, { applied_date: null })])
  await signIn(page)
  await nav(page, 'Progress')
  await expect(totals(page)).toHaveText(['4', '0', '0', '0'])
  await nav(page, 'Calendar')
  await expect(page.locator('.calendar-range')).toContainText('February 25, 2024 - March 2, 2024')
  await expect(page.locator('.calendar-range p')).toHaveText('1 events this week')
  await expect(day(page, '2024-02-29').locator('li')).toHaveCount(1)
  expect(errors).toEqual([])
})

test('G03: year/month navigation and Applied plus Rejected on the same local day', async ({ page, context }) => {
  await backend(context, [application(1, { applied_date: '2025-12-31', status: 'Rejected', rejected_date: '2026-01-01' }),
    application(2, { applied_date: '2026-01-01', status: 'Rejected', rejected_date: '2026-01-01' }),
    application(3, { applied_date: '2026-01-04' })])
  await signIn(page)
  await nav(page, 'Progress')
  await nav(page, 'Calendar')
  await expect(page.locator('.calendar-range')).toContainText('January 4, 2026 - January 10, 2026')
  await expect(page.locator('.calendar-range p')).toHaveText('1 events this week')
  await nav(page, 'Previous week')
  await expect(page.locator('.calendar-range')).toContainText('December 28, 2025 - January 3, 2026')
  await expect(page.locator('.calendar-range p')).toHaveText('4 events this week')
  await expect(day(page, '2026-01-01').locator('li em')).toHaveText(['Rejected', 'Applied', 'Rejected'])
  await nav(page, 'Next week')
  await expect(page.locator('.calendar-range p')).toHaveText('1 events this week')
})

test('G03: undated nonempty dataset uses local today and empty dataset preserves the empty state', async ({ page, context }) => {
  await page.clock.setFixedTime(new Date('2026-01-04T12:00:00Z'))
  const state = await backend(context, [application(1, { applied_date: null })])
  await signIn(page)
  await nav(page, 'Progress')
  await nav(page, 'Calendar')
  await expect(page.locator('.calendar-range')).toContainText('January 4, 2026 - January 10, 2026')
  await expect(page.locator('.calendar-range p')).toHaveText('0 events this week')
  state.applications = []
  await page.reload()
  await expect(totals(page)).toHaveText(['0', '0', '0', '0'])
  await expect(page.getByText('No applications to show yet.', { exact: true })).toBeVisible()
})

test('G03: phone day expansion reveals all events without changing totals', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await backend(context, Array.from({ length: 5 }, (_, index) => application(index + 1, { applied_date: '2024-02-29' })))
  await signIn(page)
  await nav(page, 'Progress')
  await nav(page, 'Calendar')
  const leapDay = day(page, '2024-02-29')
  await expect(page.locator('.calendar-range p')).toHaveText('5 events this week')
  await expect(leapDay.locator('li:has(em)')).toHaveCount(3)
  await leapDay.getByRole('button').click()
  await expect(leapDay.locator('li:has(em)')).toHaveCount(5)
  await leapDay.getByRole('button').click()
  await expect(leapDay.locator('li:has(em)')).toHaveCount(3)
  await noOverflow(page)
})
