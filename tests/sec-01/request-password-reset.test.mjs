import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'

const sourceUrl = new URL('../../supabase/functions/request-password-reset/index.ts', import.meta.url)
const neutral = { message: 'If an account uses that recovery email, a reset link is on its way.' }
const unavailable = { error: 'Password recovery is unavailable right now. Please try again later.' }
const recoveryEmail = 'owner@example.invalid'
const syntheticUser = { id: 'synthetic-user', email: 'internal@example.invalid', user_metadata: { profileEmail: recoveryEmail } }

// Load the unchanged handler; replace only external services, clock and worker initialization.
async function worker(options = {}) {
  let handler
  let now = 1_800_000_000_000
  const state = { clients: [], lists: [], links: [], mail: [], errors: [], attempts: null }
  class ObservedMap extends Map {
    constructor(...args) { super(...args); state.attempts = this }
  }
  class Clock extends Date { static now() { return now } }
  const env = {
    SUPABASE_URL: 'https://supabase.example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-admin-only',
    APP_URL: 'https://app.example.invalid', RESEND_API_KEY: 'synthetic-mail-only',
    PASSWORD_RESET_FROM_EMAIL: 'noreply@example.invalid', ...options.env,
  }
  const createClient = (url, key, config) => {
    state.clients.push({ url, key, config })
    return { auth: { admin: {
      listUsers: async (args) => {
        state.lists.push(args)
        return { data: { users: options.pages?.[args.page - 1] ?? options.users ?? [] }, error: options.listError ?? null }
      },
      generateLink: async (args) => {
        state.links.push(args)
        return { data: { properties: options.noLink ? {} : { action_link: 'https://supabase.example.invalid/auth/v1/verify?token=synthetic-never-valid' } }, error: options.linkError ?? null }
      },
    } } }
  }
  const context = createContext({
    Request, Response, URL, Map: ObservedMap, Date: Clock,
    console: { error: (...args) => state.errors.push(args.map(String)) },
    fetch: async (url, init) => {
      assert.equal(url, 'https://api.resend.com/emails', 'Any other network destination is forbidden')
      state.mail.push({ headers: init.headers, body: JSON.parse(init.body), method: init.method })
      if (options.mailThrows) throw new Error('Synthetic transport failure')
      return new Response('{}', { status: options.mailStatus ?? 200 })
    },
    Deno: { env: { get: (name) => env[name] }, serve: (callback) => { handler = callback } },
  })
  const module = new SourceTextModule(stripTypeScriptTypes(await readFile(sourceUrl, 'utf8')), { context })
  await module.link((specifier) => {
    const exports = specifier === 'npm:@supabase/supabase-js@2.106.2' ? { createClient }
      : specifier === 'npm:@supabase/supabase-js@2.106.2/cors' ? { corsHeaders: { 'Access-Control-Allow-Origin': '*' } } : null
    assert.ok(exports, `Unexpected import forbidden: ${specifier}`)
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
    }, { context })
  })
  await module.evaluate()
  const send = async (body = { email: recoveryEmail }, headers = {}) => {
    const response = await handler(new Request('https://edge.example.invalid/request-password-reset', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
    }))
    return { status: response.status, body: await response.json() }
  }
  return { state, handler, send, now: () => now, advance: (ms) => { now += ms } }
}

test('SEC-01: unauthenticated POST invokes admin operations with server credentials, not caller credentials', async () => {
  const w = await worker({ users: [syntheticUser] })
  assert.deepEqual(await w.send({ email: ' OWNER@EXAMPLE.INVALID ' }), { status: 200, body: neutral })
  assert.equal(w.state.clients[0].key, 'synthetic-admin-only')
  assert.equal(w.state.clients[0].config.auth.persistSession, false)
  assert.equal(w.state.clients[0].config.auth.autoRefreshToken, false)
  assert.equal(w.state.links[0].email, syntheticUser.email)
  assert.equal(w.state.links[0].type, 'recovery')
  assert.deepEqual(w.state.mail[0].body.to, [recoveryEmail])
  assert.equal(w.state.mail[0].headers.Authorization, 'Bearer synthetic-mail-only')
  assert.equal(w.state.errors.length, 0)
})

test('SEC-01: normal known and unknown responses are equal but decision paths differ', async () => {
  const w = await worker({ users: [syntheticUser] })
  assert.deepEqual(await w.send({ email: 'unknown@example.invalid' }), await w.send())
  assert.equal(w.state.lists.length, 2)
  assert.equal(w.state.links.length, 1)
  assert.equal(w.state.mail.length, 1)
  assert.equal(JSON.stringify(neutral).includes('synthetic-never-valid'), false)
})

