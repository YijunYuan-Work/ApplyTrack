import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { backend, closeDetails, noOverflow, openDetails } from './fixtures.js'

function contrast(foreground, background) {
  const luminance = (color) => {
    const [r, g, b] = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => {
      v /= 255
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const a = luminance(foreground), b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

async function noLegacyBlue(page) {
  const artifacts = await page.evaluate(() => {
    const old = new Set(['38,60,89', '97,126,158', '171,198,217', '188,187,213', '232,237,240', '62,83,114', '82,105,138', '98,117,142', '11,118,209', '7,92,167', '7,26,57'])
    return [...document.querySelectorAll('.app-layout *, .application-drawer, .application-drawer *')]
      .filter(el => el.getBoundingClientRect().width && el.getBoundingClientRect().height)
      .flatMap(el => {
        const style = getComputedStyle(el)
        return ['color', 'backgroundColor', 'borderTopColor', 'outlineColor', 'boxShadow', 'fill', 'stroke'].flatMap(property =>
          [...style[property].matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)]
            .filter(match => old.has(match.slice(1, 4).join(',')))
            .map(() => ({ element: el.className.baseVal ?? el.className, property })))
      })
  })
  expect(artifacts).toEqual([])
}

for (const width of [1440, 768, 390]) {
  test(`Version B: semantic colors, contrast and unchanged local workflows at ${width}px`, async ({ page, context }) => {
    test.setTimeout(60000)
    const state = await backend(context)
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/#/demo')
    await expect(page.getByRole('heading', { name: 'Your application pipeline', exact: true })).toBeVisible()
    await expect(page.locator('.app-layout')).toHaveCSS('background-color', 'rgb(241, 222, 186)')
    await expect(page.locator('.metric-card').first()).toHaveCSS('background-color', 'rgb(255, 253, 248)')
    await expect(page.locator('.metric-card-interviews .metric-icon')).toHaveCSS('background-color', 'rgb(182, 109, 85)')
    const add = page.locator(width < 640 ? '.mobile-add-action' : '.dashboard-add-action')
    await expect(add).toHaveCSS('background-color', 'rgb(160, 90, 67)')
    const foreground = await add.evaluate(el => getComputedStyle(el).color)
    expect(contrast(foreground, 'rgb(160, 90, 67)')).toBeGreaterThanOrEqual(4.5)
    await add.hover()
    await expect(add).toHaveCSS('background-color', 'rgb(138, 74, 53)')
    await noLegacyBlue(page)
    if (width >= 640) {
      await expect(page.locator('.sidebar')).toHaveCSS('background-color', 'rgb(40, 106, 115)')
      await expect(page.locator('.sidebar-primary-action')).toHaveCSS('background-color', 'rgb(243, 181, 157)')
      for (const selector of ['.sidebar-user-row', '.sidebar-footer-label']) {
        const foreground = await page.locator(selector).evaluate(el => getComputedStyle(el).color)
        expect(contrast(foreground, 'rgb(40, 106, 115)')).toBeGreaterThanOrEqual(4.5)
      }
    } else {
      await expect(page.locator('.mobile-bottom-nav')).toHaveCSS('background-color', 'rgb(255, 253, 248)')
    }
    await page.getByRole('button', { name: 'List', exact: true }).click()
    const colors = { Applied: 'rgb(215, 234, 234)', Interview: 'rgb(160, 90, 67)', Offer: 'rgb(40, 106, 115)', Rejected: 'rgb(251, 227, 216)' }
    for (const [status, background] of Object.entries(colors)) {
      const select = page.locator(`.application-status-control.status-${status.toLowerCase()} select`).first()
      await expect(select).toHaveCSS('background-color', background)
      const fg = await select.evaluate(el => getComputedStyle(el).color)
      expect(contrast(fg, background)).toBeGreaterThanOrEqual(4.5)
    }
    await openDetails(page)
    const drawer = page.getByRole('dialog')
    await expect(drawer).toHaveCSS('background-color', 'rgb(255, 253, 248)')
    await expect(drawer.locator('.application-record-details > div').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await expect(drawer.locator('.notes-block p')).toHaveCSS('background-color', 'rgb(247, 237, 218)')
    const axe = await new AxeBuilder({ page }).include('.application-drawer').withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(axe.violations).toEqual([])
    await noLegacyBlue(page)
    await closeDetails(page)
    await add.click()
    const company = page.locator('.application-form [name="company"]')
    await company.focus()
    await expect(company).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await expect(company).toHaveCSS('outline-color', 'rgb(182, 109, 85)')
    const semantics = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement)
      return ['--danger', '--danger-bg', '--warning', '--warning-bg', '--success', '--success-bg'].map(key => style.getPropertyValue(key).trim())
    })
    expect(semantics).toEqual(['#a63442', '#fbeef0', '#97640c', '#fff3dc', '#168a46', '#e4f3e9'])
    await noOverflow(page)
    await noLegacyBlue(page)
    expect(state.requests).toEqual([])
    expect(state.blocked).toEqual([])
  })
}
