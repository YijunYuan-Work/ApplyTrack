import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { expectAccessiblePage } from './accessibility.js'
import { backend, lead, nav, noOverflow, signIn, userId } from './fixtures.js'

const sampleMessages = [
  {
    id: 2,
    user_id: userId,
    provider: 'linkedin',
    received_at: '2026-07-22T08:00:00Z',
    status: 'completed',
    jobs_found: 3,
    jobs_created: 2,
  },
  {
    id: 1,
    user_id: userId,
    provider: 'indeed',
    received_at: '2026-07-21T08:00:00Z',
    status: 'completed',
    jobs_found: 1,
    jobs_created: 1,
  },
]
const long =
  'A deliberately long synthetic company and location that must remain completely readable '

async function openQueue(page) {
  await page.goto('/#/job-agent/matches')
  await expect(page.locator('.agent-lead')).not.toHaveCount(0)
}

async function inboxService(context, initial = null) {
  const service = { row: initial, writes: [], pending: [], hold: false, failRead: false }
  await context.route('**/rest/v1/job_alert_inboxes?*', async (route) => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    if (method === 'GET' || method === 'HEAD') {
      if (service.failRead)
        return route.fulfill({ status: 500, json: { message: 'Synthetic inbox read failure' } })
      const user = url.searchParams.get('user_id')?.slice(3)
      const row = service.row?.user_id === user ? service.row : null
      return route.fulfill({ json: row })
    }
    const body = request.postDataJSON()
    service.writes.push({ method, body, query: url.search })
    const target = service.row
    const respond = () => {
      if (method === 'POST')
        service.row ??= {
          id: 1,
          user_id: body.user_id,
          enabled: true,
          address_alias: 'b'.repeat(32),
          last_received_at: null,
        }
      else if (target && url.searchParams.get('id') === `eq.${target.id}`)
        Object.assign(target, body)
      return route.fulfill({ json: method === 'POST' ? null : target })
    }
    if (service.hold) {
      service.pending.push({
        respond,
        fail: () =>
          route.fulfill({ status: 500, json: { message: 'Synthetic inbox write failure' } }),
      })
      return
    }
    return respond()
  })
  return service
}

test('Job Agent: opening the original posting does not claim submission or change the queue', async ({
  page,
  context,
}) => {
  const state = await backend(context, [], [lead(1)])
  await context.route('https://www.linkedin.com/jobs/view/1', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Synthetic external posting</h1>' }),
  )
  await signIn(page)
  await openQueue(page)
  const opened = page.waitForEvent('popup')
  await page.getByRole('link', { name: 'View on LinkedIn', exact: true }).click()
  const posting = await opened
  await expect(posting.getByRole('heading', { name: 'Synthetic external posting' })).toBeVisible()
  expect(posting.url()).toBe('https://www.linkedin.com/jobs/view/1')
  await posting.close()
  await expect(page.locator('.agent-lead')).toHaveCount(1)
  expect(state.applications).toEqual([])
  expect(state.requests.filter((r) => r.table === 'complete_job_lead_application')).toEqual([])
  expect(state.blocked).toEqual([])
})

test('Job Agent: failed inbox creation keeps setup retryable and prevents duplicate requests', async ({
  page,
  context,
}) => {
  await backend(context)
  const service = await inboxService(context)
  service.hold = true
  await signIn(page)
  await page.goto('/#/job-agent')
  await nav(page, 'Create forwarding address')
  await expect.poll(() => service.pending.length).toBe(1)
  await expect(page.getByRole('button', { name: 'Creating...', exact: true })).toBeDisabled()
  expect(service.writes).toHaveLength(1)
  await service.pending[0].fail()
  await expect(page.getByRole('alert')).toContainText('Synthetic inbox write failure')
  await expect(page.locator('.agent-forwarding-address')).toHaveCount(0)
  service.hold = false
  await nav(page, 'Create forwarding address')
  await expect(page.locator('.agent-forwarding-address')).toBeVisible()
  expect(service.writes).toHaveLength(2)
})

test('Job Agent: old clipboard completion cannot mark a replacement address as copied', async ({
  page,
  context,
}) => {
  await backend(context)
  await page.goto('/#/demo/job-agent')
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () =>
          new Promise((resolve) => {
            window.finishOldCopy = resolve
          }),
      },
    }),
  )
  await nav(page, 'Copy')
  page.once('dialog', (dialog) => dialog.accept())
  await nav(page, 'Replace address')
  await expect(page.locator('.agent-forwarding-address strong')).toHaveText(
    'new-demo-alerts@inbound.applytrack.app',
  )
  await page.evaluate(() => window.finishOldCopy())
  await expect(page.getByRole('button', { name: 'Copy', exact: true })).toBeVisible()
  await expect(
    page.getByRole('status').filter({ hasText: 'Forwarding address copied.' }),
  ).toHaveCount(0)
})

