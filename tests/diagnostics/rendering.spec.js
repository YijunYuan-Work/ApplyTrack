import { expect, test } from '@playwright/test'
import { application, backend, nav, signIn } from '../browser/functional/fixtures.js'

test('optional: measure 1000-row Board and paginated List rendering', async ({ page, context }, info) => {
  test.setTimeout(120000)
  const state = await backend(context, Array.from({ length: 1000 }, (_, i) => application(i + 1)))
  const started = Date.now()
  await signIn(page)
  await expect(page.locator('.board-card')).toHaveCount(1000)
  const boardMs = Date.now() - started
  const listStarted = Date.now()
  await nav(page, 'List')
  await expect(page.locator('.application-card')).toHaveCount(10)
  const listMs = Date.now() - listStarted
  expect(state.blocked).toEqual([])
  await info.attach('rendering-measurements', {
    body: JSON.stringify({ boardMs, listMs }), contentType: 'application/json',
  })
})
