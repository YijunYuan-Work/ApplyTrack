import { Buffer } from 'node:buffer'
import { expect } from '@playwright/test'
import * as XLSX from 'xlsx'

export const userId = '00000000-0000-4000-8000-000000000001'
const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'auditor@127.0.0.1', user_metadata: { username: 'auditor', name: 'Auditor', profileEmail: 'synthetic@example.invalid' }, app_metadata: { provider: 'email', providers: ['email'] }, created_at: '2026-01-01T00:00:00Z' }

export function application(id, overrides = {}) {
  return { id, user_id: userId, company: `Synthetic ${id}`, role: 'Engineer', location: 'Toronto', status: 'Applied', applied_date: `2026-01-${String(id % 28 + 1).padStart(2, '0')}`, last_updated: '2026-01-01', follow_up: null, job_url: 'https://example.invalid/job', notes: '', salary: '', contact: '', cover_letter: 'No', referral: 'No', interview_count: 0, ...overrides }
}

export function lead(id, overrides = {}) {
  return { id, user_id: userId, external_id: String(id), source: id % 2 ? 'linkedin' : 'indeed', state: 'new', company: `Lead ${id}`, title: 'Engineer', location: 'Toronto', description: 'Easy Apply', apply_url: `https://www.linkedin.com/jobs/view/${id}`, discovered_at: new Date(Date.UTC(2026, 0, 1, 0, id)).toISOString(), ...overrides }
}

export function spreadsheet(rows) {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Applications')
  return { name: 'synthetic.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) }
}

export async function backend(context, rows = [], leads = []) {
  const state = { applications: structuredClone(rows), leads: structuredClone(leads), requests: [], blocked: [], pending: [], holdUpdates: false, holdInserts: false, failDelete: false, failInsert: false, inbox: { id: 1, user_id: userId, address_alias: 'a'.repeat(32), enabled: true, last_received_at: '2026-01-01T00:00:00Z' }, messages: [] }
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin === 'http://127.0.0.1:5195') return route.continue()
    if (url.origin !== 'http://127.0.0.1:54399') { state.blocked.push(url.origin); return route.abort() }
    const method = request.method()
    const body = request.postDataJSON()
    const table = url.pathname.split('/').at(-1)
    state.requests.push({ method, table, body, query: url.search })
    if (table === 'token' || table === 'signup') {
      const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
      const exp = Math.floor(Date.now() / 1000) + 3600
      return route.fulfill({ json: { user, access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: userId, aud: 'authenticated', role: 'authenticated', exp })}.synthetic`, refresh_token: 'synthetic', expires_in: 3600, expires_at: exp, token_type: 'bearer' } })
    }
    if (table === 'user') return route.fulfill({ json: user })
    if (table === 'logout') return route.fulfill({ status: 204 })
    if (table === 'complete_job_lead_application') {
      const item = state.leads.find((item) => item.id === body.p_job_lead_id)
      if (!item.application_id) {
        const created = application(10000 + item.id, { company: item.company, role: item.title, applied_date: body.p_applied_date })
        state.applications.push(created)
        item.application_id = created.id
        item.state = 'applied'
      }
      return route.fulfill({ json: state.applications.find((row) => row.id === item.application_id) })
    }
    const source = table === 'applications' ? state.applications : table === 'job_leads' ? state.leads : table === 'job_alert_inboxes' ? [state.inbox] : table === 'job_alert_messages' ? state.messages : []
    let result = source.filter((row) => [...url.searchParams].every(([key, value]) => {
      if (value.startsWith('eq.')) return String(row[key]) === value.slice(3)
      if (value.startsWith('in.(')) return value.slice(4, -1).split(',').includes(String(row[key]))
      return true
    }))
    if (method === 'POST') {
      if (state.failInsert) return route.fulfill({ status: 400, json: { message: 'Synthetic insert failure' } })
      result = (Array.isArray(body) ? body : [body]).map((row, index) => ({ id: 1000 + source.length + index, ...row }))
      source.push(...result)
      if (state.holdInserts) { state.pending.push(() => route.fulfill({ json: structuredClone(result[0]) })); return }
    }
    if (method === 'PATCH') {
      result.forEach((row) => Object.assign(row, body))
      const response = structuredClone(result)
      if (state.holdUpdates) { state.pending.push(() => route.fulfill({ json: response[0] })); return }
    }
    if (method === 'DELETE') {
      if (state.failDelete) return route.fulfill({ status: 400, json: { message: 'Synthetic delete failure' } })
      const kept = source.filter((row) => !result.includes(row))
      if (table === 'applications') state.applications = kept
      if (table === 'job_leads') state.leads = kept
    }
    if (method === 'GET') {
      const order = url.searchParams.get('order')
      if (order) {
        const [key, direction] = order.split('.')
        result.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (direction === 'desc' ? -1 : 1))
      }
      if (url.searchParams.has('limit')) result = result.slice(0, Number(url.searchParams.get('limit')))
    }
    const single = request.headers().accept?.includes('vnd.pgrst.object')
    return route.fulfill({ json: single ? result[0] ?? null : result })
  })
  return state
}

export async function signIn(page) {
  await page.goto('/#/sign-in')
  await page.getByLabel('Username').fill('auditor')
  await page.getByLabel('Password', { exact: true }).fill('synthetic-password')
  await page.locator('button[type="submit"]').click()
  await expect(page.getByRole('heading', { name: 'Your application pipeline' }).filter({ visible: true })).toBeVisible()
}

export async function nav(page, name) {
  if (name === 'Matches') return page.getByRole('tab', { name: /^Matches/ }).click()
  await page.getByRole('button', { name, exact: true }).filter({ visible: true }).first().click()
}

export async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
