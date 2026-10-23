import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { backend, nav, noOverflow, signIn } from './fixtures.js'

const explanation = 'Password changes are unavailable in Demo mode because this workspace does not use a personal account.'

for (const width of [390]) {
  test(`Profile: Demo Profile explains account limitations without authentication at ${width}px`, async ({ page, context }, info) => {
    test.setTimeout(60000)
    await page.setViewportSize({ width, height: 900 })
    const state = await backend(context)
    await page.goto('/#/demo/profile')
    const security = page.getByRole('region', { name: 'Password', exact: true })
    await expect(security.getByText(explanation, { exact: true })).toBeVisible()
    await expect(page.locator('form, input')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /password/i })).toHaveCount(0)
    await expect(page.getByText('Password updated successfully.', { exact: true })).toHaveCount(0)
    await expect(page.locator('.app-content')).toHaveCSS('opacity', '1')
    const accessibility = await new AxeBuilder({ page }).include('.profile-page').withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(accessibility.violations).toEqual([])
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath(`demo-profile-${width}.png`), fullPage: true })
    await page.reload()
    await expect(security.getByText(explanation, { exact: true })).toBeVisible()
    for (const [name, heading] of [
      ['Dashboard', 'Your application pipeline'],
      ['Progress', 'Your application flow.'],
      [width < 640 ? 'Agent' : 'Job Agent', 'Connect your job alerts.'],
      [width < 640 ? 'Import' : 'Import Excel', 'Bring in your existing tracker.'],
      ['Profile', 'Demo'],
    ]) {
      const control = page.getByRole('button', { name, exact: true }).filter({ visible: true }).first()
      await control.focus()
      await expect(control).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('heading', { name: heading, exact: true, level: 1 })).toBeVisible({ timeout: 20000 })
      await noOverflow(page)
    }
    await expect(security.getByText(explanation, { exact: true })).toBeVisible()
    expect(state.requests).toEqual([])
    expect(state.blocked).toEqual([])
  })

}

for (const width of [1440]) {
  test(`Profile: real password validation, failure and success remain unchanged at ${width}px`, async ({ page, context }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const state = await backend(context)
    const originalUser = structuredClone(state.user)
    const updates = []
    let failUpdate = true
    await context.route('http://127.0.0.1:54399/auth/v1/user', async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback()
      updates.push(route.request().postDataJSON())
      return failUpdate
        ? route.fulfill({ status: 422, json: { msg: 'Synthetic password update failure' } })
        : route.fulfill({ json: state.user })
    })
    await signIn(page)
    await nav(page, 'Profile')
    const password = page.getByLabel('New password', { exact: true })
    const confirm = page.getByLabel('Confirm password', { exact: true })
    const submit = page.getByRole('button', { name: 'Update password', exact: true })
    await expect(submit).toBeDisabled()
    await expect(page.getByText(explanation, { exact: true })).toHaveCount(0)
    await password.fill('short')
    await confirm.fill('short')
    // Exercise the existing handler's minimum-length guard independently of native validation.
    await page.locator('form.profile-form').dispatchEvent('submit')
    await expect(page.getByRole('alert')).toHaveText('Password must be at least 6 characters.')
    expect(updates).toEqual([])
    await password.fill('synthetic-new-password')
    await confirm.fill('different-password')
    await submit.click()
    await expect(page.getByRole('alert')).toHaveText('Passwords do not match.')
    expect(updates).toEqual([])
    await confirm.fill('synthetic-new-password')
    await submit.click()
    await expect(page.getByRole('alert')).toContainText('Synthetic password update failure')
    await expect(page.getByRole('status')).toHaveCount(0)
    await expect(password).toHaveValue('synthetic-new-password')
    await expect(submit).toBeEnabled()
    failUpdate = false
    await submit.click()
    await expect(page.getByRole('status')).toHaveText('Password updated successfully.')
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(password).toHaveValue('')
    await expect(confirm).toHaveValue('')
    await expect(submit).toBeDisabled()
    expect(updates.map((body) => body.password)).toEqual(['synthetic-new-password', 'synthetic-new-password'])
    for (const body of updates) {
      expect(body).not.toHaveProperty('data')
      expect(body).not.toHaveProperty('email')
    }
    expect(state.user).toEqual(originalUser)
    expect(state.requests.filter((request) => !['GET', 'HEAD'].includes(request.method) &&
      !(request.method === 'POST' && request.table === 'token'))).toEqual([])
    expect(state.blocked).toEqual([])
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath(`real-profile-${width}.png`), fullPage: true })
  })
}
