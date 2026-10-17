import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {
  application,
  backend,
  closeDetails,
  nav,
  noOverflow,
  openDetails,
  signIn,
} from './fixtures.js'

const rows = () => [
  application(1, { status: 'Interview', interview_count: 0, applied_date: '2026-01-01' }),
  application(2, { status: 'Offer', interview_count: 4, applied_date: '2026-01-01' }),
  application(3, {
    status: 'Rejected',
    interview_count: 2,
    applied_date: '2026-01-01',
    rejected_date: '2026-01-01',
  }),
  application(4, { status: 'Rejected', applied_date: '2026-01-01', last_updated: '2099-01-01' }),
  application(5, {
    applied_date: '2026-01-01',
    company: 'A long synthetic company that wraps within its calendar cell',
  }),
]

for (const width of [390, 640, 768, 900, 1039, 1040, 1440]) {
  test(`UI-03: metrics, accessible Map/Calendar and responsive geometry at ${width}px`, async ({
    page,
    context,
  }) => {
    test.setTimeout(60000)
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const state = await backend(context, rows())
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    await nav(page, 'Progress')
    await expect(page.locator('.progress-summary strong')).toHaveText(['5', '6', '3', '1'])
    const mobile = await page.evaluate(() => matchMedia('(width < 640px)').matches)
    if (mobile) {
      await expect(page.locator('.progress-chart')).toHaveCount(0)
      await expect(page.locator('.compact-progress-row strong')).toHaveText([
        '3',
        '1',
        '1',
        '1',
        '1',
        '1',
      ])
    } else {
      await expect(page.locator('.progress-node-count')).toHaveText([
        '5',
        '3',
        '1',
        '1',
        '1',
        '1',
        '1',
      ])
      const labels = await page.locator('.progress-chart').evaluate((el) => {
        const r = el.getBoundingClientRect()
        return [...el.querySelectorAll('text')].map((t) => {
          const b = t.getBoundingClientRect()
          return {
            inside:
              b.left >= r.left - 1 &&
              b.right <= r.right + 1 &&
              b.top >= r.top - 1 &&
              b.bottom <= r.bottom + 1,
            text: t.textContent,
          }
        })
      })
      expect(labels.filter((l) => !l.inside)).toEqual([])
    }
    await expect(page.locator('.progress-conversion-row strong')).toHaveText(['60%', '33%', '80%'])
    await expect(page.locator('.progress-week strong')).toHaveText(['0', '0', '0', '0', '0', '5'])
    await noOverflow(page)
    const mapAxe = await new AxeBuilder({ page })
      .include('.progress-workspace')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    expect(mapAxe.violations).toEqual([])
    await nav(page, 'Calendar')
    await expect(page.locator('.calendar-range p')).toHaveText('6 events this week')
    if (mobile) await page.getByRole('button', { name: 'Show 3 more', exact: true }).click()
    await expect(page.locator('.calendar-event-rejected')).toHaveCount(1)
    const geometry = await page.locator('.calendar-grid').evaluate((el) => ({
      columns: getComputedStyle(el).gridTemplateColumns.split(' ').length,
      min: getComputedStyle(el).minWidth,
      desktop: matchMedia('(width >= 1040px)').matches,
    }))
    expect(geometry.columns).toBe(mobile ? 1 : geometry.desktop ? 7 : 4)
    expect(geometry.min).toBe('0px')
    const next = page.getByRole('button', { name: 'Next week', exact: true })
    await next.scrollIntoViewIfNeeded()
    await page.getByRole('button', { name: 'Previous week', exact: true }).focus()
    await page.keyboard.press('Tab')
    await expect(next).toBeFocused()
    await expect(next).toHaveCSS('outline-style', 'solid')
    await page.keyboard.press('Enter')
    await expect(page.locator('.calendar-range p')).toHaveText('0 events this week')
    await nav(page, 'Previous week')
    await expect(page.locator('.calendar-range p')).toHaveText('6 events this week')
    if (mobile) await page.getByRole('button', { name: 'Show 3 more', exact: true }).click()
    await expect(page.locator('.calendar-day li em')).toHaveText([
      'Applied',
      'Applied',
      'Applied',
      'Applied',
      'Rejected',
      'Applied',
    ])
    await noOverflow(page)
    const calendarAxe = await new AxeBuilder({ page })
      .include('.progress-workspace')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    expect(calendarAxe.violations).toEqual([])
    expect(errors).toEqual([])
    expect(state.blocked).toEqual([])
    expect(
      state.requests.filter(
        (r) => ['POST', 'PATCH', 'DELETE'].includes(r.method) && !['token'].includes(r.table),
      ),
    ).toEqual([])
  })
}

