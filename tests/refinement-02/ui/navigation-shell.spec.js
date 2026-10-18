import { expect, test } from '@playwright/test'
import { application, backend, nav, noOverflow, signIn } from './fixtures.js'

test('UI-01: canonical shell geometry, fonts, tooltips, Add and browser history', async ({ page, context }, info) => {
  test.setTimeout(60000)
  const state = await backend(context, [application(1)])
  await signIn(page)
  const evidence = []
  for (const width of [390, 639, 640, 768, 900, 1039, 1040, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.locator('.sidebar-nav [aria-current="page"]')).toHaveAttribute('aria-label', 'Dashboard')
    await expect(page.locator('.app-content')).toHaveCSS('opacity', '1')
    await page.evaluate(() => document.fonts.ready)
    // Firefox can round innerWidth while media queries retain a fractional CSS viewport.
    const media = await page.evaluate(() => ({
      mobile: matchMedia('(width < 640px)').matches,
      rail: matchMedia('(640px <= width < 1040px)').matches,
      desktop: matchMedia('(width >= 1040px)').matches,
      visualWidth: visualViewport.width,
    }))
    expect([media.mobile, media.rail, media.desktop].filter(Boolean)).toHaveLength(1)
    const { mobile } = media
    const sidebarWidth = media.rail ? 76 : 248
    if (!mobile) await expect(page.locator('.sidebar')).toHaveCSS('width', `${sidebarWidth}px`)
    const menu = page.getByRole('navigation', { name: mobile ? 'Mobile navigation' : 'Primary navigation', exact: true })
    const geometry = await page.locator('.app-layout').evaluate((root) => {
      const sidebar = root.querySelector('.sidebar'), content = root.querySelector('.app-content')
      const header = root.querySelector('.mobile-app-bar'), bottom = root.querySelector('.mobile-bottom-nav')
      const box = (el) => { const r = el.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height } }
      return { sidebar:box(sidebar), content:box(content), header:box(header), bottom:box(bottom),
        sidebarColor:getComputedStyle(sidebar).backgroundColor, bg:getComputedStyle(root).backgroundColor,
        font:getComputedStyle(root).fontFamily, loaded:document.fonts.check('600 14px Figtree') }
    })
    expect(geometry.bg).toBe('rgb(241, 222, 186)')
    expect(geometry.font).toContain('Figtree')
    expect(geometry.loaded).toBe(true)
    expect(geometry.content.left).toBe(mobile ? 0 : sidebarWidth)
    if (mobile) {
      expect(geometry.header.height).toBe(60)
      expect(geometry.bottom.height).toBe(70)
      expect(geometry.content.top + await page.locator('.app-content').evaluate(e => parseFloat(getComputedStyle(e).paddingTop))).toBeGreaterThanOrEqual(geometry.header.bottom)
    } else {
      expect(geometry.sidebar.width).toBe(sidebarWidth)
      expect(geometry.sidebarColor).toBe('rgb(40, 106, 115)')
      if (media.rail) {
        await menu.getByRole('button', { name: 'Progress', exact: true }).focus()
        await page.keyboard.press('Tab')
        await page.keyboard.press('Shift+Tab')
        await expect(menu.locator('.rail-tooltip').filter({ hasText: /^Progress$/ })).toBeVisible()
      }
    }
    await expect(menu.locator('[aria-current="page"]')).toHaveAttribute('aria-label', 'Dashboard')
    const add = page.locator(mobile ? '.mobile-add-action' : '.sidebar-primary-action')
    await add.click()
    await expect(page.getByRole('heading', { name: 'Add a new application', exact:true })).toBeVisible()
    await expect(page.locator('.sidebar-primary-action, .mobile-add-action').filter({ visible:true })).toHaveCount(0)
    await page.goBack()
    await expect(menu.locator('[aria-current="page"]')).toHaveAttribute('aria-label', 'Dashboard')
    await page.goForward()
    await expect(page.getByRole('heading', { name:'Add a new application', exact:true })).toBeVisible()
    await nav(page, 'Dashboard')
    await expect(page.getByRole('heading', { name:'Your application pipeline', exact:true })).toBeVisible()
    await expect(page.locator('.sidebar-nav [aria-current="page"]')).toHaveAttribute('aria-label', 'Dashboard')
    await noOverflow(page)
    evidence.push({ width, media, ...geometry })
    if ([390,768,1440].includes(width)) await page.screenshot({ path:info.outputPath(`shell-${width}.png`), fullPage:true, animations:'disabled' })
  }
  expect(state.blocked).toEqual([])
  expect(state.requests.filter(r => !['GET','HEAD'].includes(r.method) && r.table !== 'token')).toEqual([])
  await info.attach('shell-geometry', { body:JSON.stringify(evidence), contentType:'application/json' })
})

test('UI-01: navigation indicator travels to the active destination without remounting page data', async ({ page, context }) => {
  await page.addInitScript(() => {
    const animate = Element.prototype.animate
    window.shellAnimationEvidence = []
    Element.prototype.animate = function (frames, options) {
      if (this.classList.contains('sidebar-indicator')) window.shellAnimationEvidence.push({ frames, duration:options.duration })
      return animate.call(this, frames, options)
    }
  })
  const state = await backend(context, [application(1)])
  await signIn(page)
  await nav(page, 'Profile')
  const indicator = page.locator('.sidebar-indicator')
  await expect(page.locator('.sidebar-nav [aria-current="page"]')).toHaveAttribute('aria-label','Profile')
  const motion = await page.evaluate(() => window.shellAnimationEvidence)
  expect(motion.some(({ frames, duration }) => duration === 320 && frames.some(frame=>frame.transform === 'translateY(48px)'))).toBe(true)
  await indicator.evaluate(el => Promise.all(el.getAnimations().map(a=>a.finished)))
  await expect(indicator).toHaveCSS('transform','matrix(1, 0, 0, 1, 0, 48)')
  await page.setViewportSize({ width:768, height:440 })
  const signOut = page.locator('.sidebar .sign-out-button')
  await signOut.focus()
  await expect(signOut).toBeInViewport()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name:'Sign in to your workspace.' })).toBeVisible()
  expect(state.requests.filter(r=>r.table === 'logout')).toHaveLength(1)
})
