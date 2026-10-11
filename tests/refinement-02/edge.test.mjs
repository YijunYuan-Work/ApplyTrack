import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { createHmac, randomBytes, webcrypto } from 'node:crypto'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'
import { parseHTML } from 'linkedom'
import { Resend } from 'resend'
import { parseJobAlert } from '../../supabase/functions/_shared/jobAlertParser.ts'

// Execute the actual handler. Network and the two remote clients are replaced, not the parser/signature verifier.
async function harness(options = {}) {
  let handler
  const secretBytes = randomBytes(32)
  const secret = `whsec_${secretBytes.toString('base64')}`
  const inbox = { id: 1, user_id: 'synthetic-user', address_alias: 'a'.repeat(32), enabled: true }
  const tables = { job_alert_inboxes: [inbox], job_alert_messages: [], job_leads: [] }
  const state = { tables, retrieveFailed: false, completionFailed: false, beforeUpsert: null, retrievals: 0 }
  const email = { from: 'jobs@linkedin.com', subject: 'Job alert', html: '<section><a href="https://www.linkedin.com/jobs/view/123">Software Engineer</a><p>Synthetic Company</p><p>Toronto, Ontario</p><p>Easy Apply</p></section>', text: '' }
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.operation = 'select' }
    select() { return this }
    eq(key, value) { this.filters.push((row) => row[key] === value); return this }
    in(key, values) { this.filters.push((row) => values.includes(row[key])); return this }
    insert(value) { this.operation = 'insert'; this.value = value; return this }
    update(value) { this.operation = 'update'; this.value = value; return this }
    upsert(value) { this.operation = 'upsert'; this.value = value; return this }
    single() { this.one = true; return this }
    maybeSingle() { this.one = true; return this }
    then(resolve, reject) { return this.execute().then(resolve, reject) }
    async execute() {
      const source = tables[this.table]
      let result = source.filter((row) => this.filters.every((filter) => filter(row)))
      if (this.operation === 'insert') { const row = { id: source.length + 1, ...this.value }; source.push(row); result = [row] }
      if (this.operation === 'update') {
        if (this.table === 'job_alert_messages' && this.value.status === 'completed' && state.completionFailed) return { data: null, error: { message: 'Synthetic completion failure' } }
        result.forEach((row) => Object.assign(row, this.value))
      }
      if (this.operation === 'upsert') {
        if (state.beforeUpsert) state.beforeUpsert()
        for (const row of this.value) {
          const existing = source.find((candidate) => candidate.external_id === row.external_id && candidate.source === row.source && candidate.user_id === row.user_id)
          if (existing) Object.assign(existing, row)
          else source.push({ id: source.length + 1, ...row })
        }
      }
      return { data: this.one ? structuredClone(result[0] || null) : structuredClone(result), error: null }
    }
  }
  class LocalResend {
    constructor() {
      this.webhooks = new Resend('synthetic-unused').webhooks
      this.emails = { receiving: { get: async () => { state.retrievals++; return state.retrieveFailed ? { data: null, error: { message: 'Synthetic retrieval failure' } } : { data: email, error: null } } } }
    }
  }
  const env = { SUPABASE_URL: 'http://loopback.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-unused', RESEND_API_KEY: 'synthetic-unused', RESEND_WEBHOOK_SECRET: secret, INBOUND_EMAIL_DOMAIN: 'inbound.example.invalid', ...options.env }
  const context = createContext({ Request, Response, URL, crypto: webcrypto, console: { error() {} }, structuredClone, fetch: () => { throw new Error('External network forbidden in audit') }, Deno: { env: { get: (name) => env[name] }, serve: (callback) => { handler = callback } } })
  const code = stripTypeScriptTypes(await readFile(new URL('../../supabase/functions/ingest-job-alert/index.ts', import.meta.url), 'utf8'))
  const module = new SourceTextModule(code, { context })
  await module.link(async (specifier) => {
    const exports = specifier.includes('supabase') ? { createClient: () => ({ from: (table) => new Query(table) }) } : specifier.includes('linkedom') ? { parseHTML } : specifier.includes('resend') ? { Resend: LocalResend } : { parseJobAlert }
    return new SyntheticModule(Object.keys(exports), function () { for (const [name, value] of Object.entries(exports)) this.setExport(name, value) }, { context })
  })
  await module.evaluate()
  const event = { type: 'email.received', created_at: '2026-01-01T00:00:00Z', data: { email_id: 'synthetic-message-1', from: email.from, subject: email.subject, to: [`${inbox.address_alias}@inbound.example.invalid`], received_for: [], created_at: '2026-01-01T00:00:00Z' } }
  const request = (changes = {}, valid = true) => {
    const payload = JSON.stringify({ ...event, ...changes })
    const id = 'synthetic-svix-id'
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = createHmac('sha256', secretBytes).update(`${id}.${timestamp}.${payload}`).digest('base64')
    return new Request('http://localhost/ingest', { method: 'POST', body: payload, headers: { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': valid ? `v1,${signature}` : 'v1,invalid' } })
  }
  return { handler, request, state, email, event }
}

test('Edge real Svix verification rejects forged signature and non-POST', async () => {
  const { handler, request, state } = await harness()
  assert.equal((await handler(request({}, false))).status, 401)
  assert.equal((await handler(new Request('http://localhost/ingest'))).status, 405)
  assert.equal(state.retrievals, 0)
})

test('Edge missing configuration and unrelated events do not retrieve mail', async () => {
  const missing = await harness({ env: { INBOUND_EMAIL_DOMAIN: '' } })
  assert.equal((await missing.handler(missing.request())).status, 503)
  const valid = await harness()
  assert.equal((await valid.handler(valid.request({ type: 'email.sent' }))).status, 200)
  assert.equal(valid.state.retrievals, 0)
})

test('Edge valid ingestion completes; repeated message is idempotent', async () => {
  const { handler, request, state } = await harness()
  const first = await handler(request())
  assert.equal(first.status, 200)
  assert.equal((await first.json()).found, 1)
  assert.equal(state.tables.job_alert_messages[0].status, 'completed')
  assert.equal(state.tables.job_leads.length, 1)
  assert.equal((await (await handler(request())).json()).duplicate, true)
  assert.equal(state.retrievals, 1)
})

test('Edge retrieval failure is retryable and does not create leads', async () => {
  const { handler, request, state } = await harness()
  state.retrieveFailed = true
  assert.equal((await handler(request())).status, 500)
  assert.equal(state.tables.job_alert_messages[0].status, 'failed')
  assert.equal(state.tables.job_leads.length, 0)
  state.retrieveFailed = false
  assert.equal((await handler(request())).status, 200)
  assert.equal(state.tables.job_alert_messages[0].status, 'completed')
})

test('BUG: final database error is acknowledged 200 and leaves processing message permanently deduplicated', async () => {
  const { handler, request, state } = await harness()
  state.completionFailed = true
  assert.equal((await handler(request())).status, 200)
  assert.equal(state.tables.job_alert_messages[0].status, 'processing')
  state.completionFailed = false
  assert.equal((await (await handler(request())).json()).duplicate, true)
  assert.equal(state.tables.job_alert_messages[0].status, 'processing')
  assert.equal(state.retrievals, 1)
})

test('BUG: ingestion upsert overwrites concurrently applied state with its stale read', async () => {
  const { handler, request, state } = await harness()
  state.tables.job_leads.push({ id: 1, user_id: 'synthetic-user', source: 'linkedin', external_id: '123', state: 'new', discovered_at: '2026-01-01T00:00:00Z' })
  state.beforeUpsert = () => Object.assign(state.tables.job_leads[0], { state: 'applied', application_id: 1234 })
  assert.equal((await handler(request())).status, 200)
  assert.equal(state.tables.job_leads[0].state, 'new')
  assert.equal(state.tables.job_leads[0].application_id, 1234)
})

test('Edge unsupported provider and wrong alias are ignored without lead creation', async () => {
  const h = await harness()
  h.email.from = 'newsletter@example.invalid'
  h.email.html = '<p>Synthetic unrelated newsletter</p>'
  assert.equal((await (await h.handler(h.request())).json()).ignored, true)
  assert.equal(h.state.tables.job_leads.length, 0)
  const other = await harness()
  assert.equal((await (await other.handler(other.request({ data: { ...other.event.data, to: ['unknown@inbound.example.invalid'] } }))).json()).ignored, true)
  assert.equal(other.state.retrievals, 0)
})
