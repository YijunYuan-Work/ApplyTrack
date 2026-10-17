import { expect, test } from '@playwright/test'
import { application, backend, nav, noOverflow, signIn } from './fixtures.js'

const widths = [390, 639, 640, 720, 721, 768, 898, 900, 901, 1039, 1040, 1440]
const signOut = (page) => page.getByRole('button', { name: 'Sign out', exact: true }).filter({ visible: true })
const pages = [
  ['Dashboard', 'Your application pipeline'], ['Profile', 'auditor'],
  ['Progress', 'Your application flow.'], ['Job Agent', 'Turn job alerts into an application queue.'],
  ['Import Excel', 'Bring in your existing tracker.'],
]

async function shell(page) {
  const media = await page.evaluate(() => ({ innerWidth, visualWidth: visualViewport.width,
    compact: matchMedia('(width < 640px)').matches, desktop:matchMedia('(width >= 1040px)').matches,
    rail: matchMedia('(640px <= width < 1040px)').matches,
    phone: matchMedia('(width < 640px)').matches }))
  expect(media.desktop).toBe(!media.compact && !media.rail)
  const menu = page.getByRole('navigation', { name: media.compact ? 'Mobile navigation' : 'Primary navigation', exact: true })
  await expect(menu).toBeVisible()
  await expect(page.locator('.sidebar')).toBeVisible({ visible: !media.compact })
  await expect(page.locator('.mobile-app-bar')).toBeVisible({ visible: media.compact })
  await expect(menu.getByRole('button')).toHaveCount(5)
  await expect(menu.locator('[aria-current="page"]')).toHaveCount(1)
  if (media.compact) {
    const header = await page.locator('.mobile-app-bar').evaluate((bar) => {
      const brand = bar.querySelector('.mobile-brand-lockup').getBoundingClientRect()
      const add = bar.querySelector('button'), r = add?.getBoundingClientRect()
      return r && r.width ? { brandRight:brand.right, left:r.left, width:r.width, height:r.height,
        hit:add.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)) } : null
    })
    if (header) {
      expect(header.brandRight).toBeLessThanOrEqual(header.left)
      expect(header.width).toBeGreaterThanOrEqual(44)
      expect(header.height).toBeGreaterThanOrEqual(44)
      expect(header.hit).toBe(true)
    }
  }
  const controls = await menu.getByRole('button').evaluateAll((buttons) => buttons.map((button) => {
    const r = button.getBoundingClientRect()
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height,
      hit: button.contains(hit), viewportWidth:innerWidth }
  }))
  for (const r of controls) {
    expect(r.width).toBeGreaterThanOrEqual(44)
    expect(r.height).toBeGreaterThanOrEqual(44)
    expect(r.left).toBeGreaterThanOrEqual(0)
    expect(r.right).toBeLessThanOrEqual(r.viewportWidth + 1)
    expect(r.hit).toBe(true)
  }
  for (let i = 1; i < controls.length; i += 1) {
    const a = controls[i - 1], b = controls[i]
    expect(a.right <= b.left + 0.1 || a.bottom <= b.top + 0.1).toBe(true)
  }
  return { menu, media }
}

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
  const { media } = await shell(page)
  if (media.compact) await page.getByRole('button', { name: 'Show confirmed password' }).focus()
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

for (const width of widths) {
  test(`RF-13: navigation, keyboard focus and authenticated Sign Out at ${width}px`, async ({ page, context }, info) => {
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
    await expect(page.locator('.profile-section')).toBeVisible()
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
  await expect(page.locator('.profile-section')).toBeVisible()
  const evidence = []
  for (const width of [1440, 1040, 1039, 900, 721, 720, 640, 639, 901, 390, 768]) {
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
  await expect(frame.locator('.profile-section')).toBeVisible()
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

for (const width of [390,768,1440]) {
  test(`RF-13: Demo navigation stays local and offers no account Sign Out at ${width}px`, async ({ page, context }) => {
    const state = await backend(context)
    await page.setViewportSize({ width, height:900 })
    await page.goto('/#/demo')
    for (const [name, heading] of pages) {
      const { menu, media } = await shell(page)
      const label = media.compact ? name === 'Job Agent' ? 'Agent' : name === 'Import Excel' ? 'Import' : name : name
      await menu.getByRole('button', { name:label, exact:true }).click()
      await expect(page.getByRole('heading', { name:name === 'Profile' ? 'Demo' : heading, level:1, exact:true })).toBeVisible()
      await expect(signOut(page)).toHaveCount(0)
      await noOverflow(page)
    }
    expect(state.requests).toEqual([])
    expect(state.blocked).toEqual([])
  })
}

for (const width of widths) {
  test(`RF-13: Calendar controls and compact content fit at ${width}px`, async ({ page, context }, info) => {
    const state = await backend(context, [application(1, { company:'A long synthetic company name for responsive checks', applied_date:'2026-01-09' })])
    await page.setViewportSize({ width, height:900 })
    await signIn(page)
    await nav(page, 'Progress')
    await expect(page.locator('.progress-summary')).toBeVisible({ timeout:15000 })
    await nav(page, 'Calendar')
    const geometry = await page.locator('.progress-calendar').evaluate((panel) => {
      const r = panel.getBoundingClientRect(), next = panel.querySelector('[aria-label="Next week"]').getBoundingClientRect()
      return { compact:matchMedia('(max-width: 900px)').matches, left:r.left, right:r.right, nextLeft:next.left, nextRight:next.right,
        client:panel.clientWidth, scroll:panel.scrollWidth, gridMin:getComputedStyle(panel.querySelector('.calendar-grid')).minWidth }
    })
    expect(geometry.nextLeft).toBeGreaterThanOrEqual(geometry.left)
    expect(geometry.nextRight).toBeLessThanOrEqual(geometry.right + 1)
    if (geometry.compact) {
      expect(geometry.scroll).toBeLessThanOrEqual(geometry.client + 1)
      expect(geometry.gridMin).toBe('0px')
      await expect(page.locator('.calendar-weekday').filter({ visible:true })).toHaveCount(0)
      const days = await page.locator('.calendar-day').evaluateAll(es=>es.map(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})))
      for (const d of days) { expect(d.left).toBeGreaterThanOrEqual(geometry.left); expect(d.right).toBeLessThanOrEqual(geometry.right + 1) }
    }
    const range = await page.locator('.calendar-range h3').textContent()
    const previous = page.getByRole('button', { name:'Previous week' })
    await previous.scrollIntoViewIfNeeded()
    await previous.focus()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name:'Next week' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('.calendar-range h3')).not.toHaveText(range)
    await previous.click()
    await expect(page.locator('.calendar-range h3')).toHaveText(range)
    await noOverflow(page)
    expect(state.requests.filter(r => ['POST','PATCH','DELETE'].includes(r.method) && !['token','logout'].includes(r.table))).toEqual([])
    expect(state.blocked).toEqual([])
    await info.attach('calendar-geometry', { body:JSON.stringify(geometry), contentType:'application/json' })
    await page.screenshot({ path:info.outputPath(`calendar-${width}.png`), fullPage:true })
  })
}
