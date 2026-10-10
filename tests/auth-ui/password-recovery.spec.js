import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'

const appOrigin = 'http://127.0.0.1:5193'
const authOrigin = 'http://127.0.0.1:54399'
const user = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'reviewer@127.0.0.1',
  user_metadata: { username: 'reviewer', name: 'Reviewer', profileEmail: 'saved@example.invalid' },
  app_metadata: { provider: 'email', providers: ['email'] },
  created_at: '2026-01-01T00:00:00Z',
}

function session() {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: user.id, aud: user.aud, role: user.role, exp: expiresAt,
  })}.synthetic-signature`
  return {
    access_token: token, refresh_token: 'synthetic-refresh-token',
    expires_in: 3600, expires_at: expiresAt, token_type: 'bearer', user,
  }
}

async function mockBackend(context) {
  const state = {
    requests: [], blocked: [], failSignIn: false,
    failPasswordUpdate: false, user: structuredClone(user),
  }
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin === appOrigin) return route.continue()
    if (url.origin !== authOrigin) {
      state.blocked.push(url.origin)
      return route.abort()
    }
    const body = request.postDataJSON()
    state.requests.push({ path: url.pathname, method: request.method(), body })
    let response = []
    if (url.pathname === '/auth/v1/user') {
      if (request.method() === 'PUT' && state.failPasswordUpdate) {
        return route.fulfill({ status: 422, json: { msg: 'Synthetic password update failure' } })
      }
      if (request.method() === 'PUT' && body.data) {
        state.user.user_metadata = { ...state.user.user_metadata, ...body.data }
      }
      response = state.user
    } else if (['/auth/v1/token', '/auth/v1/signup'].includes(url.pathname)) {
      if (state.failSignIn && url.pathname === '/auth/v1/token') {
        return route.fulfill({ status: 400, json: { msg: 'Invalid login credentials' } })
      }
      response = { ...session(), user: state.user }
    } else if (url.pathname === '/auth/v1/logout') {
      return route.fulfill({ status: 204 })
    } else if (!url.pathname.startsWith('/rest/v1/')) {
      throw new Error(`Unexpected mocked endpoint: ${url.pathname}`)
    }
    return route.fulfill({ json: response })
  })
  return state
}

async function expectNoRecoveryUI(page) {
  await expect(page.getByRole('button', { name: /forgot password|send reset link|save recovery email/i })).toHaveCount(0)
  await expect(page.getByText(/recovery email|recover your workspace|used only if you need to reset/i)).toHaveCount(0)
  await expect(page.locator('input[type="email"]')).toHaveCount(0)
  await expect(page.locator('a[href*="reset-password"]')).toHaveCount(0)
}

async function expectNoOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

function expectPasswordUpdate(state, password) {
  const updates = state.requests.filter((request) => request.method === 'PUT')
  expect(updates).toHaveLength(1)
  expect(updates[0].body.password).toBe(password)
  expect(updates[0].body).not.toHaveProperty('data')
  expect(updates[0].body).not.toHaveProperty('email')
  expect(state.user.user_metadata).toEqual(user.user_metadata)
}

async function signIn(page) {
  await page.goto('/#/sign-in')
  await page.getByLabel('Username').fill('reviewer')
  await page.getByLabel('Password', { exact: true }).fill('synthetic-old-password')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/#\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Your application pipeline' })).toBeVisible()
}

for (const width of [1440, 768, 390]) {
  test(`sign in, sign up and public demo omit recovery UI at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const state = await mockBackend(context)
    await page.goto('/#/sign-in')
    await expect(page.getByRole('heading', { name: 'Sign in to your workspace.' })).toBeVisible()
    await expectNoRecoveryUI(page)
    await expectNoOverflow(page)
    await page.screenshot({ path: testInfo.outputPath(`sign-in-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Sign up', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Create your workspace.' })).toBeVisible()
    await expectNoRecoveryUI(page)
    await expectNoOverflow(page)
    await page.screenshot({ path: testInfo.outputPath(`sign-up-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: 'View public demo' }).click()
    await expect(page.getByRole('heading', { name: 'Your application pipeline' })).toBeVisible()
    await expectNoOverflow(page)
    await page.goto('/#/demo/profile')
    await expect(page.getByRole('heading', { name: 'Password', exact: true })).toBeVisible()
    await expectNoRecoveryUI(page)
    await expectNoOverflow(page)
    await expect(page.getByRole('button', { name: 'Update password', exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`demo-profile-${width}.png`), fullPage: true })
    for (const [path, heading] of [
      ['/demo/progress', 'Your application flow.'],
      ['/demo/import', 'Bring in your existing tracker.'],
      ['/demo/applications/new', 'Add a new application'],
      ['/demo/job-agent', 'Turn job alerts into an application queue.'],
      ['/demo/job-agent/matches', 'Turn job alerts into an application queue.'],
    ]) {
      await page.goto(`/#${path}`)
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
      await expectNoRecoveryUI(page)
      await expectNoOverflow(page)
    }
    expect(state.requests).toEqual([])
    expect(state.blocked).toEqual([])
  })

  test(`signed-in password update and sign out work at ${width}px without changing metadata`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const state = await mockBackend(context)
    await signIn(page)
    await page.goto('/#/profile')
    await expect(page.getByRole('heading', { name: 'Password', exact: true })).toBeVisible()
    await expectNoRecoveryUI(page)
    await expectNoOverflow(page)
    await page.getByLabel('New password', { exact: true }).fill('synthetic-new-password')
    await page.getByLabel('Confirm password', { exact: true }).fill('synthetic-new-password')
    await page.getByRole('button', { name: 'Update password', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('Password updated successfully.')
    expectPasswordUpdate(state, 'synthetic-new-password')
    await expect(page.getByLabel('New password', { exact: true })).toHaveValue('')
    await page.screenshot({ path: testInfo.outputPath(`profile-${width}.png`), fullPage: true })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Password', exact: true })).toBeVisible()
    const cookies = await context.cookies()
    expect(cookies.filter((cookie) => cookie.name.startsWith('sb-')).length).toBeGreaterThan(0)
    expect(cookies.filter((cookie) => cookie.name.startsWith('sb-')).every((cookie) => cookie.expires === -1)).toBe(true)
    // The existing tablet layout hides sign-out controls; exercise the unchanged handler on desktop.
    if (width === 768) await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('button', { name: 'Sign out', exact: true }).filter({ visible: true }).click()
    await expect(page.getByRole('heading', { name: 'Sign in to your workspace.' })).toBeVisible()
    expect((await context.cookies()).filter((cookie) => cookie.name.startsWith('sb-'))).toEqual([])
    expect(state.requests.some((request) => request.path.startsWith('/functions/'))).toBe(false)
    expect(state.blocked).toEqual([])
  })
}