test('Job Agent: an old inbox response cannot replace a different user connection or announce success', async ({
  page,
  context,
}) => {
  const state = await backend(context)
  const service = await inboxService(context, state.inbox)
  service.hold = true
  await signIn(page)
  await page.goto('/#/job-agent')
  await nav(page, 'Pause imports')
  await expect.poll(() => service.pending.length).toBe(1)
  await nav(page, 'Sign out')
  const nextId = '00000000-0000-4000-8000-000000000002'
  state.user = { ...state.user, id: nextId }
  service.row = { id: 2, user_id: nextId, address_alias: 'c'.repeat(32), enabled: true }
  await signIn(page)
  await page.goto('/#/job-agent')
  await expect(page.locator('.agent-forwarding-address strong')).toContainText('c'.repeat(32))
  await service.pending[0].respond()
  await expect(page.getByText('Imports active', { exact: true })).toBeVisible()
  await expect(page.locator('.agent-page-notice')).toHaveCount(0)
  await expect(page.locator('.agent-forwarding-address strong')).toContainText('c'.repeat(32))
  expect(service.row.enabled).toBe(true)
})

test('Job Agent: fractional CSS breakpoints and live resizing keep all card actions in bounds', async ({
  page,
  context,
}) => {
  await backend(context)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await context.route('http://127.0.0.1:5195/agent-frame', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<iframe title="Job Agent fractional viewport" style="width:639.5px;height:900px;border:0" src="/#/demo/job-agent/matches"></iframe>',
    }),
  )
  await page.goto('/agent-frame')
  const frame = page.frames().find((f) => f !== page.mainFrame())
  await expect(frame.locator('.agent-lead')).toHaveCount(3)
  for (const width of [639.5, 640.5, 1039.5, 1040.5]) {
    await page.locator('iframe').evaluate((el, w) => (el.style.width = `${w}px`), width)
    await expect
      .poll(() =>
        frame
          .locator('.agent-lead')
          .first()
          .evaluate((el) => {
            const columns = getComputedStyle(el).gridTemplateColumns.split(' ').length
            return (
              columns ===
              (matchMedia('(width < 640px)').matches
                ? 1
                : matchMedia('(width < 1040px)').matches
                  ? 2
                  : 3)
            )
          }),
      )
      .toBe(true)
    await noOverflow(frame)
    await expect(
      frame.getByRole('button', { name: 'Finished applying', exact: true }).first(),
    ).toBeVisible()
  }
})

for (const width of [390, 768, 1440]) {
  test(`Job Agent: readable Setup/Matches, real salaries, focus and accessible geometry at ${width}px`, async ({
    page,
    context,
  }, info) => {
    test.setTimeout(60000)
    const state = await backend(
      context,
      [],
      [
        lead(1, {
          company: long.repeat(2),
          title: 'Senior Frontend Engineer with a long job title',
          location: long.repeat(2),
          description: 'USD $90k - $120k a year · Easy Apply · 3 company alumni',
        }),
        lead(2, { company: 'Hourly', description: '$40 per hour' }),
        lead(3, {
          company: 'Unknown',
          location: '',
          apply_url: '',
          discovered_at: null,
          description: '$120k - $90k a year',
        }),
      ],
    )
    state.messages = sampleMessages
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    await page.goto('/#/job-agent')
    await expect(
      page.getByRole('heading', { name: 'Connect your job alerts.', exact: true }),
    ).toBeVisible()
    await expect(page.locator('main')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Pause imports', exact: true })).toBeVisible()
    await page.getByText('How to forward your job alerts', { exact: true }).click()
    await expect(page.locator('.agent-alert-instructions ol')).toBeVisible()
    await noOverflow(page)
    expect(
      (
        await new AxeBuilder({ page })
          .include('.job-agent-page')
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze()
      ).violations,
    ).toEqual([])
    await page.screenshot({ path: info.outputPath(`setup-${width}.png`), fullPage: true })
    await expectAccessiblePage(page)
    await nav(page, 'Matches')
    await expect(page.getByText('3 waiting', { exact: true })).toBeVisible()
    await expect(page.locator('.agent-lead')).toHaveCount(3)
    await expect(page.locator('.agent-salary')).toHaveText([
      '$40 per hour',
      'USD $90k - $120k a year',
    ])
    const unknown = page.locator('.agent-lead').filter({ hasText: 'Unknown' })
    await expect(unknown.locator('.agent-salary')).toHaveCount(0)
    await expect(unknown).toContainText('Location not listed')
    await expect(unknown.getByRole('link')).toHaveCount(0)
    await expect(unknown.getByText(/^Found/)).toHaveCount(0)
    const external = page
      .locator('.agent-lead')
      .filter({ hasText: 'Hourly' })
      .getByRole('link', { name: 'View on Indeed', exact: true })
    await expect(external).toHaveAttribute('href', 'https://www.linkedin.com/jobs/view/2')
    await expect(external).toHaveAttribute('target', '_blank')
    await expect(external).toHaveAttribute('rel', 'noreferrer')
    await page
      .locator('.agent-lead')
      .filter({ hasText: 'Hourly' })
      .getByRole('button', { name: 'Finished applying', exact: true })
      .focus()
    await page.keyboard.press('Tab')
    await expect(external).toBeFocused()
    await expect(external).toHaveCSS('outline-style', 'solid')
    const geometry = await page.locator('.agent-lead').evaluateAll((cards) =>
      cards.flatMap((card) => {
        const bounds = card.getBoundingClientRect()
        return [...card.querySelectorAll('h2, p, .agent-location, .agent-salary, button, a')]
          .filter((el) => {
            const b = el.getBoundingClientRect()
            return (
              b.left < bounds.left ||
              b.right > bounds.right ||
              b.top < bounds.top ||
              b.bottom > bounds.bottom ||
              el.scrollWidth > el.clientWidth + 1
            )
          })
          .map((el) => ({
            text: el.textContent,
            scroll: el.scrollWidth,
            client: el.clientWidth,
            bounds: el.getBoundingClientRect().toJSON(),
            card: bounds.toJSON(),
          }))
      }),
    )
    expect(geometry).toEqual([])
    if (width < 1040) {
      const heights = await page
        .locator('.agent-lead button, .agent-lead a')
        .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))
      expect(heights.every((height) => height >= 44)).toBe(true)
    }
    await noOverflow(page)
    expect(
      (
        await new AxeBuilder({ page })
          .include('.job-agent-page')
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze()
      ).violations,
    ).toEqual([])
    await page.screenshot({ path: info.outputPath(`matches-${width}.png`), fullPage: true })
    expect(state.applications).toEqual([])
    expect(state.blocked).toEqual([])
  })
}

