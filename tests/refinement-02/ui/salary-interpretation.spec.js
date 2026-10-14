import { expect, test } from '@playwright/test'
import { backend, lead, nav, noOverflow, signIn } from './fixtures.js'

const examples = [
  { company: 'Shorthand annual', description: '$90k - $120k a year', salary_min: 90000, salary_max: 120000, label: '$90k - $120k a year' },
  { company: 'Conventional annual', description: '$90,000 - $120,000 per year', label: '$90,000 - $120,000 per year' },
  { company: 'Unknown period', description: '$90K\u2013$120K', label: '$90K\u2013$120K' },
  { company: 'Single amount', description: '$100k', label: '$100k' },
  { company: 'Decimal shorthand', description: '$2.01k a year', salary_min: 2010, label: '$2.01k a year' },
  { company: 'Hourly amount', description: '$40 per hour', label: '$40 per hour' },
  { company: 'Explicit currency', description: 'USD $100k a year', salary_min: 100000, label: 'USD $100k a year' },
  { company: 'Reversed range', description: '$120k - $90k a year', label: null },
  { company: 'Malformed range', description: '$90,00 - $120k per year', label: null },
  { company: 'Stored bounds', description: '$90k - $120k a year', salary_min: 95000, salary_max: 125000, label: '95,000 - 125,000' },
  { company: 'Stored zero bound', description: '', salary_min: 0, salary_max: 125000, label: '0 - 125,000' },
]

for (const width of [1440, 768, 390]) {
  test(`RF-15: salary labels, omission and queue actions remain accurate at ${width}px`, async ({ page, context }, info) => {
    test.setTimeout(60000)
    const rows = examples.map((row, index) => lead(index + 1, {
      company: row.company, description: row.description,
      salary_min: row.salary_min ?? null, salary_max: row.salary_max ?? null,
    }))
    const state = await backend(context, [], rows)
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    await page.goto('/#/job-agent/matches')
    await expect(page.locator('.agent-lead')).toHaveCount(rows.length, { timeout: 20000 })
    for (const { company, label } of examples) {
      const card = page.locator('.agent-lead').filter({ has: page.getByText(company, { exact: true }) })
      const salary = card.locator('.agent-lead-details .agent-meta-item').nth(1)
      if (label) await expect(salary).toHaveText(label)
      else await expect(card.locator('.agent-lead-details .agent-meta-item')).toHaveCount(1)
      await expect(card.getByRole('link', { name: /View on/ })).toBeVisible()
      await expect(card.getByRole('button', { name: 'Finished applying', exact: true })).toBeVisible()
    }
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath(`salary-${width}.png`), fullPage: true })
    await page.getByLabel('Search jobs waiting to be applied').fill('Hourly amount')
    await expect(page.locator('.agent-lead')).toHaveCount(1)
    await expect(page.locator('.agent-lead')).toContainText('$40 per hour')
    page.once('dialog', (dialog) => dialog.dismiss())
    await nav(page, 'Remove')
    await expect(page.locator('.agent-lead')).toHaveCount(1)
    await page.getByLabel('Search jobs waiting to be applied').fill('')
    await expect(page.locator('.agent-lead')).toHaveCount(rows.length)
    const annual = page.locator('.agent-lead').filter({ has: page.getByText('Shorthand annual', { exact: true }) })
    await annual.screenshot({ path: info.outputPath(`annual-card-${width}.png`) })
    page.once('dialog', (dialog) => dialog.accept())
    await annual.getByRole('button', { name: 'Finished applying', exact: true }).click()
    await expect(annual).toHaveCount(0)
    expect(state.leads.find((row) => row.company === 'Shorthand annual').state).toBe('applied')
    await nav(page, 'Dashboard')
    await expect(page.getByText('Shorthand annual', { exact: true })).toBeVisible()
    expect(state.blocked).toEqual([])
  })
}
