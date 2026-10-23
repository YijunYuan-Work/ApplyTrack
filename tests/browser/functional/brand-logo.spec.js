import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { application, backend, noOverflow, signIn } from './fixtures.js'
import { expectAccessiblePage } from './accessibility.js'

const icon = '/brand/applytrack-icon-192.png'
// Fingerprints of the approved assets, not regenerated or recolored derivatives.
const assets = {
  [icon]: '3fd2717bf9967c217c6e6d256dddd3f141573aeb4118b3915019c9aae2c264b1',
  '/brand/applytrack-logo-512.png': '9898de06a79a657e6db42a0cee546044c74780069e73191cb5cb16821f3795a4',
  '/favicon.ico': '711f2d639931be0b9fc632ec97d0930d8f5ab3808a0740370868ed0dff5b014b',
  '/favicon-16.png': '07f9450191cfc5e792542fa07ab7024200c5910788dc6947713978abcf48673a',
  '/favicon-32.png': '96fb37825017e79d2f41d3172f766f890b84bb121a430ec94f46ad6969084270',
  '/favicon-48.png': 'cf27db35209c13aea69bd3009bef2a64afc930ac91a37736ec97a5081bd2cb8b',
  '/apple-touch-icon.png': '1e6159d4c2e741c05df377f9657950592ad18a73585e24b2c648d431be5c6aa7',
}

test('Brand: approved assets, favicon declarations and README reference load intact', async ({ page, request }) => {
  await page.goto('/#/demo')
  await expect(page.getByRole('heading', { name: 'Your application pipeline', exact: true })).toBeVisible()
  const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
  for (const [path, hash] of Object.entries(assets)) {
    const response = await request.get(path)
    expect(response.ok(), path).toBe(true)
    expect(response.headers()['content-type'], path).toMatch(/image\//)
    expect(digest(await response.body()), path).toBe(hash)
    expect(digest(readFileSync(new URL(`../../../public${path}`, import.meta.url))), path).toBe(hash)
  }
  await expect(page.locator('link[rel="icon"]')).toHaveCount(4)
  for (const size of [16, 32, 48]) {
    await expect(page.locator(`link[rel="icon"][sizes="${size}x${size}"]`)).toHaveAttribute('href', `/favicon-${size}.png`)
  }
  await expect(page.locator('link[rel="icon"][sizes="any"]')).toHaveAttribute('href', '/favicon.ico')
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png')
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('sizes', '180x180')
  const readme = readFileSync(new URL('../../../README.md', import.meta.url), 'utf8')
  expect(readme).toContain('<img src="public/brand/applytrack-logo-512.png" alt="ApplyTrack logo" width="96" height="96" />')
  expect(readFileSync(new URL('../../../index.html', import.meta.url), 'utf8')).not.toMatch(/favicon\.svg|vite\.svg/)
})

async function expectBrand(page, selector, size) {
  const image = page.locator(selector).filter({ visible: true })
  await expect(image).toHaveCount(1)
  await expect(image).toHaveAttribute('src', icon)
  await expect(image).toHaveAttribute('alt', '')
  await expect(image).toHaveJSProperty('complete', true)
  await expect(image).toHaveJSProperty('naturalWidth', 192)
  await expect(image).toHaveJSProperty('naturalHeight', 192)
  await expect(image).toHaveCSS('width', `${size}px`)
  await expect(image).toHaveCSS('height', `${size}px`)
  await expect(image).toHaveCSS('object-fit', 'contain')
  await expect(image).toHaveCSS('filter', 'none')
  await expect(image).toHaveCSS('border-radius', '0px')
  await expect(image).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  const geometry = await image.evaluate((el) => {
    const box = el.getBoundingClientRect(), parent = el.parentElement.getBoundingClientRect()
    const canvas = document.createElement('canvas')
    canvas.width = el.naturalWidth
    canvas.height = el.naturalHeight
    const context = canvas.getContext('2d')
    context.drawImage(el, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    return {
      inside: box.left >= parent.left && box.right <= parent.right && box.top >= parent.top && box.bottom <= parent.bottom,
      transparentCorner: pixels[3] === 0,
      hasArtwork: pixels.some((value, index) => index % 4 === 3 && value > 0),
    }
  })
  expect(geometry).toEqual({ inside: true, transparentCorner: true, hasArtwork: true })
  await noOverflow(page)
}

for (const width of [1440, 768, 390]) {
  test(`Brand: auth, account and demo placement at ${width}px`, async ({ page, context }, info) => {
    const state = await backend(context, [application(1)])
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/#/sign-in')
    await expect(page.getByRole('heading', { name: 'Sign in to your workspace.' })).toBeVisible()
    await expectBrand(page, '.account-brand > img', width >= 1040 ? 38 : 36)
    await expect(page.locator('.account-brand strong').filter({ visible: true })).toHaveText('ApplyTrack')
    await expectAccessiblePage(page)
    await page.screenshot({ path: info.outputPath(`auth-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Sign up', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Create your workspace.' })).toBeVisible()
    await expectBrand(page, '.account-brand > img', width >= 1040 ? 38 : 36)
    await signIn(page)
    const selector = width < 640 ? '.mobile-brand-mark' : '.brand-mark'
    await expectBrand(page, selector, width < 640 ? 32 : 36)
    await expectAccessiblePage(page)
    await page.screenshot({ path: info.outputPath(`account-${width}.png`), fullPage: true })
    await page.goto('/#/demo')
    await expect(page.getByRole('heading', { name: 'Your application pipeline', exact: true })).toBeVisible()
    await expectBrand(page, selector, width < 640 ? 32 : 36)
    await page.screenshot({ path: info.outputPath(`demo-${width}.png`), fullPage: true })
    expect(errors).toEqual([])
    expect(state.blocked).toEqual([])
  })
}