test('UI-03: chart focus/hover reveals the real node and branch values; widths conserve flow', async ({
  page,
  context,
}) => {
  await backend(context, rows())
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await signIn(page)
  await nav(page, 'Progress')
  await expect(
    page.getByRole('group', {
      name: 'Application flow: 5 applications, 3 reached an interview, and 1 received an offer.',
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Pipeline map', exact: true }).focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(page.locator('.progress-flow-link').first()).toBeFocused()
  const node = page.locator('.progress-flow-node[aria-label="Reached interview: 3 applications"]')
  await node.focus()
  await expect(page.locator('.progress-inspection')).toHaveText('Reached interview: 3 applications')
  const link = page.locator(
    '.progress-flow-link[aria-label="Applications to Reached interview: 3 applications"]',
  )
  await link.focus()
  await expect(page.locator('.progress-inspection')).toHaveText(
    'Applications to Reached interview: 3 applications',
  )
  await expect(link).toHaveCSS('stroke-opacity', '0.7')
  await node.hover()
  await expect(page.locator('.progress-inspection')).toHaveText('Reached interview: 3 applications')
  const conservation = await page.locator('.progress-chart').evaluate((el) => {
    const root = el.querySelector(
      '.progress-flow-node[aria-label="Applications: 5 applications"] rect',
    )
    const links = [...el.querySelectorAll('.progress-flow-link')].filter((p) =>
      p.getAttribute('aria-label').startsWith('Applications to '),
    )
    return {
      height: Number(root.getAttribute('height')),
      sum: links.reduce((s, p) => s + Number(p.getAttribute('stroke-width')), 0),
    }
  })
  expect(conservation.sum).toBeCloseTo(conservation.height, 5)
})

test('UI-03: an outstanding canonical deletion refreshes the focused inspection value', async ({
  page,
  context,
}) => {
  const state = await backend(context, rows())
  state.controlDeletes = true
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await signIn(page)
  await openDetails(page)
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete application', exact: true })
    .click()
  await expect.poll(() => state.deletes.length).toBe(1)
  await closeDetails(page)
  await nav(page, 'Progress')
  await page.locator('.progress-flow-node[aria-label="Applications: 5 applications"]').focus()
  await expect(page.locator('.progress-inspection')).toHaveText('Applications: 5 applications')
  await state.deletes[0].respond()
  await expect(page.locator('.progress-summary strong').first()).toHaveText('4')
  await expect(page.locator('.progress-inspection')).toHaveText('Applications: 4 applications')
  expect(state.blocked).toEqual([])
})

for (const status of ['Applied', 'Offer', 'Rejected']) {
  test(`UI-03: sparse ${status} dataset has no phantom branches or non-finite geometry`, async ({
    page,
    context,
  }) => {
    await backend(context, [application(1, { status })])
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await signIn(page)
    await nav(page, 'Progress')
    await expect(page.locator('.progress-node-count')).toHaveText(
      status === 'Offer' ? ['1', '1', '1'] : ['1', '1'],
    )
    await expect(page.locator('.progress-summary strong')).toHaveText(
      status === 'Offer' ? ['1', '0', '1', '1'] : ['1', '0', '0', '0'],
    )
    const markup = await page.locator('.progress-chart').innerHTML()
    expect(markup).not.toMatch(/NaN|Infinity/)
    await nav(page, 'Calendar')
    await expect(page.locator('.calendar-event-rejected')).toHaveCount(0)
    await noOverflow(page)
  })
}

test('UI-03: normal motion ends at canonical values; reduced motion stays local across Demo navigation', async ({
  page,
  context,
}) => {
  const state = await backend(context)
  await page.goto('/#/demo/progress')
  await expect(page.locator('.progress-summary strong').first()).toHaveAttribute('aria-label', '6')
  await expect(page.locator('.progress-summary strong')).toHaveText(['6', '5', '3', '1'])
  const motion = await page
    .locator('.progress-flow-link')
    .first()
    .evaluate((el) => getComputedStyle(el).animationDuration)
  expect(motion).toBe('0.7s')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await nav(page, 'Calendar')
  const durations = await page
    .locator('.progress-workspace')
    .evaluate((el) => el.getAnimations({ subtree: true }).map((a) => a.effect.getTiming().duration))
  expect(durations.every((n) => n <= 1)).toBe(true)
  await nav(page, 'Dashboard')
  await nav(page, 'Progress')
  await expect(page.locator('.progress-summary strong')).toHaveText(['6', '5', '3', '1'])
  expect(state.requests).toEqual([])
  expect(state.blocked).toEqual([])
})

test('UI-03: fractional responsive boundaries follow CSS, including live viewport changes', async ({
  page,
  context,
}) => {
  await backend(context, rows())
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await context.route('http://127.0.0.1:5195/progress-frame', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<iframe title="Progress fractional viewport" style="width:639.5px;height:900px;border:0" src="/#/sign-in"></iframe>',
    }),
  )
  await page.goto('/progress-frame')
  const frame = page.frames().find((f) => f !== page.mainFrame())
  await signIn(frame)
  await nav(frame, 'Progress')
  for (const width of [639.5, 640.5, 1039.5, 1040.5]) {
    await page.locator('iframe').evaluate((el, w) => (el.style.width = `${w}px`), width)
    const mobile = await frame.evaluate(() => matchMedia('(width < 640px)').matches)
    await expect(frame.locator('.compact-progress-list')).toHaveCount(mobile ? 1 : 0)
    await nav(frame, 'Calendar')
    await noOverflow(frame)
    await nav(frame, 'Pipeline map')
  }
})
