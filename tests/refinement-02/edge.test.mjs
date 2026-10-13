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
export async function harness(options = {}) {
  let handler
  const secretBytes = randomBytes(32)
  const secret = `whsec_${secretBytes.toString('base64')}`
  const inbox = { id: 1, user_id: 'synthetic-user', address_alias: 'a'.repeat(32), enabled: true, ...options.inbox }
  const tables = { job_alert_inboxes: [inbox], job_alert_messages: [], job_leads: [] }
  const state = {
    tables, retrieveFailed: false, completionFailed: false, beforeFinish: null, retrievals: 0,
    now: 0, claimFailed: false, failureWriteFailed: false, inboxWriteFailed: false,
    leadWriteFailed: false, retrieveGate: null, finishResponseLost: false,
  }
  const email = { from: 'jobs@linkedin.com', subject: 'Job alert', html: '<section><a href="https://www.linkedin.com/jobs/view/123">Software Engineer</a><p>Synthetic Company</p><p>Toronto, Ontario</p><p>Easy Apply</p></section>', text: '' }
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.operation = 'select' }
    select() { return this }
    eq(key, value) { this.filters.push((row) => row[key] === value); return this }
    update(value) { this.operation = 'update'; this.value = value; return this }
    single() { this.one = true; return this }
    maybeSingle() { this.one = true; return this }
    then(resolve, reject) { return this.execute().then(resolve, reject) }
    async execute() {
      const source = tables[this.table]
      let result = source.filter((row) => this.filters.every((filter) => filter(row)))
      if (this.operation === 'update') {
        if (state.failureWriteFailed) return { data: null, error: { message: 'Synthetic failure-status failure' } }
        result.forEach((row) => Object.assign(row, this.value))
      }
      return { data: this.one ? structuredClone(result[0] || null) : structuredClone(result), error: null }
    }
  }
  // RPC doubles model transaction outcomes; the isolated PostgreSQL suite tests the actual SQL.
  async function rpc(name, args) {
    const failure = { data: null, error: { message: 'Synthetic database failure' } }
    if (name === 'claim_job_alert_message') {
      if (state.claimFailed) return failure
      let message = tables.job_alert_messages.find((row) => row.resend_email_id === args.p_resend_email_id)
      if (message && (['completed', 'partial', 'ignored'].includes(message.status) ||
        (message.status === 'processing' && message.processing_started_at !== null &&
         message.processing_started_at > state.now - 300_000))) {
        return { data: { claimed: false, id: message.id, status: message.status }, error: null }
      }
      if (!message) {
        message = { id: tables.job_alert_messages.length + 1, user_id: inbox.user_id, resend_email_id: args.p_resend_email_id }
        tables.job_alert_messages.push(message)
      }
      Object.assign(message, { status: 'processing', processing_token: crypto.randomUUID(), processing_started_at: state.now })
      return { data: { claimed: true, id: message.id, token: message.processing_token, status: message.status }, error: null }
    }
    assert.equal(name, 'finish_job_alert_message')
    if (state.beforeFinish) state.beforeFinish()
    const message = tables.job_alert_messages.find((row) => row.id === args.p_message_id)
    if (message.status !== 'processing' || message.processing_token !== args.p_token ||
      message.processing_started_at < state.now - 300_000 ||
      state.completionFailed || state.inboxWriteFailed || state.leadWriteFailed) return failure
    let created = 0
    for (const job of args.p_jobs) {
      const existing = tables.job_leads.find((row) => row.user_id === inbox.user_id &&
        row.source === job.source && row.external_id === job.external_id)
      if (existing) Object.assign(existing, job)
      else {
        created++
        tables.job_leads.push({ id: tables.job_leads.length + 1, user_id: inbox.user_id, state: 'new', discovered_at: '2026-01-01T00:00:00Z', ...job })
      }
    }
    Object.assign(message, { status: args.p_provider === 'unknown' ? 'ignored' : args.p_jobs.length ? 'completed' : 'partial',
      jobs_created: created, jobs_found: args.p_jobs.length, processing_token: null, processing_started_at: null })
    if (state.finishResponseLost) return failure
    return { data: { created, found: args.p_jobs.length }, error: null }
  }
  class LocalResend {
    constructor() {
      this.webhooks = new Resend('synthetic-unused').webhooks
      this.emails = { receiving: { get: async () => {
        state.retrievals++
        if (state.retrieveGate) await state.retrieveGate()
        return state.retrieveFailed ? { data: null, error: { message: 'Synthetic retrieval failure' } } : { data: email, error: null }
      } } }
    }
  }
  const env = { SUPABASE_URL: 'http://loopback.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-unused', RESEND_API_KEY: 'synthetic-unused', RESEND_WEBHOOK_SECRET: secret, INBOUND_EMAIL_DOMAIN: 'inbound.example.invalid', ...options.env }
  const context = createContext({ Request, Response, URL, crypto: webcrypto, console: { error() {} }, structuredClone, fetch: () => { throw new Error('External network forbidden in audit') }, Deno: { env: { get: (name) => env[name] }, serve: (callback) => { handler = callback } } })
  const code = stripTypeScriptTypes(await readFile(new URL('../../supabase/functions/ingest-job-alert/index.ts', import.meta.url), 'utf8'))
  const module = new SourceTextModule(code, { context })
  await module.link(async (specifier) => {
    const exports = specifier.includes('supabase') ? { createClient: () => options.admin || ({ from: (table) => new Query(table), rpc }) } : specifier.includes('linkedom') ? { parseHTML } : specifier.includes('resend') ? { Resend: LocalResend } : { parseJobAlert }
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

test('RF-10 R04: removal is not suppression; only a later distinct alert recreates a lead', async () => {
  const h = await harness()
  assert.equal((await h.handler(h.request())).status, 200)
  const original = structuredClone(h.state.tables.job_leads[0])
  h.state.tables.job_leads.splice(0)
  assert.equal((await (await h.handler(h.request())).json()).duplicate, true)
  assert.equal(h.state.tables.job_leads.length, 0)
  const later = { data: { ...h.event.data, email_id: 'synthetic-message-2' } }
  assert.equal((await h.handler(h.request(later))).status, 200)
  const recreated = h.state.tables.job_leads[0]
  assert.equal(recreated.source, original.source)
  assert.equal(recreated.external_id, original.external_id)
  assert.equal(recreated.state, 'new')
  assert.equal(h.state.tables.job_alert_messages.length, 2)
  assert.equal((await (await h.handler(h.request(later))).json()).duplicate, true)
  assert.equal(h.state.tables.job_leads.length, 1)
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

test('RF-05: failed completion returns 500, rolls back leads and safely retries', async () => {
  const { handler, request, state } = await harness()
  state.completionFailed = true
  assert.equal((await handler(request())).status, 500)
  assert.equal(state.tables.job_alert_messages[0].status, 'failed')
  assert.equal(state.tables.job_leads.length, 0)
  state.completionFailed = false
  assert.equal((await handler(request())).status, 200)
  assert.equal(state.tables.job_alert_messages[0].status, 'completed')
  assert.equal(state.tables.job_leads.length, 1)
  assert.equal(state.retrievals, 2)
})

test('RF-05 metadata refresh never overwrites concurrently applied state', async () => {
  const { handler, request, state } = await harness()
  state.tables.job_leads.push({ id: 1, user_id: 'synthetic-user', source: 'linkedin', external_id: '123', state: 'new', discovered_at: '2026-01-01T00:00:00Z' })
  state.beforeFinish = () => Object.assign(state.tables.job_leads[0], { state: 'applied', application_id: 1234 })
  assert.equal((await handler(request())).status, 200)
  assert.equal(state.tables.job_leads[0].state, 'applied')
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

test('RF-05: each critical database failure returns non-success and can retry', async () => {
  for (const failure of ['claimFailed', 'leadWriteFailed', 'inboxWriteFailed', 'completionFailed']) {
    const h = await harness()
    h.state[failure] = true
    assert.equal((await h.handler(h.request())).status, 500, failure)
    assert.equal(h.state.tables.job_leads.length, 0, failure)
    h.state[failure] = false
    assert.equal((await h.handler(h.request())).status, 200, failure)
    assert.equal(h.state.tables.job_leads.length, 1, failure)
  }
})

test('RF-05: ignored and partial completion failures are not acknowledged', async () => {
  for (const provider of ['unknown', 'linkedin']) {
    const h = await harness()
    h.email.from = provider === 'unknown' ? 'newsletter@example.invalid' : 'jobs@linkedin.com'
    h.email.html = '<p>No supported links</p>'
    h.state.completionFailed = true
    assert.equal((await h.handler(h.request())).status, 500)
    h.state.completionFailed = false
    assert.equal((await h.handler(h.request())).status, 200)
    assert.equal(h.state.tables.job_alert_messages[0].status, provider === 'unknown' ? 'ignored' : 'partial')
    assert.equal((await (await h.handler(h.request())).json()).duplicate, true)
  }
})

test('RF-05: failed failure-status write recovers via an expired lease', async () => {
  const h = await harness()
  h.state.retrieveFailed = h.state.failureWriteFailed = true
  assert.equal((await h.handler(h.request())).status, 500)
  assert.equal(h.state.tables.job_alert_messages[0].status, 'processing')
  assert.equal((await h.handler(h.request())).status, 503)
  h.state.now = 300_001
  h.state.retrieveFailed = h.state.failureWriteFailed = false
  assert.equal((await h.handler(h.request())).status, 200)
  assert.equal(h.state.tables.job_alert_messages.length, 1)
})

test('RF-05: concurrent first delivery and Failed retries have a single worker', async () => {
  for (const retry of [false, true]) {
    const h = await harness()
    if (retry) {
      h.state.retrieveFailed = true
      await h.handler(h.request())
      h.state.retrieveFailed = false
    }
    let release, entered
    const gate = new Promise((resolve) => { release = resolve })
    const ready = new Promise((resolve) => { entered = resolve })
    h.state.retrieveGate = async () => { entered(); await gate }
    const first = h.handler(h.request())
    await ready
    const others = await Promise.all(Array.from({ length: 8 }, () => h.handler(h.request())))
    assert.ok(others.every((response) => response.status === 503))
    release()
    assert.equal((await first).status, 200)
    assert.equal(h.state.retrievals, retry ? 2 : 1)
    assert.equal(h.state.tables.job_leads.length, 1)
    assert.equal(h.state.tables.job_alert_messages.length, 1)
  }
})

test('RF-05: lease takeover fences a late worker and its failure handler', async () => {
  const h = await harness()
  let release, entered
  const gate = new Promise((resolve) => { release = resolve })
  const ready = new Promise((resolve) => { entered = resolve })
  h.state.retrieveGate = async () => { entered(); await gate }
  const stale = h.handler(h.request())
  await ready
  h.state.now = 300_001
  h.state.retrieveGate = null
  assert.equal((await h.handler(h.request())).status, 200)
  release()
  assert.equal((await stale).status, 500)
  assert.equal(h.state.tables.job_alert_messages[0].status, 'completed')
  assert.equal(h.state.tables.job_leads.length, 1)
})

test('RF-05: legacy Processing without a lease is reclaimable', async () => {
  const h = await harness()
  h.state.tables.job_alert_messages.push({ id: 1, resend_email_id: h.event.data.email_id,
    user_id: 'synthetic-user', status: 'processing', processing_started_at: null })
  assert.equal((await h.handler(h.request())).status, 200)
  assert.equal(h.state.tables.job_alert_messages.length, 1)
})

test('RF-05: a lost response after successful commit does not undo completion', async () => {
  const h = await harness()
  h.state.finishResponseLost = true
  assert.equal((await h.handler(h.request())).status, 500)
  assert.equal(h.state.tables.job_alert_messages[0].status, 'completed')
  assert.equal(h.state.tables.job_leads.length, 1)
  assert.equal((await (await h.handler(h.request())).json()).duplicate, true)
  assert.equal(h.state.retrievals, 1)
})