for (const [name, options, generated, sent] of [
  ['missing delivery configuration', { env: { RESEND_API_KEY: '' } }, 1, 0],
  ['missing sender', { env: { PASSWORD_RESET_FROM_EMAIL: '' } }, 1, 0],
  ['delivery rejection', { mailStatus: 403 }, 1, 1],
  ['delivery transport failure', { mailThrows: true }, 1, 1],
  ['link generation error', { linkError: new Error('Synthetic admin failure') }, 1, 0],
  ['missing generated link', { noLink: true }, 1, 0],
  ['missing redirect configuration', { env: { APP_URL: '' } }, 0, 0],
]) {
  test(`SEC-01: ${name} distinguishes matching from unknown email locally`, async () => {
    const w = await worker({ users: [syntheticUser], ...options })
    assert.deepEqual(await w.send({ email: 'unknown@example.invalid' }), { status: 200, body: neutral })
    assert.deepEqual(await w.send(), { status: 500, body: unavailable })
    assert.equal(w.state.links.length, generated)
    assert.equal(w.state.mail.length, sent)
    assert.equal(w.state.errors.length, 1)
  })
}

test('SEC-01: unavailable admin configuration or user listing fails equally before email-dependent delivery', async () => {
  for (const options of [{ env: { SUPABASE_SERVICE_ROLE_KEY: '' } }, { listError: new Error('Synthetic listing failure') }]) {
    const w = await worker(options)
    for (const email of [recoveryEmail, 'unknown@example.invalid']) {
      assert.deepEqual(await w.send({ email }), { status: 500, body: unavailable })
    }
    assert.equal(w.state.links.length, 0)
    assert.equal(w.state.mail.length, 0)
  }
})

test('SEC-01: secret-key fallback accepts first configured value; malformed JSON fails generically', async () => {
  const fallback = await worker({ env: { SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_SECRET_KEYS: '{"first":"synthetic-fallback","second":"synthetic-other"}' } })
  assert.equal((await fallback.send()).status, 200)
  assert.equal(fallback.state.clients[0].key, 'synthetic-fallback')
  const malformed = await worker({ env: { SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_SECRET_KEYS: '{' } })
  assert.deepEqual(await malformed.send(), { status: 500, body: unavailable })
  assert.equal(malformed.state.clients.length, 0)
})

test('SEC-01: OPTIONS and unsupported methods invoke no admin or mail operations', async () => {
  const w = await worker()
  assert.equal((await w.handler(new Request('https://edge.example.invalid', { method: 'OPTIONS' }))).status, 200)
  for (const method of ['GET', 'PUT', 'DELETE']) {
    const response = await w.handler(new Request('https://edge.example.invalid', { method }))
    assert.equal(response.status, 405)
    assert.deepEqual(await response.json(), { error: 'Method not allowed.' })
  }
  assert.equal(w.state.clients.length, 0)
  assert.equal(w.state.attempts.size, 0)
})

test('SEC-01: empty/non-string email is neutral, invalid nonempty text still causes user scans', async () => {
  const w = await worker()
  for (const email of ['', '   ', null, {}, 123]) assert.deepEqual(await w.send({ email }), { status: 200, body: neutral })
  assert.equal(w.state.lists.length, 0)
  assert.deepEqual(await w.send({ email: 'not-an-email' }), { status: 200, body: neutral })
  assert.equal(w.state.lists.length, 1)
  assert.equal(w.state.links.length, 0)
})

test('SEC-01: malformed JSON and null body return generic 500 without admin operations', async () => {
  const w = await worker()
  assert.deepEqual(await w.send(null), { status: 500, body: unavailable })
  const response = await w.handler(new Request('https://edge.example.invalid', { method: 'POST', body: '{' }))
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), unavailable)
  assert.equal(w.state.clients.length, 0)
})

test('SEC-01: one worker admits five normalized pair attempts and resets only at the window boundary', async () => {
  const w = await worker()
  for (let i = 0; i < 5; i++) assert.equal((await w.send({ email: i % 2 ? ' OWNER@EXAMPLE.INVALID ' : recoveryEmail })).status, 200)
  const limited = await w.send()
  assert.equal(limited.status, 429)
  assert.notDeepEqual(limited.body, neutral)
  assert.equal(w.state.lists.length, 5)
  w.advance(15 * 60 * 1000 - 1)
  assert.equal((await w.send()).status, 429)
  w.advance(1)
  assert.equal((await w.send()).status, 200)
})

test('SEC-01: concurrent same-worker calls share the synchronous pair counter', async () => {
  const w = await worker()
  const responses = await Promise.all(Array.from({ length: 8 }, () => w.send()))
  assert.equal(responses.filter(({ status }) => status === 200).length, 5)
  assert.equal(responses.filter(({ status }) => status === 429).length, 3)
})

test('SEC-01: new workers and simultaneous isolates have independent counters', async () => {
  const a = await worker()
  const b = await worker()
  for (let i = 0; i < 5; i++) assert.equal((await a.send()).status, 200)
  assert.equal((await a.send()).status, 429)
  assert.equal((await b.send()).status, 200)
  const restarted = await worker()
  assert.equal((await restarted.send()).status, 200)
  assert.equal(a.state.attempts.size, 1)
  assert.equal(restarted.state.attempts.size, 1)
})

