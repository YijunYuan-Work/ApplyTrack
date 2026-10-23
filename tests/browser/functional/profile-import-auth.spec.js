import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import * as XLSX from 'xlsx'
import { application, backend, nav, noOverflow, signIn, spreadsheet } from './fixtures'
import { expectAccessiblePage } from './accessibility.js'
import { expectNavigationShell } from './navigation.js'

export async function openRecovery(page, user) {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const access = `${encode({ alg: 'HS256' })}.${encode({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp })}.synthetic`
  const fragment = new URLSearchParams({
    access_token: access,
    refresh_token: 'synthetic',
    expires_in: '3600',
    token_type: 'bearer',
    type: 'recovery',
  })
  await page.goto(`/?recovery=1#${fragment}`)
  await expect(page.getByRole('heading', { name: 'Choose a new password.' })).toBeVisible()
}

async function accessible(page, selector) {
  await noOverflow(page)
  expect(
    (await new AxeBuilder({ page }).include(selector).withTags(['wcag2a', 'wcag2aa']).analyze())
      .violations,
  ).toEqual([])
}

export async function confirmImport(page, count) {
  const name = `Import ${count} ${count === 1 ? 'application' : 'applications'}`
  await page.getByRole('button', { name, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name, exact: true }).click()
}

const longName = 'LongCompanyAndRoleWithoutBreaks'.repeat(3)
const importedNotes = '  Cover letter: Yes\nReferral: No\nLast updated: interview pending  \n'
export const importRows = [
  ['Company', 'Role', 'Status', 'Applied Date', 'Location', 'Rejected Date', 'Notes'],
  ['Existing', 'Engineer', 'Applied', '2026-01-01', 'Toronto', '', 'duplicate'],
  [longName, longName, 'Interview', '2026-01-02', longName, '', importedNotes],
  ['Rejected history', 'Engineer', 'Rejected', '2024-02-29', 'Remote', '2026-01-08', 'historical'],
  ['Missing role', '', '', '', '', '', 'skip'],
]

