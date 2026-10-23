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
import { expectAccessiblePage } from './accessibility.js'

for (const width of [1440, 768, 390]) {
  test(`Dashboard: Dashboard geometry, details, focus and full editor at ${width}px`, async ({
    page,
    context,
  }, info) => {
    test.setTimeout(60000)
    const state = await backend(context, [
      application(1, { notes: '  Literal notes\nReferral: No  ', rejected_date: '2025-12-31' }),
    ])
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    const mode = await page.evaluate(() => ({
      mobile: matchMedia('(width < 640px)').matches,
      desktop: matchMedia('(width >= 1040px)').matches,
    }))
    const geometry = await page.locator('.board-columns').evaluate((el) => ({
      columns: getComputedStyle(el).gridTemplateColumns.split(' ').length,
      visible: [...el.children].filter((child) => getComputedStyle(child).display !== 'none')
        .length,
    }))
    expect(geometry.columns).toBe(mode.mobile ? 1 : mode.desktop ? 4 : 2)
    expect(geometry.visible).toBe(mode.mobile ? 1 : 4)
    await expect(page.locator('.dashboard-header h1')).toHaveCSS(
      'font-size',
      mode.mobile ? '25px' : '30px',
    )
    await expect(page.locator('.metric-card-total strong')).toHaveText('1')
    await noOverflow(page)
    await page.locator('.app-content').evaluate(async (root) => {
      const finite = root.getAnimations({ subtree: true }).filter((animation) =>
        Number.isFinite(animation.effect.getTiming().iterations),
      )
      await Promise.all(finite.map((animation) => animation.finished.catch(() => {})))
    })
    const dashboardAccessibility = await new AxeBuilder({ page })
      .include('.dashboard-workspace')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    expect(dashboardAccessibility.violations).toEqual([])
    await expectAccessiblePage(page)
    const opener = page.getByRole('button', { name: 'View details for Synthetic 1', exact: true })
    await opener.focus()
    await page.keyboard.press('Enter')
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    await expect(drawer).toHaveAccessibleName('Engineer')
    await expect(drawer.getByRole('button', { name: 'Close application details' })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(
      drawer.getByRole('button', { name: 'Delete application', exact: true }),
    ).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(drawer.locator('.notes-block p')).toHaveText('  Literal notes\nReferral: No  ')
    await expect(drawer.locator('.detail-rejected dd')).toHaveText('2025-12-31')
    await drawer.getByRole('button', { name: 'Delete application', exact: true }).focus()
    await page.keyboard.press('Tab')
    await expect(drawer.getByRole('button', { name: 'Close application details' })).toBeFocused()
    await page.screenshot({ path: info.outputPath(`drawer-${width}.png`) })
    const accessibility = await new AxeBuilder({ page })
      .include('.application-drawer')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    expect(accessibility.violations).toEqual([])
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)
    await expect(opener).toBeFocused()
    await nav(page, 'List')
    await openDetails(page)
    await closeDetails(page)
    await nav(page, 'Edit')
    await expect(page.getByRole('heading', { name: 'Edit application', exact: true })).toBeVisible()
    for (const name of [
      'company',
      'role',
      'location',
      'status',
      'date',
      'followUp',
      'interviewCount',
      'jobUrl',
      'contact',
      'salary',
      'coverLetter',
      'referral',
      'notes',
    ]) {
      await expect(page.locator(`.application-form [name="${name}"]`)).toBeVisible()
      const field = page.locator(`.application-form [name="${name}"]`)
      await field.focus()
      await field.scrollIntoViewIfNeeded()
      const hittable = await field.evaluate((el) => {
        const r = el.getBoundingClientRect()
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
        return { hit: el.contains(hit), rect: r.toJSON(), target: hit?.tagName, classes: hit?.className }
      })
      expect(hittable.hit, `${name} must not be covered by navigation or actions: ${JSON.stringify(hittable)}`).toBe(true)
    }
    await noOverflow(page)
    const formAccessibility = await new AxeBuilder({ page })
      .include('.application-editor')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    expect(formAccessibility.violations).toEqual([])
    await expectAccessiblePage(page)
    await page.screenshot({ path: info.outputPath(`editor-${width}.png`), fullPage: true })
    expect(state.blocked).toEqual([])
    expect(state.requests.filter((r) => r.table === 'applications' && r.method !== 'GET')).toEqual(
      [],
    )
  })
}