test('Job Agent: inbox creation, pending/failure/retry, pause/resume and rotation keep confirmed feedback', async ({
  page,
  context,
}) => {
  const state = await backend(context)
  const service = await inboxService(context)
  await signIn(page)
  await page.goto('/#/job-agent')
  await nav(page, 'Create forwarding address')
  await expect(page.locator('.agent-forwarding-address strong')).toContainText('b'.repeat(32))
  expect(service.writes[0]).toMatchObject({ method: 'POST', body: { user_id: userId } })
  service.hold = true
  await nav(page, 'Pause imports')
  await expect.poll(() => service.pending.length).toBe(1)
  await expect(page.getByRole('button', { name: 'Pause imports' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Replace address' })).toBeDisabled()
  await expect(page.getByText('Imports active', { exact: true })).toBeVisible()
  await service.pending[0].fail()
  await expect(page.getByRole('alert')).toContainText('Synthetic inbox write failure')
  await expect(page.getByRole('button', { name: 'Pause imports' })).toBeEnabled()
  service.hold = false
  await nav(page, 'Pause imports')
  await expect(page.getByText('Imports paused', { exact: true })).toBeVisible()
  await nav(page, 'Resume imports')
  await expect(page.getByText('Imports active', { exact: true })).toBeVisible()
  const address = await page.locator('.agent-forwarding-address strong').textContent()
  page.once('dialog', (dialog) => dialog.dismiss())
  await nav(page, 'Replace address')
  expect(service.writes).toHaveLength(4)
  page.once('dialog', (dialog) => dialog.accept())
  await nav(page, 'Replace address')
  await expect(page.locator('.agent-forwarding-address strong')).not.toHaveText(address)
  expect(service.row.enabled).toBe(true)
  expect(service.row.address_alias).toMatch(/^[0-9a-f]{32}$/)
  expect(state.blocked).toEqual([])
})

test('Job Agent: setup read failure is retryable, clipboard failures never claim success, copied address follows rotation', async ({
  page,
  context,
}) => {
  const state = await backend(context)
  const service = await inboxService(context, state.inbox)
  service.failRead = true
  await signIn(page)
  await page.goto('/#/job-agent')
  await expect(page.getByRole('alert')).toContainText('Synthetic inbox read failure')
  service.failRead = false
  await nav(page, 'Reload setup')
  await expect(page.getByRole('button', { name: 'Copy', exact: true })).toBeVisible()
  await page.evaluate(() => {
    window.copiedAddresses = []
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('Synthetic clipboard denial')
        },
      },
    })
  })
  await nav(page, 'Copy')
  await expect(page.getByRole('alert')).toContainText('Could not copy')
  await expect(page.getByRole('button', { name: 'Copied', exact: true })).toHaveCount(0)
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text) => window.copiedAddresses.push(text) },
    }),
  )
  await nav(page, 'Copy')
  await expect(
    page.getByRole('status').filter({ hasText: 'Forwarding address copied.' }),
  ).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await nav(page, 'Replace address')
  await expect(page.getByRole('button', { name: 'Copy', exact: true })).toBeVisible()
  await nav(page, 'Copy')
  expect(await page.evaluate(() => window.copiedAddresses)).toEqual([
    'a'.repeat(32) + '@inbound.example.invalid',
    service.row.address_alias + '@inbound.example.invalid',
  ])
})

