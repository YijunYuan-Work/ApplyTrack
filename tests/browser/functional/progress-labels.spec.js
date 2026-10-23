import { expect, test } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { application, backend, nav, noOverflow, signIn } from './fixtures.js'

const distributions = {
  small: [1, 1, 1, 1],
  'small outcomes': [1, 1, 1, 97],
  'uneven outcomes': [97, 1, 1, 1],
}

function rows([offers, rejected, pending, applied]) {
  return [
    ...Array.from({ length: offers }, () => ({ status: 'Offer' })),
    ...Array.from({ length: rejected }, () => ({ status: 'Rejected', interview_count: 1 })),
    ...Array.from({ length: pending }, () => ({ status: 'Interview' })),
    ...Array.from({ length: applied }, () => ({ status: 'Applied' })),
  ].map((row, index) => application(index + 1, row))
}

async function labelGeometry(page) {
  return page.locator('.progress-chart').evaluate((chart) => {
    const bounds = chart.getBoundingClientRect()
    const labels = [...chart.querySelectorAll('.progress-flow-node')].map((node) => {
      const boxes = [...node.querySelectorAll('text')].map((text) => text.getBoundingClientRect())
      return {
        name: node.getAttribute('aria-label'),
        left: Math.min(...boxes.map((b) => b.left)),
        right: Math.max(...boxes.map((b) => b.right)),
        top: Math.min(...boxes.map((b) => b.top)),
        bottom: Math.max(...boxes.map((b) => b.bottom)),
      }
    })
    const overlaps = []
    for (let i = 0; i < labels.length; i++) {
      for (const other of labels.slice(i + 1)) {
        const label = labels[i]
        if (
          label.left < other.right &&
          label.right > other.left &&
          label.top < other.bottom &&
          label.bottom > other.top
        )
          overlaps.push([label.name, other.name])
      }
    }
    const clipped = labels.filter(
      (l) =>
        l.left < bounds.left - 1 ||
        l.right > bounds.right + 1 ||
        l.top < bounds.top - 1 ||
        l.bottom > bounds.bottom + 1,
    )
    const nodes = [...chart.querySelectorAll('.progress-flow-node rect')].map((rect) => {
      const b = rect.getBoundingClientRect()
      return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }
    })
    const nodeCollisions = labels.flatMap((label) =>
      nodes
        .filter(
          (node) =>
            label.left < node.right &&
            label.right > node.left &&
            label.top < node.bottom &&
            label.bottom > node.top,
        )
        .map(() => label.name),
    )
    return { labels, overlaps, clipped, nodeCollisions }
  })
}

async function expectReadableLabels(page) {
  await page.evaluate(() => document.fonts.ready)
  await expect
    .poll(async () => {
      const { overlaps, clipped, nodeCollisions } = await labelGeometry(page)
      return { overlaps, clipped, nodeCollisions }
    })
    .toEqual({ overlaps: [], clipped: [], nodeCollisions: [] })
}

for (const width of [1440, 768]) {
  for (const [distribution, counts] of Object.entries(distributions)) {
    test(`Progress: Pipeline labels do not collide at ${width}px with ${distribution}`, async ({
      page,
      context,
    }, testInfo) => {
      const state = await backend(context, rows(counts))
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.setViewportSize({ width, height: 900 })
      await signIn(page)
      await nav(page, 'Progress')
      await expect(page.locator('.progress-node-count')).toHaveText([
        String(counts.reduce((sum, n) => sum + n, 0)),
        String(counts[0] + counts[1] + counts[2]),
        String(counts[0]),
        String(counts[1]),
        String(counts[2]),
        String(counts[3]),
      ])
      await expectReadableLabels(page)
      await expect(page.locator('main')).toHaveCount(1)
      await noOverflow(page)
      const boundsPath = testInfo.outputPath('label-bounds.json')
      await writeFile(boundsPath, JSON.stringify(await labelGeometry(page), null, 2))
      await testInfo.attach('label-bounds', { path: boundsPath, contentType: 'application/json' })
      const screenshotPath = testInfo.outputPath('pipeline-map.png')
      await page.locator('.progress-chart-panel').screenshot({
        path: screenshotPath,
        animations: 'disabled',
      })
      await testInfo.attach('pipeline-map', {
        path: screenshotPath,
        contentType: 'image/png',
      })
      expect(state.blocked).toEqual([])
    })
  }
}

test('Progress: packed labels follow live resizing, motion and keyboard/hover inspection', async ({
  page,
  context,
}) => {
  test.setTimeout(60000)
  const state = await backend(context, rows(distributions['small outcomes']))
  await signIn(page)
  await nav(page, 'Progress')
  await page.locator('.progress-chart').evaluate(async (chart) => {
    await Promise.all(chart.getAnimations({ subtree: true }).map((animation) => animation.finished))
  })
  await expectReadableLabels(page)
  await expect(page.locator('.progress-flow-link').first()).toHaveCSS('animation-duration', '0.7s')
  for (const width of [768, 1039, 1040, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.locator('.app-layout').evaluate(async (layout) => {
      await Promise.all(
        layout
          .getAnimations({ subtree: true })
          .filter((animation) => Number.isFinite(animation.effect.getTiming().iterations))
          .map((animation) => animation.finished.catch(() => {})),
      )
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
    await expectReadableLabels(page)
    const node = page.locator('.progress-flow-node[aria-label="Still in progress: 1 applications"]')
    await node.focus()
    await expect(node).toBeFocused()
    await expect(page.locator('.progress-inspection')).toHaveText(
      'Still in progress: 1 applications',
    )
    await page.getByRole('button', { name: 'Pipeline map', exact: true }).focus()
    await page.mouse.move(0, 0)
    await expect(page.locator('.progress-inspection')).toBeEmpty()
    // WebKit's SVG text automation quads omit transforms; hit-test client coordinates instead.
    const point = await node.locator('.progress-node-name').evaluate((label) => {
      const box = label.getBoundingClientRect()
      const x = box.left + box.width / 2
      const y = box.top + box.height / 2
      return { x, y, hit: label.contains(document.elementFromPoint(x, y)) }
    })
    expect(point.hit).toBe(true)
    await page.mouse.move(point.x, point.y)
    await expect(page.locator('.progress-inspection')).toHaveText(
      'Still in progress: 1 applications',
    )
    await noOverflow(page)
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 900 })
  await expect(page.locator('.progress-chart')).toHaveCount(0)
  await expect(page.locator('.compact-progress-list')).toBeVisible()
  await page.setViewportSize({ width: 768, height: 900 })
  await expect(page.locator('.progress-node-count')).toHaveCount(6)
  await expectReadableLabels(page)
  expect(state.blocked).toEqual([])
})