test('Dashboard: fractional viewports retain the visible Board selection scope without overflow', async ({
  page,
  context,
}, info) => {
  const rows = Array.from({ length: 8 }, (_, i) =>
    application(i + 1, {
      status: ['Applied', 'Interview', 'Offer', 'Rejected'][i % 4],
      company: `A long synthetic company ${i + 1}`,
      role: 'A long application role that wraps without losing access to details',
    }),
  )
  const state = await backend(context, rows)
  await context.route('http://127.0.0.1:5195/ui2-frame', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<iframe title="Synthetic fractional dashboard" style="width:639.5px;height:900px;border:0" src="/#/sign-in"></iframe>',
    }),
  )
  await page.goto('/ui2-frame')
  const frame = page.frames().find((frame) => frame !== page.mainFrame())
  await signIn(frame)
  await nav(frame, 'Enter multi-select')
  const evidence = []
  for (const width of [639.5, 640.5, 767.5, 899.5, 1039.5, 1040.5, 1180.5]) {
    await page.locator('iframe').evaluate((el, width) => {
      el.style.width = `${width}px`
    }, width)
    const mobile = await frame.evaluate(() => matchMedia('(width < 640px)').matches)
    await expect(frame.locator('.board-card').filter({ visible: true })).toHaveCount(mobile ? 2 : 8)
    await nav(frame, 'Select all')
    await expect(frame.getByText(`${mobile ? 2 : 8} selected`, { exact: true })).toBeVisible()
    await nav(frame, 'Unselect all')
    await expect(frame.getByText('0 selected', { exact: true })).toBeVisible()
    await noOverflow(frame)
    evidence.push({ width, mobile })
  }
  await info.attach('fractional-board-scope', {
    body: JSON.stringify(evidence),
    contentType: 'application/json',
  })
  await nav(frame, 'Exit multi-select')
  await nav(frame, 'List')
  for (const width of [1279.5, 1280.5]) {
    await page.locator('iframe').evaluate((el, w) => (el.style.width = w + 'px'), width)
    const wide = await frame.evaluate(() => matchMedia('(width >= 1280px)').matches)
    await expect(frame.locator('.application-card .list-location').first()).toBeVisible({ visible: wide })
    await expect(frame.locator('.application-card .list-interviews').first()).toBeVisible({ visible: wide })
    await expect(frame.locator('.application-card')).toHaveCount(8)
    await noOverflow(frame)
  }
  await openDetails(frame)
  for (const width of [639.5, 640.5, 1039.5, 1040.5]) {
    await page.locator('iframe').evaluate((el, w) => (el.style.width = w + 'px'), width)
    const mode = await frame.evaluate(() => ({
      mobile: matchMedia('(width < 640px)').matches,
      desktop: matchMedia('(width >= 1040px)').matches,
      // clientWidth is integer-rounded; fixed drawers fill the fractional CSS viewport.
      width: getComputedStyle(document.documentElement).width,
    }))
    await expect(frame.getByRole('dialog')).toHaveCSS('width', mode.mobile ? mode.width : (mode.desktop ? 440 : 400) + 'px')
    await noOverflow(frame)
  }
  await closeDetails(frame)
  expect(state.blocked).toEqual([])
})