for (const width of [390, 768, 1440]) {
  test(`Workspace pages: account, real preview, modal, focus and responsive geometry at ${width}px`, async ({
    page,
    context,
  }, info) => {
    test.setTimeout(90000)
    const state = await backend(context, [
      application(1, { company: 'Existing', role: 'Engineer', applied_date: '2026-01-01' }),
    ])
    await page.setViewportSize({ width, height: 900 })
    const compact = await page.evaluate(() => matchMedia('(width < 640px)').matches)
    await info.attach('responsive-mode', {
      body: JSON.stringify({ requestedWidth: width, compact }),
      contentType: 'application/json',
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await signIn(page)
    await nav(page, 'Profile')
    await expect(page.getByText(state.user.email, { exact: true })).toHaveCount(0)
    await expect(page.getByText('synthetic@example.invalid', { exact: true })).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Sign out', exact: true }).filter({ visible: true }),
    ).toHaveCount(1)
    await page.getByLabel('New password', { exact: true }).fill('aaaaaa')
    await page.getByLabel('Confirm password', { exact: true }).fill('aaaaaa')
    await expect(page.getByRole('meter', { name: 'Password strength' })).toHaveAttribute(
      'aria-valuenow',
      '2',
    )
    await expect(page.getByRole('button', { name: 'Update password', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Show new password', exact: true }).click()
    await expect(page.getByLabel('New password', { exact: true })).toHaveAttribute('type', 'text')
    await accessible(page, '.profile-page')
    await expectAccessiblePage(page)
    await page.screenshot({ path: info.outputPath(`profile-${width}.png`), fullPage: true })
    await nav(page, compact ? 'Import' : 'Import Excel')
    await page.locator('input[type="file"]').focus()
    await expect(page.locator('.import-file-picker')).toHaveCSS('outline-style', 'solid')
    await accessible(page, '.import-page')
    await expectAccessiblePage(page)
    await page.screenshot({ path: info.outputPath(`import-empty-${width}.png`), fullPage: true })
    await page.locator('input[type="file"]').setInputFiles(spreadsheet(importRows))
    await expect(page.getByRole('region', { name: 'Preview', exact: true })).toBeVisible({
      timeout: 20000,
    })
    await expect(page.locator('.import-preview-row')).toHaveCount(3)
    await expect(page.getByText('2 of 3 selected', { exact: true })).toBeVisible()
    await expect(
      page.locator('.import-preview-row').first().getByRole('checkbox'),
    ).not.toBeChecked()
    await expect(page.getByText(longName, { exact: true })).toHaveCount(3)
    await accessible(page, '.import-page')
    await page.screenshot({ path: info.outputPath(`import-preview-${width}.png`), fullPage: true })
    const trigger = page.getByRole('button', { name: 'Import 2 applications', exact: true })
    await trigger.click()
    const dialog = page.getByRole('dialog')
    const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true })
    await expect(cancel).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(
      dialog.getByRole('button', { name: 'Import 2 applications', exact: true }),
    ).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(cancel).toBeFocused()
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
    await accessible(page, '.import-confirmation')
    await page.screenshot({ path: info.outputPath(`confirm-${width}.png`), fullPage: true })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    expect(state.applications).toHaveLength(1)
    expect(state.requests.filter((r) => r.table === 'applications' && r.method === 'POST')).toEqual(
      [],
    )
    expect(state.blocked).toEqual([])
  })
}

for (const width of [390, 768, 1440]) {
  test(`Workspace pages: auth and recovered password states remain accessible at ${width}px`, async ({
    page,
    context,
  }, info) => {
    test.setTimeout(90000)
    const state = await backend(context)
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/#/sign-in')
    await expect(page.getByRole('heading', { name: 'Sign in to your workspace.' })).toBeVisible()
    await accessible(page, '.auth-workspace')
    await page.screenshot({ path: info.outputPath(`sign-in-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Sign up', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Create your workspace.' })).toBeVisible()
    await expect(page.locator('input[type="email"]')).toHaveCount(0)
    await expect(page.getByText(/forgot password|recovery email/i)).toHaveCount(0)
    await accessible(page, '.auth-workspace')
    await page.screenshot({ path: info.outputPath(`sign-up-${width}.png`), fullPage: true })
    await openRecovery(page, state.user)
    await accessible(page, '.auth-workspace')
    await page.screenshot({ path: info.outputPath(`reset-${width}.png`), fullPage: true })
    await page.getByLabel('New password', { exact: true }).fill('aaaaaa')
    await page.getByLabel('Confirm password', { exact: true }).fill('aaaaab')
    await page.getByRole('button', { name: 'Update password', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('Passwords do not match.')
    expect(state.requests.filter((r) => r.table === 'user' && r.method === 'PUT')).toEqual([])
    await page.getByLabel('Confirm password', { exact: true }).fill('aaaaaa')
    await page.getByRole('button', { name: 'Update password', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Your password has been updated.')
    await accessible(page, '.auth-workspace')
    await page.getByRole('button', { name: 'Continue to dashboard' }).click()
    await expect(page.getByRole('heading', { name: 'Your application pipeline' })).toBeVisible()
    expect(state.requests.find((r) => r.table === 'user' && r.method === 'PUT').body).toEqual({
      password: 'aaaaaa',
      code_challenge: null,
      code_challenge_method: null,
    })
    expect(state.requests.some((r) => /functions/.test(r.table))).toBe(false)
    expect(state.blocked).toEqual([])
  })
}

test('Workspace pages: drag/drop reads actual rows; duplicate selection, cancellation, pending, failure and retry preserve data', async ({
  page,
  context,
}) => {
  const state = await backend(context, [
    application(1, { company: 'Existing', role: 'Engineer', applied_date: '2026-01-01' }),
  ])
  const operations = []
  await context.route('**/rest/v1/applications?*', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    const body = route.request().postDataJSON()
    operations.push({
      body,
      fail: () => route.fulfill({ status: 400, json: { message: 'Synthetic insert failure' } }),
      respond: () => {
        const rows = body.map((row, i) => ({
          id: 1000 + i,
          updated_at: '2026-01-01T00:00:00Z',
          ...row,
        }))
        state.applications.push(...rows)
        return route.fulfill({ json: rows })
      },
    })
  })
  await signIn(page)
  await nav(page, 'Import Excel')
  const file = spreadsheet([...importRows, importRows[2]])
  const transfer = await page.evaluateHandle(
    ({ bytes, name, type }) => {
      const data = new DataTransfer()
      data.items.add(new File([new Uint8Array(bytes)], name, { type }))
      return data
    },
    { bytes: [...file.buffer], name: file.name, type: file.mimeType },
  )
  const drop = page.getByRole('region', { name: 'Upload spreadsheet' })
  await drop.dispatchEvent('dragenter', { dataTransfer: transfer })
  await expect(drop).toHaveClass(/dragging/)
  await drop.dispatchEvent('drop', { dataTransfer: transfer })
  await expect(page.locator('.import-preview-row')).toHaveCount(4)
  await expect(page.getByText('2 of 4 selected', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear recommended', exact: true }).click()
  await expect(page.getByText('0 of 4 selected', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Import 0 applications' })).toBeDisabled()
  await page.getByRole('button', { name: 'Select recommended', exact: true }).click()
  await page.locator('.import-preview-row').first().getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Import 3 applications', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Includes 1 possible duplicate.')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
  expect(operations).toHaveLength(0)
  await page.getByRole('button', { name: 'Import 3 applications', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Import 3 applications', exact: true })
    .evaluate((button) => {
      button.click()
      button.click()
    })
  await expect.poll(() => operations.length).toBe(1)
  await expect(page.getByRole('button', { name: 'Importing...', exact: true })).toBeDisabled()
  await expect(page.locator('.import-preview-row input')).toHaveCount(4)
  for (const input of await page.locator('.import-preview-row input').all())
    await expect(input).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Clear recommended' })).toBeDisabled()
  await expect(page.getByRole('status')).not.toContainText('imported successfully')
  await operations[0].fail()
  await expect(page.getByRole('alert')).toContainText('Synthetic insert failure')
  await expect(page.getByText('3 of 4 selected', { exact: true })).toBeVisible()
  expect(state.applications).toHaveLength(1)
  await confirmImport(page, 3)
  await expect.poll(() => operations.length).toBe(2)
  await operations[1].respond()
  await expect(page.getByRole('status')).toContainText('3 applications imported successfully.')
  expect(operations[1].body.find((r) => r.company === longName).notes).toBe(importedNotes)
  expect(operations[1].body.find((r) => r.company === 'Rejected history').rejected_date).toBe(
    '2026-01-08',
  )
  expect(operations[1].body.find((r) => r.company === longName).rejected_date).toBeNull()
  await page.getByRole('button', { name: 'View dashboard' }).click()
  await expect(page.getByRole('heading', { name: 'Your application pipeline' })).toBeVisible()
  expect(state.applications).toHaveLength(4)
  await page.locator('.board-card').filter({ has: page.getByText(longName, { exact: true }).first() })
    .getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue(importedNotes)
  expect(state.blocked).toEqual([])
})

test('Workspace pages: fractional Profile and Import layouts follow their structural breakpoints', async ({ page, context }) => {
  const state = await backend(context)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await context.route('http://127.0.0.1:5195/account-frame', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<iframe title="Account fractional viewport" style="width:639.5px;height:900px;border:0" src="/#/sign-in"></iframe>',
  }))
  await page.goto('/account-frame')
  const frame = page.frames().find((f) => f !== page.mainFrame())
  await signIn(frame)
  await nav(frame, 'Profile')
  for (const width of [639.5, 640.5, 1039.5, 1040.5]) {
    await page.locator('iframe').evaluate((el, w) => (el.style.width = w + 'px'), width)
    const desktop = await frame.evaluate(() => matchMedia('(width >= 1040px)').matches)
    await expect.poll(() => frame.locator('.profile-settings-grid').evaluate((el) =>
      getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(desktop ? 2 : 1)
    await expect(frame.getByRole('button', { name: 'Sign out', exact: true }).filter({ visible: true })).toHaveCount(1)
    await noOverflow(frame)
  }
  await frame.goto('http://127.0.0.1:5195/#/import')
  await expect(frame.getByRole('heading', { name: 'Bring in your existing tracker.' })).toBeVisible()
  await frame.locator('input[type="file"]').setInputFiles(spreadsheet(importRows))
  await expect(frame.locator('.import-preview-row')).toHaveCount(3)
  for (const width of [639.5, 640.5, 1039.5, 1040.5]) {
    await page.locator('iframe').evaluate((el, w) => (el.style.width = w + 'px'), width)
    const desktop = await frame.evaluate(() => matchMedia('(width >= 1040px)').matches)
    await expect.poll(() => frame.locator('.import-layout').evaluate((el) =>
      getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(desktop ? 2 : 1)
    await noOverflow(frame)
    await frame.locator('input[type="file"]').focus()
    await expect(frame.locator('.import-file-picker')).toHaveCSS('outline-style', 'solid')
  }
  expect(state.blocked).toEqual([])
})

test('Workspace pages: normal motion and hover/focus feedback remain deliberate', async ({
  page,
  context,
}) => {
  await backend(context)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/#/sign-in')
  await expect(page.locator('.auth-content .auth-panel')).toHaveCSS('animation-duration', '0.46s')
  const primary = page.getByRole('button', { name: 'Sign in', exact: true }).last()
  await primary.hover()
  await expect(primary).toHaveCSS('background-color', 'rgb(138, 74, 53)')
  await primary.focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(primary).toBeFocused()
  await expect(primary).toHaveCSS('outline-style', 'solid')
  await signIn(page)
  await nav(page, 'Profile')
  await expect(page.locator('.profile-header')).toHaveCSS('animation-duration', '0.42s')
  await nav(page, 'Import Excel')
  await expect(page.locator('.import-drop-zone')).toHaveCSS('animation-duration', '0.46s')
})

for (const width of [390, 768, 1440]) {
  test(`Workspace pages: whole-app visual consistency and reduced motion at ${width}px`, async ({
    page,
    context,
  }, info) => {
    test.setTimeout(90000)
    const state = await backend(context)
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (const [route, heading] of [
      ['dashboard', 'Your application pipeline'],
      ['progress', 'Your application flow.'],
      ['job-agent', 'Connect your job alerts.'],
      ['job-agent/matches', 'Jobs waiting for you'],
      ['profile', 'Demo'],
      ['import', 'Bring in your existing tracker.'],
      ['applications/new', 'Add a new application'],
    ]) {
      const names = {
        dashboard: 'Dashboard', progress: 'Progress', profile: 'Profile',
        'job-agent': width < 640 ? 'Agent' : 'Job Agent',
        import: width < 640 ? 'Import' : 'Import Excel',
      }
      if (route === 'dashboard') await page.goto('/#/demo')
      else if (names[route]) {
        const control = page.getByRole('navigation', {
          name: width < 640 ? 'Mobile navigation' : 'Primary navigation', exact: true,
        }).getByRole('button', { name: names[route], exact: true })
        await control.focus()
        // Stay inside navigation when the target is the final mobile button.
        await page.keyboard.press('Shift+Tab')
        await page.keyboard.press('Tab')
        await expect(control).toBeFocused()
        await expect(control).toHaveCSS('outline-style', 'solid')
        await page.keyboard.press('Enter')
      } else if (route === 'job-agent/matches') await nav(page, 'Matches')
      else await nav(page, 'Add application')
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible({
        timeout: 20000,
      })
      await expect(page.locator('.page-loading-state')).toHaveCount(0, { timeout: 20000 })
      if (names[route]) {
        const { menu } = await expectNavigationShell(page)
        await expect(menu.locator('[aria-current="page"]')).toHaveAttribute('aria-label', names[route])
      }
      await expect(page.getByRole('main')).toHaveCount(1)
      await expect(page.locator('main h1').filter({ visible: true })).toHaveCount(1)
      await expect(page.locator('.app-layout')).toHaveCount(1)
      await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0)
      if (route === 'profile') {
        await expect(page.getByRole('region', { name: 'Password', exact: true })).toContainText(
          'Password changes are unavailable in Demo mode because this workspace does not use a personal account.',
        )
        await expect(page.locator('form, input')).toHaveCount(0)
        await expect(page.getByRole('button', { name: /password/i })).toHaveCount(0)
        await expect(page.getByText('Password updated successfully.', { exact: true })).toHaveCount(0)
      }
      await noOverflow(page)
      const typography = await page
        .locator('main h1')
        .filter({ visible: true })
        .evaluate((el) => ({
          font: getComputedStyle(el).fontFamily,
          color: getComputedStyle(el).color,
        }))
      expect(typography.font).toContain('Figtree')
      expect(typography.color).toBe('rgb(40, 106, 115)')
      const animations = await page
        .getByRole('main')
        .evaluate((el) =>
          el.getAnimations({ subtree: true }).map((a) => a.effect.getComputedTiming().duration),
        )
      expect(animations.every((duration) => duration <= 1)).toBe(true)
      const shellAnimations = await page.locator('.app-layout').evaluate((root) =>
        root.getAnimations({ subtree: true }).map((a) => a.effect.getComputedTiming().duration))
      expect(shellAnimations.every((duration) => duration <= 1)).toBe(true)
      await expectAccessiblePage(page)
      await expect(page.locator('.app-content')).toHaveCSS('opacity', '1')
      await page.screenshot({
        path: info.outputPath(`whole-app-${route.replaceAll('/', '-')}-${width}.png`),
        fullPage: true,
      })
    }
    await page.goto('/#/demo/import')
    await page.getByRole('button', { name: 'Preview sample file' }).click()
    const footer = page.locator('.import-actions')
    const box = await footer.boundingBox()
    const boundary = width < 640 ? (await page.locator('.mobile-bottom-nav').boundingBox()).y : 900
    expect(box.y + box.height).toBeLessThanOrEqual(boundary + 1)
    expect(box.y).toBeGreaterThan(0)
    await footer.getByRole('button').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.mouse.click(8, 8)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(state.requests).toEqual([])
    expect(state.blocked).toEqual([])
  })
}

test('Workspace pages: invalid/oversize/missing-column files are retryable; real template downloads and XLS files parse', async ({
  page,
  context,
}, info) => {
  const state = await backend(context)
  await signIn(page)
  await nav(page, 'Import Excel')
  const picker = page.locator('input[type="file"]')
  for (const [file, message] of [
    [
      { name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('Company,Role') },
      'Choose an .xlsx or .xls spreadsheet.',
    ],
    [
      {
        name: 'big.xlsx',
        mimeType: 'application/octet-stream',
        buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
      },
      'Spreadsheets must be between 1 byte and 5 MB.',
    ],
    [spreadsheet([['Other'], ['x']]), 'The spreadsheet must include Company and Role columns.'],
    [
      spreadsheet([
        ['Company', 'Role'],
        ['', ''],
      ]),
      'No rows with both company and role were found.',
    ],
  ]) {
    await picker.setInputFiles(file)
    await expect(page.getByRole('alert')).toHaveText(message)
    expect(state.requests.filter((r) => r.table === 'applications' && r.method === 'POST')).toEqual(
      [],
    )
  }
  const waiting = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download template' }).click()
  const download = await waiting
  expect(download.suggestedFilename()).toBe('ApplyTrack-import-template.xlsx')
  const path = info.outputPath('template.xlsx')
  await download.saveAs(path)
  const workbook = XLSX.read(readFileSync(path))
  const headers = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
    header: 1,
  })[0]
  expect(headers).toEqual(expect.arrayContaining(['Company', 'Role', 'Status', 'Notes']))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([
      ['Employer', 'Position', 'Note'],
      ['XLS actual', 'Tester', 'literal'],
    ]),
    'First',
  )
  await picker.setInputFiles({
    name: 'actual.xls',
    mimeType: 'application/vnd.ms-excel',
    buffer: XLSX.write(book, { type: 'buffer', bookType: 'biff8' }),
  })
  await expect(page.locator('.import-preview-row')).toContainText('XLS actual')
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(state.blocked).toEqual([])
})

test('Workspace pages: stale file parsing cannot replace a new preview after route navigation', async ({
  page,
  context,
}) => {
  await backend(context)
  await page.addInitScript(() => {
    const read = File.prototype.arrayBuffer
    File.prototype.arrayBuffer = async function () {
      const bytes = await read.call(this)
      if (this.name === 'slow.xlsx') {
        await new Promise((resolve) => {
          window.releaseSpreadsheet = resolve
        })
        window.oldReadReleased = true
      }
      return bytes
    }
  })
  await signIn(page)
  await nav(page, 'Import Excel')
  await page.locator('input[type="file"]').setInputFiles({
    ...spreadsheet([
      ['Company', 'Role'],
      ['Old file', 'Old role'],
    ]),
    name: 'slow.xlsx',
  })
  await expect.poll(() => page.evaluate(() => Boolean(window.releaseSpreadsheet))).toBe(true)
  await expect(page.getByRole('status')).toContainText('Reading spreadsheet')
  await nav(page, 'Progress')
  await nav(page, 'Import Excel')
  await page.locator('input[type="file"]').setInputFiles(
    spreadsheet([
      ['Company', 'Role'],
      ['New file', 'New role'],
    ]),
  )
  await expect(page.locator('.import-preview-row')).toContainText('New file')
  await page.evaluate(() => window.releaseSpreadsheet())
  await expect.poll(() => page.evaluate(() => window.oldReadReleased)).toBe(true)
  await expect(page.locator('.import-preview-row')).toHaveCount(1)
  await expect(page.locator('.import-preview-row')).toContainText('New file')
  await expect(page.getByText('Old file', { exact: true })).toHaveCount(0)
})

test('Workspace pages: Demo import and profile remain local, confirmed and account-free', async ({
  page,
  context,
}) => {
  const state = await backend(context)
  await page.goto('/#/demo/profile')
  await expect(page.getByRole('region', { name: 'Password', exact: true })).toContainText(
    'does not use a personal account',
  )
  await expect(page.locator('input')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Update password', exact: true })).toHaveCount(0)
  await nav(page, 'Import Excel')
  await page.getByRole('button', { name: 'Preview sample file' }).click()
  const checked = await page.locator('.import-preview-row input:checked').count()
  expect(checked).toBeGreaterThan(0)
  await confirmImport(page, checked)
  await expect(page.getByRole('status')).toContainText('imported successfully')
  await page.getByRole('button', { name: 'View dashboard' }).click()
  await expect(page.getByRole('heading', { name: 'Your application pipeline' })).toBeVisible()
  expect(state.requests).toEqual([])
  expect(state.blocked).toEqual([])
})

for (const recovered of [false, true]) {
  test(`Workspace pages: ${recovered ? 'recovered' : 'profile'} password waits for the server, fails safely and retries`, async ({
    page,
    context,
  }) => {
    const state = await backend(context)
    const writes = []
    await context.route('**/auth/v1/user', (route) => {
      if (route.request().method() !== 'PUT') return route.fallback()
      writes.push({
        body: route.request().postDataJSON(),
        fail: () => route.fulfill({ status: 422, json: { msg: 'Synthetic password failure' } }),
        respond: () => route.fulfill({ json: state.user }),
      })
    })
    if (recovered) await openRecovery(page, state.user)
    else {
      await signIn(page)
      await nav(page, 'Profile')
    }
    const password = page.getByLabel('New password', { exact: true })
    const confirmation = page.getByLabel('Confirm password', { exact: true })
    await password.fill('aaaaaa')
    await confirmation.fill('aaaaaa')
    await page.getByRole('button', { name: 'Update password', exact: true }).click()
    await expect.poll(() => writes.length).toBe(1)
    await expect(password).toBeDisabled()
    await expect(confirmation).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Saving...', exact: true })).toBeDisabled()
    await expect(page.getByRole('status')).toHaveCount(0)
    await writes[0].fail()
    await expect(page.getByRole('alert')).toContainText('Synthetic password failure')
    await expect(password).toHaveValue('aaaaaa')
    await expect(password).toBeEnabled()
    await page.getByRole('button', { name: 'Update password', exact: true }).click()
    await expect.poll(() => writes.length).toBe(2)
    await writes[1].respond()
    await expect(page.getByRole('status')).toContainText(
      recovered ? 'Your password has been updated.' : 'Password updated successfully.',
    )
    expect(writes.map((write) => write.body)).toEqual(
      Array.from({ length: 2 }, () => ({
        password: 'aaaaaa',
        code_challenge: null,
        code_challenge_method: null,
      })),
    )
    expect(state.blocked).toEqual([])
  })
}

test('Workspace pages: late import completion cannot leak success or records into a different session', async ({
  page,
  context,
}) => {
  const state = await backend(context)
  let complete
  await context.route('**/rest/v1/applications?*', (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    const body = route.request().postDataJSON()
    complete = () => {
      const rows = body.map((row, index) => ({
        id: 5000 + index,
        updated_at: '2026-01-01T00:00:00Z',
        ...row,
      }))
      state.applications.push(...rows)
      return route.fulfill({ json: rows })
    }
  })
  await signIn(page)
  await nav(page, 'Import Excel')
  await page.locator('input[type="file"]').setInputFiles(
    spreadsheet([
      ['Company', 'Role'],
      ['Old owner', 'Engineer'],
    ]),
  )
  await expect(page.getByRole('region', { name: 'Preview', exact: true })).toBeVisible({
    timeout: 20000,
  })
  await confirmImport(page, 1)
  await expect.poll(() => Boolean(complete)).toBe(true)
  await nav(page, 'Sign out')
  state.user = {
    ...state.user,
    id: '00000000-0000-4000-8000-000000000002',
    user_metadata: { username: 'other', name: 'Other' },
  }
  await page.getByLabel('Username', { exact: true }).fill('other')
  await page.getByLabel('Password', { exact: true }).fill('synthetic-password')
  await page.locator('button[type="submit"]').click()
  await expect(page.getByRole('heading', { name: 'Your application pipeline' })).toBeVisible()
  await complete()
  await nav(page, 'Import Excel')
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(page.locator('.import-preview-row')).toHaveCount(0)
  await nav(page, 'Dashboard')
  await expect(page.getByText('Old owner', { exact: true })).toHaveCount(0)
  expect(state.blocked).toEqual([])
})

test('Workspace pages: sign-in pending controls prevent duplicate submissions without optimistic success', async ({
  page,
  context,
}) => {
  const state = await backend(context)
  let finish
  let attempts = 0
  await context.route('**/auth/v1/token?*', (route) => {
    attempts++
    finish = () => route.fulfill({ status: 400, json: { msg: 'Invalid login credentials' } })
  })
  await page.goto('/#/sign-in')
  await page.getByLabel('Username', { exact: true }).fill('auditor')
  await page.getByLabel('Password', { exact: true }).fill('short')
  await page.locator('button[type="submit"]').click()
  await expect.poll(() => attempts).toBe(1)
  await expect(
    page.getByRole('heading', { name: 'Loading your workspace.', exact: true }),
  ).toBeVisible()
  await expect(page.locator('input')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Sign up', exact: true })).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Your application pipeline', exact: true }),
  ).toHaveCount(0)
  await finish()
  await expect(page.getByRole('alert')).toHaveText('The username or password is incorrect.')
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace.' })).toBeVisible()
  expect(attempts).toBe(1)
  expect(state.blocked).toEqual([])
})
