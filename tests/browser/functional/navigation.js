import { expect } from '@playwright/test'

export async function expectNavigationShell(page) {
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