test('Dashboard: drawer keeps canonical status through pending, error, retry and confirmed transition', async ({
  page,
  context,
}) => {
  const state = await backend(context, [application(1)])
  state.controlStatus = true
  await signIn(page)
  await openDetails(page)
  const drawer = page.getByRole('dialog')
  const interview = drawer.getByRole('button', { name: 'Interview', exact: true })
  await interview.click()
  await expect.poll(() => state.statusUpdates.length).toBe(1)
  await expect(interview).toHaveAttribute('aria-pressed', 'false')
  await expect(drawer.getByRole('button', { name: 'Applied', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(drawer.getByRole('status')).toHaveText('Saving status...')
  await state.statusUpdates[0].fail()
  await expect(drawer.getByRole('alert')).toContainText('Synthetic status failure')
  await expect(interview).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.application-notification')).toHaveCount(0)
  await interview.click()
  await expect.poll(() => state.statusUpdates.length).toBe(2)
  await state.statusUpdates[1].respond()
  await expect(interview).toHaveAttribute('aria-pressed', 'true')
  await expect(drawer.locator('.detail-interviews dd')).toHaveText('1')
  await expect(drawer.locator('.detail-applied dd')).toHaveText(application(1).applied_date)
  await closeDetails(page)
  await expect(page.locator('.application-notification')).toHaveText(
    'Synthetic 1 moved to Interview',
  )
  expect(state.applications[0].status).toBe('Interview')
  expect(state.blocked).toEqual([])
})

test('Dashboard: session changes remove private drawer content and ignore late status responses', async ({
  page,
  context,
}) => {
  const state = await backend(context, [application(1, { notes: 'Previous account private note' })])
  state.controlStatus = true
  await signIn(page)
  await openDetails(page)
  await page.getByRole('dialog').getByRole('button', { name: 'Offer', exact: true }).click()
  await expect.poll(() => state.statusUpdates.length).toBe(1)
  await page.evaluate(async () => {
    const { supabase } = await import('/src/lib/supabase.js')
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.notes-block')).toHaveCount(0)
  const otherId = '00000000-0000-4000-8000-000000000002'
  state.user = { ...state.user, id: otherId }
  state.applications.push(application(2, { user_id: otherId, company: 'Other workspace' }))
  await signIn(page)
  await state.statusUpdates[0].respond()
  await expect(page.getByText('Other workspace', { exact: true })).toBeVisible()
  await expect(page.getByText('Previous account private note', { exact: true })).toHaveCount(0)
  await expect(page.locator('.application-notification')).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  expect(state.blocked).toEqual([])
})

test('Dashboard: drawer deletion preserves confirmation, cancellation, failure and retry', async ({
  page,
  context,
}) => {
  const state = await backend(context, [application(1)])
  state.controlDeletes = true
  await signIn(page)
  await openDetails(page)
  const drawer = page.getByRole('dialog')
  const remove = drawer.getByRole('button', { name: 'Delete application', exact: true })
  page.once('dialog', (dialog) => dialog.dismiss())
  await remove.click()
  await expect(drawer).toBeVisible()
  expect(state.deletes).toHaveLength(0)
  page.once('dialog', (dialog) => dialog.accept())
  await remove.click()
  await expect.poll(() => state.deletes.length).toBe(1)
  await expect(remove).toBeDisabled()
  await state.deletes[0].fail()
  await expect(drawer.getByRole('alert')).toContainText('Synthetic delete failure')
  await expect(drawer).toContainText('Synthetic 1')
  page.once('dialog', (dialog) => dialog.accept())
  await remove.click()
  await expect.poll(() => state.deletes.length).toBe(2)
  await state.deletes[1].respond()
  await expect(drawer).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Board', exact: true })).toBeFocused()
  expect(state.applications).toEqual([])
})

for (const width of [1440, 768, 390]) {
  test(`Dashboard: reduced-motion Demo drawer and editing stay local at ${width}px`, async ({
    page,
    context,
  }) => {
    const state = await backend(context)
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/#/demo')
    await openDetails(page)
    const drawer = page.getByRole('dialog')
    await drawer.getByRole('button', { name: 'Interview', exact: true }).click()
    await expect(drawer.getByRole('button', { name: 'Interview', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const animations = await drawer.evaluate((el) =>
      el.getAnimations().map((a) => Number(a.effect.getTiming().duration)),
    )
    expect(animations.every((duration) => duration <= 1)).toBe(true)
    await drawer.getByRole('button', { name: 'Edit application', exact: true }).click()
    await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Demo drawer edit')
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await nav(page, 'List')
    await page.getByLabel('Search', { exact: true }).fill('Demo drawer edit')
    await openDetails(page)
    await expect(drawer.locator('.notes-block p')).toHaveText('Demo drawer edit')
    await closeDetails(page)
    await noOverflow(page)
    expect(state.requests).toEqual([])
    expect(state.blocked).toEqual([])
  })
}
