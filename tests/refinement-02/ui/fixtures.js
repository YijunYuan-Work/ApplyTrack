import { Buffer } from 'node:buffer'
import { expect } from '@playwright/test'
import * as XLSX from 'xlsx'

export const userId = '00000000-0000-4000-8000-000000000001'
const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'auditor@127.0.0.1', user_metadata: { username: 'auditor', name: 'Auditor', profileEmail: 'synthetic@example.invalid' }, app_metadata: { provider: 'email', providers: ['email'] }, created_at: '2026-01-01T00:00:00Z' }

export function application(id, overrides = {}) {
  return { id, user_id: userId, company: `Synthetic ${id}`, role: 'Engineer', location: 'Toronto', status: 'Applied', applied_date: `2026-01-${String(id % 28 + 1).padStart(2, '0')}`, last_updated: '2026-01-01', updated_at: '2026-01-01T00:00:00.000Z', follow_up: null, job_url: 'https://example.invalid/job', notes: '', salary: '', contact: '', cover_letter: 'No', referral: 'No', interview_count: 0, ...overrides }
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
  Object.assign(state, { user, version: 0, controlStatus: false, statusUpdates: [], controlSaves: false, saves: [], holdReads: false, reads: [], failStatusReads: false, holdUsers: false, users: [], failUsers: false })
  Object.assign(state, { controlDeletes: false, deletes: [], deleteAllowedIds: null })
  Object.assign(state, { controlLeadDeletes: false, leadDeletes: [], leadDeleteAllowedIds: null,
    leadMaxRows: 1000, failLeadReads: false, controlLeadReads: false, leadReads: [], omitLeadCount: false })
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin === 'http://127.0.0.1:5195') return route.continue()
    if (url.origin !== 'http://127.0.0.1:54399') { state.blocked.push(url.origin); return route.abort() }
    const method = request.method()
    const single = request.headers().accept?.includes('vnd.pgrst.object')
    const body = request.postDataJSON()
    const table = url.pathname.split('/').at(-1)
    state.requests.push({ method, table, body, query: url.search, headers: request.headers() })
    if (table === 'token' || table === 'signup') {
      const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
      const exp = Math.floor(Date.now() / 1000) + 3600
      return route.fulfill({ json: { user: state.user, access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: state.user.id, aud: 'authenticated', role: 'authenticated', exp })}.synthetic`, refresh_token: 'synthetic', expires_in: 3600, expires_at: exp, token_type: 'bearer' } })
    }
    if (table === 'user') {
      if (state.failUsers) return route.fulfill({ status: 401, json: { message: 'Synthetic invalid JWT' } })
      const snapshot = structuredClone(state.user)
      if (state.holdUsers) { state.users.push(() => route.fulfill({ json: snapshot })); return }
      return route.fulfill({ json: snapshot })
    }
    if (table === 'logout') return route.fulfill({ status: 204 })
    if (table === 'complete_job_lead_application') {
      const item = state.leads.find((item) => item.id === body.p_job_lead_id)
      if (!item.application_id) {
        const created = application(10000 + item.id, {
          company: item.company, role: item.title, applied_date: body.p_applied_date,
          notes: `Added from ${item.source === 'linkedin' ? 'LinkedIn' : 'Indeed'} after the application was confirmed as submitted.`,
        })
        state.applications.push(created)
        item.application_id = created.id
      }
      item.state = 'applied'
      return route.fulfill({ json: state.applications.find((row) => row.id === item.application_id) })
    }
    const source = table === 'applications' ? state.applications : table === 'job_leads' ? state.leads : table === 'job_alert_inboxes' ? [state.inbox] : table === 'job_alert_messages' ? state.messages : []
    const matches = (row) => [...url.searchParams].every(([key, value]) => {
      if (value.startsWith('eq.')) return String(row[key]) === value.slice(3)
      if (value.startsWith('in.(')) return value.slice(4, -1).split(',').includes(String(row[key]))
      if (value === 'is.null') return row[key] == null
      if (value.startsWith('gt.')) return Number(row[key]) > Number(value.slice(3))
      if (value.startsWith('lte.')) return Number(row[key]) <= Number(value.slice(4))
      if (key === 'or') {
        const clauses = [...value.matchAll(/(company|title|location)\.ilike\.("(?:\\.|[^"\\])*")/g)]
        return clauses.some(([, field, encoded]) => {
          const text = JSON.parse(encoded).slice(1, -1).replace(/\\([\\%_])/g, '$1')
          return String(row[field] || '').toLowerCase().includes(text.toLowerCase())
        })
      }
      return true
    })
    let result = source.filter(matches)
    if (method === 'POST') {
      if (state.failInsert) return route.fulfill({ status: 400, json: { message: 'Synthetic insert failure' } })
      if (state.controlSaves && table === 'applications') {
        let response
        const operation = {
          body, query: url.search,
          commit: () => {
            if (!response) {
              response = (Array.isArray(body) ? body : [body]).map((row, index) => ({ id: 1000 + source.length + index, updated_at: '2026-01-01T00:00:00.000Z', ...row }))
              source.push(...structuredClone(response))
            }
            return response
          },
          respond: () => route.fulfill({ json: single ? operation.commit()[0] : operation.commit() }),
          fail: () => route.fulfill({ status: 400, json: { message: 'Synthetic save failure' } }),
        }
        state.saves.push(operation)
        return
      }
      result = (Array.isArray(body) ? body : [body]).map((row, index) => ({ id: 1000 + source.length + index, updated_at: '2026-01-01T00:00:00.000Z', ...row }))
      source.push(...result)
      if (state.holdInserts) { state.pending.push(() => route.fulfill({ json: structuredClone(result[0]) })); return }
    }
    if (method === 'PATCH') {
      // Match the version at commit time, not when the HTTP request arrived.
      const commit = () => {
        result = source.filter(matches)
        result.forEach((row) => Object.assign(row, body, { updated_at: new Date(Date.UTC(2026, 0, 1) + ++state.version).toISOString() }))
        return structuredClone(result)
      }
      const isStatus = url.searchParams.get('select') !== '*'
      if (table === 'applications' && ((state.controlStatus && isStatus) || (state.controlSaves && !isStatus))) {
        let response
        const operation = {
          body, query: url.search,
          commit: () => response ??= commit(),
          respond: () => {
            const rows = operation.commit()
            return route.fulfill({ json: single ? rows[0] ?? null : rows })
          },
          fail: () => route.fulfill({ status: 400, json: { message: isStatus ? 'Synthetic status failure' : 'Synthetic save failure' } }),
          abort: () => route.abort('failed'),
        }
        const operations = isStatus ? state.statusUpdates : state.saves
        operations.push(operation)
        return
      }
      commit()
      const response = structuredClone(result)
      if (state.holdUpdates) { state.pending.push(() => route.fulfill({ json: single ? response[0] ?? null : response })); return }
    }
    if (method === 'DELETE') {
      if (state.failDelete) return route.fulfill({ status: 400, json: { message: 'Synthetic delete failure' } })
      const commit = () => {
        const current = table === 'applications' ? state.applications : table === 'job_leads' ? state.leads : source
        result = current.filter((row) => matches(row) &&
          (table !== 'applications' || state.deleteAllowedIds === null || state.deleteAllowedIds.includes(row.id)),
        )
        if (table === 'job_leads' && state.leadDeleteAllowedIds !== null) result = result.filter((row) => state.leadDeleteAllowedIds.includes(row.id))
        const kept = current.filter((row) => !result.includes(row))
        if (table === 'applications') state.applications = kept
        if (table === 'job_leads') state.leads = kept
        return structuredClone(url.searchParams.get('select') === 'id' ? result.map(({ id }) => ({ id })) : result)
      }
      const deletedResponse = (rows) => {
        const headers = request.headers().prefer?.includes('count=exact')
          ? { 'access-control-expose-headers': 'Content-Range', 'content-range': `*/${result.length}` } : {}
        const returned = table === 'job_leads' ? rows?.slice(0, state.leadMaxRows) : rows
        return route.fulfill({ headers, json: single ? returned?.[0] ?? null : returned })
      }
      if ((state.controlDeletes && table === 'applications') || (state.controlLeadDeletes && table === 'job_leads')) {
        let response
        const operation = {
          query: url.search,
          commit: () => response ??= commit(),
          respond: (override) => {
            const rows = override === undefined ? operation.commit() : override
            return deletedResponse(rows)
          },
          fail: () => route.fulfill({ status: 400, json: { message: 'Synthetic delete failure' } }),
          abort: () => route.abort('failed'),
        }
        ;(table === 'job_leads' ? state.leadDeletes : state.deletes).push(operation)
        return
      }
      const deleted = commit()
      return deletedResponse(deleted)
    }
    if (method === 'GET' || method === 'HEAD') {
      if (table === 'job_leads' && state.failLeadReads) return route.fulfill({ status: 400, json: { message: 'Synthetic queue read failure' } })
      if (table === 'applications' && url.searchParams.get('select') !== '*' && state.failStatusReads) {
        return route.fulfill({ status: 400, json: { message: 'Synthetic status read failure' } })
      }
      const order = url.searchParams.get('order')
      if (order) {
        result.sort((a, b) => {
          for (const entry of order.split(',')) {
            const [key, direction] = entry.split('.')
            const difference = key === 'id' ? Number(a[key]) - Number(b[key]) : String(a[key]).localeCompare(String(b[key]))
            if (difference) return difference * (direction === 'desc' ? -1 : 1)
          }
          return 0
        })
      }
      const total = result.length
      const offset = Number(url.searchParams.get('offset') || 0)
      const limit = Math.min(Number(url.searchParams.get('limit') || Infinity), table === 'job_leads' ? state.leadMaxRows : Infinity)
      result = result.slice(offset, offset + limit)
      const countHeaders = request.headers().prefer?.includes('count=exact') && !state.omitLeadCount
        ? { 'access-control-expose-headers': 'Content-Range', 'content-range': result.length ? `${offset}-${offset + result.length - 1}/${total}` : `*/${total}` } : {}
      if (method === 'HEAD') return route.fulfill({ status: 200, headers: countHeaders, body: '' })
      if (table === 'job_leads') {
        const columns = url.searchParams.get('select')
        if (columns && columns !== '*') result = result.map((row) => Object.fromEntries(columns.split(',').map((key) => [key, row[key]])))
        const snapshot = structuredClone(result)
        if (state.controlLeadReads) {
          state.leadReads.push({ query: url.search,
            respond: () => route.fulfill({ headers: countHeaders, json: snapshot }),
          })
          return
        }
        return route.fulfill({ headers: countHeaders, json: single ? snapshot[0] ?? null : snapshot })
      }
      if (table === 'applications' && url.searchParams.get('select') === '*' && state.holdReads) {
        const snapshot = structuredClone(result)
        state.reads.push(() => route.fulfill({ json: single ? snapshot[0] ?? null : snapshot }))
        return
      }
    }
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