test('SEC-01: pair-only limits do not enforce an independent IP or email quota', async () => {
  const w = await worker({ users: [syntheticUser] })
  for (let i = 0; i < 12; i++) {
    assert.equal((await w.send({ email: `address-${i}@example.invalid` }, { 'x-forwarded-for': 'synthetic-client-a' })).status, 200)
    assert.equal((await w.send({ email: recoveryEmail }, { 'x-forwarded-for': `synthetic-client-${i}` })).status, 200)
  }
  assert.equal(w.state.lists.length, 24)
  assert.equal(w.state.links.length, 12)
  assert.equal(w.state.mail.length, 12)
})

test('SEC-01: handler trusts first forwarded value; missing header shares the unknown bucket', async () => {
  const w = await worker()
  for (let i = 0; i < 5; i++) await w.send({}, { 'x-forwarded-for': ' synthetic-a , trusted-proxy' })
  assert.equal((await w.send({}, { 'x-forwarded-for': 'synthetic-a, another-proxy' })).status, 429)
  assert.equal((await w.send({}, { 'x-forwarded-for': 'synthetic-b, trusted-proxy' })).status, 200)
  for (let i = 0; i < 5; i++) await w.send()
  assert.equal((await w.send()).status, 429)
})

test('SEC-01: unique keys and expired untouched entries remain in worker memory', async () => {
  const w = await worker()
  for (let i = 0; i < 256; i++) await w.send({ email: `address-${i}@example.invalid` })
  assert.equal(w.state.attempts.size, 256)
  w.advance(15 * 60 * 1000 + 1)
  await w.send({ email: 'fresh@example.invalid' })
  assert.equal(w.state.attempts.size, 257)
  assert.equal([...w.state.attempts.values()].filter(({ resetAt }) => resetAt <= w.now()).length, 256)
  assert.equal(w.state.lists.length, 257)
})

test('SEC-01: duplicate unverified metadata selects the first user in returned order', async () => {
  const other = { id: 'other-synthetic-user', email: 'other-internal@example.invalid', user_metadata: { profileEmail: ' OWNER@EXAMPLE.INVALID ' } }
  for (const users of [[syntheticUser, other], [other, syntheticUser]]) {
    const w = await worker({ users })
    assert.equal((await w.send()).status, 200)
    assert.equal(w.state.links[0].email, users[0].email)
    assert.deepEqual(w.state.mail[0].body.to, [recoveryEmail])
  }
})

test('SEC-01: malformed recovery metadata can break scanning for an unrelated requested account', async () => {
  const w = await worker({ users: [{ user_metadata: { profileEmail: {} } }, syntheticUser] })
  assert.deepEqual(await w.send(), { status: 500, body: unavailable })
  assert.equal(w.state.links.length, 0)
})

test('SEC-01: unknown lookup is capped at ten pages of 1000; first-page match stops early', async () => {
  const fullPage = Array.from({ length: 1000 }, (_, i) => ({ id: `synthetic-${i}`, user_metadata: {} }))
  const w = await worker({ pages: [...Array(10).fill(fullPage), [syntheticUser]] })
  assert.deepEqual(await w.send(), { status: 200, body: neutral })
  assert.equal(w.state.lists.length, 10)
  assert.equal(w.state.lists[9].page, 10)
  assert.ok(w.state.lists.every(({ perPage }) => perPage === 1000))
  assert.equal(w.state.links.length, 0)
  const first = await worker({ pages: [[syntheticUser, ...fullPage.slice(1)], [syntheticUser]] })
  await first.send()
  assert.equal(first.state.lists.length, 1)
})

test('SEC-01: exact allowed origin is normalized; untrusted and malformed redirects use fallback', async () => {
  const cases = [
    ['https://app.example.invalid/other?x=1#fragment', 'https://app.example.invalid/?recovery=1'],
    ['https://app.example.invalid.attacker.invalid/', 'https://app.example.invalid/?recovery=1'],
    ['https://attacker.invalid/?token=synthetic', 'https://app.example.invalid/?recovery=1'],
    ['javascript:alert(1)', 'https://app.example.invalid/?recovery=1'],
    [null, 'https://app.example.invalid/?recovery=1'],
  ]
  for (const [redirectTo, expected] of cases) {
    const w = await worker({ users: [syntheticUser] })
    assert.equal((await w.send({ email: recoveryEmail, redirectTo })).status, 200)
    assert.equal(w.state.links[0].options.redirectTo, expected)
  }
})

test('SEC-01: configured localhost and independent fallback are trusted without HTTPS enforcement', async () => {
  const local = await worker({ users: [syntheticUser], env: { ALLOWED_REDIRECT_ORIGINS: 'http://localhost:5173' } })
  await local.send({ email: recoveryEmail, redirectTo: 'http://localhost:5173/private' })
  assert.equal(local.state.links[0].options.redirectTo, 'http://localhost:5173/?recovery=1')
  const fallback = await worker({ users: [syntheticUser], env: { APP_URL: 'http://fallback.example.invalid/path', ALLOWED_REDIRECT_ORIGINS: 'https://different.example.invalid' } })
  await fallback.send({ email: recoveryEmail, redirectTo: 'https://attacker.invalid' })
  assert.equal(fallback.state.links[0].options.redirectTo, 'http://fallback.example.invalid/?recovery=1')
})
