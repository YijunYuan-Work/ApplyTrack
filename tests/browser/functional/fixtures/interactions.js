import { expect } from '@playwright/test'

export async function openDetails(page) {
  await page.getByRole('button', { name: /^View details for/ }).filter({ visible: true }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

export async function closeDetails(page) {
  await page.getByRole('button', { name: 'Close application details', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

export async function signIn(page) {
  await page.goto('/#/sign-in')
  await page.getByLabel('Username').fill('auditor')
  await page.getByLabel('Password', { exact: true }).fill('synthetic-password')
  await page.locator('button[type="submit"]').click()
  await expect(page.getByRole('heading', { name: 'Your application pipeline' }).filter({ visible: true })).toBeVisible()
}

export async function nav(page, name) {
  if (name === 'Matches') return page.getByRole('button', { name: /^Matches/ }).click()
  await page.getByRole('button', { name, exact: true }).filter({ visible: true }).first().click()
}

export async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
