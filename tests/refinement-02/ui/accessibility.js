import { expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

export async function settlePage(page) {
  await expect(page.locator('main h1').filter({ visible: true })).toBeVisible()
  await expect(page.locator('.page-loading-state')).toHaveCount(0)
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(document.getAnimations()
      .filter((animation) => Number.isFinite(animation.effect.getTiming().iterations))
      .map((animation) => animation.finished.catch(() => {})))
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
}

export async function expectAccessiblePage(page) {
  await settlePage(page)
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(result.violations).toEqual([])
}
