import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { application, backend, nav, noOverflow, signIn } from './fixtures.js'

const message = 'Could not sign out. Please try again.'
const control = (page) => page.getByRole('button', { name: 'Sign out', exact: true }).filter({ visible: true })
const alert = (page) => page.getByRole('alert').filter({ hasText: message })
const authCookies = async (context) => (await context.cookies()).filter((cookie) => cookie.name.startsWith('sb-'))

async function logoutService(context) {
  const operations = []
  await context.route('**/auth/v1/logout*', (route) => {
    operations.push({
      scope: new URL(route.request().url()).searchParams.get('scope'),
      fail: () => route.fulfill({ status: 500, json: { msg: 'Synthetic logout failure' } }),
      respond: () => route.fulfill({ status: 204 }),
    })
  })
  return operations
}

for (const width of [1440, 768, 390]) {
  test(`Sign out: confirmed logout, accessible failure/retry and pending single-flight at ${width}px`, { tag: width === 1440 ? ['@smoke'] : [] }, async ({ page, context }, info) => {
    const state = await backend(context, [application(1)])
    const originalUser = structuredClone(state.user)
    const operations = await logoutService(context)
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await signIn(page)
    await nav(page, 'Profile')
    await expect(page.getByRole('heading', { name: 'auditor', exact: true })).toBeVisible()
    const cookies = await authCookies(context)
    expect(cookies.length).toBeGreaterThan(0)
    await expect(control(page)).toHaveCount(1)
    // Two events in one turn also exercise the synchronous guard before React rerenders.
    await control(page).evaluate((button) => { button.click(); button.click() })
    await expect.poll(() => operations.length).toBe(1)
    await expect(control(page)).toBeDisabled()
    await expect(control(page)).toHaveAttribute('aria-busy', 'true')
    await expect(page).toHaveURL(/#\/profile$/)
    await expect(alert(page)).toHaveCount(0)
    expect(await authCookies(context)).toEqual(cookies)
    await operations[0].fail()
    await expect(alert(page)).toBeVisible()
    await expect(alert(page)).toBeFocused()
    await expect(control(page)).toBeEnabled()
    await expect(control(page)).toHaveAttribute('aria-busy', 'false')
    await expect(page).toHaveURL(/#\/profile$/)
    expect(await authCookies(context)).toEqual(cookies)
    expect(state.user).toEqual(originalUser)
    expect(state.applications).toHaveLength(1)
    await noOverflow(page)
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([])
    await page.screenshot({ path: info.outputPath(`sign-out-error-${width}.png`), fullPage: true })
    await control(page).focus()
    await page.keyboard.press('Enter')
    await expect.poll(() => operations.length).toBe(2)
    await expect(control(page)).toBeDisabled()
    await expect(alert(page)).toHaveCount(0)
    await expect(page).toHaveURL(/#\/profile$/)
    await operations[1].respond()
    await expect(page.getByRole('heading', { name: 'Sign in to your workspace.' })).toBeVisible()
    expect(await authCookies(context)).toEqual([])
    expect(operations.map((operation) => operation.scope)).toEqual(['global', 'global'])
    expect(errors).toEqual([])
    expect(state.blocked).toEqual([])
    // The ordinary first-attempt success path remains unchanged too.
    await signIn(page)
    await nav(page, 'Profile')
    await expect(alert(page)).toHaveCount(0)
    await control(page).click()
    await expect.poll(() => operations.length).toBe(3)
    await operations[2].respond()
    await expect(page).toHaveURL(/#\/sign-in$/)
    expect(await authCookies(context)).toEqual([])
  })
}

test('Sign out: a rejected logout promise is handled without exposing technical errors', async ({ page, context }) => {
  await backend(context)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await signIn(page)
  await page.evaluate(async () => {
    const { supabase } = await import('/src/lib/supabase.js')
    supabase.auth.signOut = async () => { throw new Error('Synthetic rejected promise with private details') }
  })
  await control(page).click()
  await expect(alert(page)).toBeVisible()
  await expect(control(page)).toBeEnabled()
  await expect(page.getByText(/private details/)).toHaveCount(0)
  await expect(page).toHaveURL(/#\/dashboard$/)
  expect((await authCookies(context)).length).toBeGreaterThan(0)
  expect(errors).toEqual([])
})

test('Sign out: pending and failed logout survive page navigation without locking other controls', async ({ page, context }) => {
  const state = await backend(context, [application(1)])
  const operations = await logoutService(context)
  await signIn(page)
  await control(page).click()
  await expect.poll(() => operations.length).toBe(1)
  await nav(page, 'Progress')
  await expect(page.getByRole('heading', { name: 'Your application flow.', exact: true })).toBeVisible()
  await expect(control(page)).toBeDisabled()
  await operations[0].fail()
  for (const [path, heading] of [
    ['/progress', 'Your application flow.'],
    ['/job-agent', 'Connect your job alerts.'],
    ['/job-agent/matches', 'Jobs waiting for you'],
    ['/import', 'Bring in your existing tracker.'],
    ['/applications/new', 'Add a new application'],
    ['/applications/1/edit', 'Edit application'],
    ['/profile', 'auditor'],
    ['/dashboard', 'Your application pipeline'],
  ]) {
    await page.evaluate(async (path) => { const { navigate } = await import('/src/utils/routes.js'); navigate(path) }, path)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(alert(page)).toBeVisible()
    await expect(control(page)).toBeEnabled()
  }
  expect(operations).toHaveLength(1)
  expect(state.applications).toHaveLength(1)
  expect(state.blocked).toEqual([])
})

for (const failed of [false, true]) {
  for (const sameAccount of [false, true]) {
    test(`Sign out: old ${failed ? 'failure' : 'success'} cannot affect ${sameAccount ? 're-signed-in' : 'different-user'} session or unlock its logout`, async ({ page, context }) => {
      const state = await backend(context, [application(1)])
      const operations = await logoutService(context)
      await signIn(page)
      // Hold only the App-facing completion after the real SDK has released its auth lock.
      await page.evaluate(async () => {
        const { supabase } = await import('/src/lib/supabase.js')
        const original = supabase.auth.signOut.bind(supabase.auth)
        window.originalSignOut = original
        supabase.auth.signOut = async (...args) => {
          const result = await original(...args)
          window.sdkLogoutReturned = true
          await new Promise((resolve) => { window.releaseOldLogout = resolve })
          return result
        }
      })
      await control(page).click()
      await expect.poll(() => operations.length).toBe(1)
      await (failed ? operations[0].fail() : operations[0].respond())
      await expect.poll(() => page.evaluate(() => Boolean(window.sdkLogoutReturned))).toBe(true)
      await page.evaluate(async () => {
        const { supabase } = await import('/src/lib/supabase.js')
        supabase.auth.signOut = window.originalSignOut
      })
      if (failed) {
        // An independent SDK logout models another auth actor, not the disabled App button.
        await page.evaluate(() => { window.independentLogout = window.originalSignOut() })
        await expect.poll(() => operations.length).toBe(2)
        await operations[1].respond()
        await page.evaluate(() => window.independentLogout)
      }
      await expect(page).toHaveURL(/#\/sign-in$/)
      const nextId = sameAccount ? state.user.id : '00000000-0000-4000-8000-000000000002'
      state.user = { ...state.user, id: nextId }
      state.applications = [application(2, { user_id: nextId, company: 'Current workspace' })]
      // Do not reload: the old completion must remain alive in this same App instance.
      await page.getByLabel('Username', { exact: true }).fill('auditor')
      await page.getByLabel('Password', { exact: true }).fill('synthetic-password')
      await page.locator('button[type=submit]').click()
      await expect(page.getByText('Current workspace', { exact: true })).toBeVisible()
      const cookies = await authCookies(context)
      const count = operations.length
      await control(page).click()
      await expect.poll(() => operations.length).toBe(count + 1)
      await expect(control(page)).toBeDisabled()
      await page.evaluate(async () => {
        window.releaseOldLogout()
        await new Promise(requestAnimationFrame)
      })
      await expect(page).toHaveURL(/#\/dashboard$/)
      await expect(page.getByText('Current workspace', { exact: true })).toBeVisible()
      await expect(alert(page)).toHaveCount(0)
      await expect(control(page)).toBeDisabled()
      expect(await authCookies(context)).toEqual(cookies)
      await operations[count].fail()
      await expect(alert(page)).toBeVisible()
      await expect(control(page)).toBeEnabled()
      expect(state.blocked).toEqual([])
    })
  }
}