test('registration sends username and password without recovery metadata', async ({ page, context }) => {
  const state = await mockBackend(context)
  await page.goto('/#/sign-in')
  await page.getByRole('button', { name: 'Sign up', exact: true }).click()
  await page.getByLabel('Username').fill('New Reviewer')
  await page.getByLabel('Password', { exact: true }).fill('synthetic-new-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/#\/dashboard$/)
  const signup = state.requests.find((request) => request.path === '/auth/v1/signup')
  expect(signup.body.email).toBe('new-reviewer@127.0.0.1')
  expect(signup.body.password).toBe('synthetic-new-password')
  expect(signup.body.data).toEqual({ name: 'New Reviewer', username: 'New Reviewer' })
  expect(state.blocked).toEqual([])
})

test('sign-in errors and password visibility still work', async ({ page, context }) => {
  const state = await mockBackend(context)
  state.failSignIn = true
  await page.goto('/#/sign-in')
  await page.getByLabel('Username').fill('reviewer')
  await page.getByLabel('Password', { exact: true }).fill('synthetic-invalid-password')
  await page.getByRole('button', { name: 'Show password', exact: true }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Hide password', exact: true }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password')
  await page.locator('button[type="submit"]').click()
  await expect(page.locator('.form-error')).toHaveText('The username or password is incorrect.')
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace.' })).toBeVisible()
  await expectNoRecoveryUI(page)
  expect(state.blocked).toEqual([])
})

test('password mismatch and backend errors remain actionable', async ({ page, context }) => {
  const state = await mockBackend(context)
  await signIn(page)
  await page.goto('/#/profile')
  await page.getByLabel('New password', { exact: true }).fill('synthetic-new-password')
  await page.getByLabel('Confirm password', { exact: true }).fill('different-password')
  await page.getByRole('button', { name: 'Update password', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Passwords do not match.')
  expect(state.requests.filter((request) => request.method === 'PUT')).toEqual([])
  state.failPasswordUpdate = true
  await page.getByLabel('Confirm password', { exact: true }).fill('synthetic-new-password')
  await page.getByRole('button', { name: 'Update password', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Synthetic password update failure')
  expect(state.blocked).toEqual([])
})

for (const withQuery of [true, false]) {
  test(`legacy recovery token link remains usable (recovery query: ${withQuery})`, async ({ page, context }) => {
    const state = await mockBackend(context)
    const tokens = session()
    const fragment = new URLSearchParams({
      access_token: tokens.access_token, refresh_token: tokens.refresh_token,
      expires_in: '3600', token_type: 'bearer', type: 'recovery',
    })
    await page.goto(`/${withQuery ? '?recovery=1' : ''}#${fragment}`)
    await expect(page.getByRole('heading', { name: 'Choose a new password.' })).toBeVisible()
    await expect(page).toHaveURL(/#\/reset-password$/)
    await page.getByLabel('New password', { exact: true }).fill('synthetic-reset-password')
    await page.getByLabel('Confirm password', { exact: true }).fill('synthetic-reset-password')
    await page.getByRole('button', { name: 'Update password', exact: true }).click()
    await expect(page.getByText('Your password has been updated.', { exact: true })).toBeVisible()
    expectPasswordUpdate(state, 'synthetic-reset-password')
    await page.getByRole('button', { name: 'Continue to dashboard' }).click()
    await expect(page.getByRole('heading', { name: 'Your application pipeline' })).toBeVisible()
    expect(state.requests.some((request) => request.path.startsWith('/functions/'))).toBe(false)
    expect(state.blocked).toEqual([])
  })
}

test('unauthenticated reset route does not expose a public recovery form', async ({ page, context }) => {
  const state = await mockBackend(context)
  await page.goto('/#/reset-password')
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace.' })).toBeVisible()
  await expectNoRecoveryUI(page)
  await expect(page.getByRole('heading', { name: 'Choose a new password.' })).toHaveCount(0)
  expect(state.requests).toEqual([])
  expect(state.blocked).toEqual([])
})