for (const outcome of ['success', 'failure', 'lost']) {
  test(`Job Agent: explicit conversion ${outcome}, cancellation and duplicate prevention`, async ({
    page,
    context,
  }) => {
    const state = await backend(context, [], [lead(1)])
    state.controlConversions = true
    await signIn(page)
    await openQueue(page)
    page.once('dialog', (dialog) => dialog.dismiss())
    await nav(page, 'Finished applying')
    expect(state.conversions).toBeUndefined()
    expect(state.applications).toEqual([])
    page.once('dialog', (dialog) => dialog.accept())
    await nav(page, 'Finished applying')
    await expect.poll(() => state.conversions?.length).toBe(1)
    const operation = state.conversions[0]
    await expect(page.getByRole('button', { name: 'Finished applying' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Remove', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Remove all', exact: true })).toBeDisabled()
    if (outcome === 'success') await operation.respond()
    else if (outcome === 'failure') await operation.fail()
    else {
      operation.commit()
      await operation.abort()
    }
    if (outcome === 'success') {
      await expect(
        page.getByRole('status').filter({ hasText: 'was added to your pipeline' }),
      ).toBeVisible()
    } else {
      await expect(page.getByRole('alert')).toContainText('could not be confirmed')
      await expect(page.getByRole('status').filter({ hasText: 'was added' })).toHaveCount(0)
    }
    if (outcome === 'failure') {
      await expect(page.locator('.agent-lead')).toHaveCount(1)
      page.once('dialog', (dialog) => dialog.accept())
      await nav(page, 'Finished applying')
      await expect.poll(() => state.conversions.length).toBe(2)
      await state.conversions[1].respond()
    }
    await expect(page.getByText('0 waiting', { exact: true })).toBeVisible()
    expect(state.applications).toHaveLength(1)
    await page.reload()
    await nav(page, 'Dashboard')
    await expect(page.getByText('Lead 1', { exact: true })).toBeVisible()
    expect(state.blocked).toEqual([])
  })
}

test('Job Agent: late conversion cannot leak feedback or an Application into a new session', async ({
  page,
  context,
}) => {
  const state = await backend(context, [], [lead(1)])
  state.controlConversions = true
  await signIn(page)
  await openQueue(page)
  page.once('dialog', (dialog) => dialog.accept())
  await nav(page, 'Finished applying')
  await expect.poll(() => state.conversions?.length).toBe(1)
  const old = state.conversions[0]
  await nav(page, 'Sign out')
  const nextId = '00000000-0000-4000-8000-000000000002'
  state.user = { ...state.user, id: nextId }
  state.inbox = { ...state.inbox, user_id: nextId, address_alias: 'c'.repeat(32) }
  state.leads.push(lead(2, { user_id: nextId }))
  await signIn(page)
  await openQueue(page)
  await old.respond()
  await expect(page.locator('.agent-lead')).toHaveCount(1)
  await expect(page.locator('.agent-lead')).toContainText('Lead 2')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'was added' })).toHaveCount(0)
  await nav(page, 'Dashboard')
  await expect(page.getByText('Lead 1', { exact: true })).toHaveCount(0)
  expect(state.applications[0].user_id).toBe(userId)
})

test('Job Agent: normal motion and Demo inbox/queue operations stay local and respect reduced motion', async ({
  page,
  context,
}) => {
  const state = await backend(context)
  await page.goto('/#/demo/job-agent')
  await nav(page, 'Pause imports')
  await expect(page.getByText('Imports paused', { exact: true })).toBeVisible()
  await nav(page, 'Matches')
  await expect(page.locator('.agent-alert-status')).toContainText('Imports paused')
  await expect(page.locator('.agent-lead').first()).toHaveCSS('animation-duration', '0.4s')
  await page.getByRole('button', { name: 'Setup', exact: true }).click()
  await nav(page, 'Resume imports')
  await nav(page, 'Matches')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect
    .poll(() =>
      page
        .locator('.job-agent-page')
        .evaluate((el) =>
          el
            .getAnimations({ subtree: true })
            .every((animation) => animation.effect.getTiming().duration <= 1),
        ),
    )
    .toBe(true)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Finished applying', exact: true }).first().click()
  await expect(page.locator('.agent-lead')).toHaveCount(2)
  expect(state.requests).toEqual([])
  expect(state.blocked).toEqual([])
})
