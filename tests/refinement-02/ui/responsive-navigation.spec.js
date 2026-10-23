import { expect, test } from '@playwright/test'
import { application, backend, nav, noOverflow, signIn } from './fixtures.js'
import { expectNavigationShell as shell } from './navigation.js'
import { settlePage } from './accessibility.js'

const widths = [390, 639, 640, 720, 721, 768, 898, 900, 901, 1039, 1040, 1440]
const signOut = (page) => page.getByRole('button', { name: 'Sign out', exact: true }).filter({ visible: true })
const pages = [
  ['Dashboard', 'Your application pipeline'], ['Profile', 'auditor'],
  ['Progress', 'Your application flow.'], ['Job Agent', 'Connect your job alerts.'],
  ['Import Excel', 'Bring in your existing tracker.'],
]

async function keyboardMenu(page) {
  const { menu } = await shell(page)
  const buttons = menu.getByRole('button')
  await buttons.first().focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  for (let i = 0; i < 5; i += 1) {
    await expect(buttons.nth(i)).toBeFocused()
    const focus = await buttons.nth(i).evaluate(e => ({ visible:e.matches(':focus-visible'),
      style:getComputedStyle(e).outlineStyle, width:parseFloat(getComputedStyle(e).outlineWidth) }))
    expect(focus.visible).toBe(true)
    expect(focus.style).not.toBe('none')
    expect(focus.width).toBeGreaterThan(0)
    if (i < 4) await page.keyboard.press('Tab')
  }
}

async function keyboardSignOut(page) {
  await settlePage(page)
  const { media } = await shell(page)
  if (media.compact) await page.locator('.mobile-add-action').focus()
  else await page.locator('.sidebar-primary-action').focus()
  await page.keyboard.press('Tab')
  await expect(signOut(page)).toBeFocused()
  await expect(signOut(page)).toBeInViewport()
  const focus = await signOut(page).evaluate((button) => {
    const s = getComputedStyle(button), r = button.getBoundingClientRect()
    return { visible:button.matches(':focus-visible'), outline:s.outlineStyle, width:parseFloat(s.outlineWidth),
      height:r.height, hit:button.contains(document.elementFromPoint(r.x + r.width/2, r.y + r.height/2)) }
  })
  expect(focus.visible).toBe(true)
  expect(focus.outline).not.toBe('none')
  expect(focus.width).toBeGreaterThan(0)
  expect(focus.height).toBeGreaterThanOrEqual(44)
  expect(focus.hit).toBe(true)
}

for (const width of [390, 768, 1440]) {
  test(`RF-13: navigation, keyboard focus and authenticated Sign Out at ${width}px`, { tag: [390, 768].includes(width) ? ['@smoke'] : [] }, async ({ page, context }, info) => {
    const state = await backend(context, [application(1)])
    const originalUser = structuredClone(state.user)
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    await keyboardMenu(page)
    for (const [name, heading] of pages) {
      const { menu, media } = await shell(page)
      const label = media.compact ? name === 'Job Agent' ? 'Agent' : name === 'Import Excel' ? 'Import' : name : name
      await menu.getByRole('button', { name: label, exact: true }).focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('heading', { name: heading, level: 1, exact: true })).toBeVisible()
      await shell(page)
      await noOverflow(page)
    }
    await nav(page, 'Profile')
    await expect(page.locator('.profile-page')).toBeVisible()
    await expect(signOut(page)).toHaveCount(1)
    const { media } = await shell(page)
    await info.attach('viewport', { body:JSON.stringify({ requestedWidth:width, ...media }), contentType:'application/json' })
    await keyboardSignOut(page)
    await page.screenshot({ path:info.outputPath(`profile-focus-${width}.png`), fullPage:true })
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name:'Sign in to your workspace.', exact:true })).toBeVisible()
    expect(state.requests.filter(r => r.table === 'logout')).toHaveLength(1)
    expect(state.user).toEqual(originalUser)
    expect(state.applications).toEqual([application(1)])
    expect(state.blocked).toEqual([])
  })
}

test('RF-13: live resizing preserves one exit and the authenticated session', async ({ page, context }, info) => {
  const state = await backend(context)
  await signIn(page)
  await nav(page, 'Profile')
  await expect(page.locator('.profile-page')).toBeVisible()
  const evidence = []
  for (const width of widths) {
    await page.setViewportSize({ width, height:900 })
    await expect(signOut(page)).toHaveCount(1)
    const { media } = await shell(page)
    evidence.push({ requestedWidth:width, ...media })
    await noOverflow(page)
  }
  expect(state.requests.filter(r => ['token','logout'].includes(r.table)).map(r=>r.table)).toEqual(['token'])
  await info.attach('resize-boundaries', { body:JSON.stringify(evidence), contentType:'application/json' })
})

test('RF-13: fractional CSS viewports have no navigation or Sign Out gap', async ({ page, context }, info) => {
  const state = await backend(context)
  await context.route('http://127.0.0.1:5195/rf13-frame', route => route.fulfill({ contentType:'text/html',
    body:'<iframe title="Synthetic fractional viewport" style="width:720.5px;height:900px;border:0" src="/#/sign-in"></iframe>' }))
  await page.goto('/rf13-frame')
  const frame = page.frames().find(f => f !== page.mainFrame())
  await signIn(frame)
  await nav(frame, 'Profile')
  await expect(frame.locator('.profile-page')).toBeVisible()
  const evidence = []
  for (const width of [639.5,640.5,719.5,720.5,899.5,900.5,1039.5,1040.5]) {
    await page.locator('iframe').evaluate((e,w) => { e.style.width = `${w}px` },width)
    const { media } = await shell(frame)
    await expect(signOut(frame)).toHaveCount(1)
    evidence.push({ cssWidth:width, ...media })
  }
  expect(state.blocked).toEqual([])
  await info.attach('fractional-boundaries', { body:JSON.stringify(evidence), contentType:'application/json' })
})
