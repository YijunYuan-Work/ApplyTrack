import assert from 'node:assert/strict'
import test from 'node:test'
import { createPasswordResetHandler } from './handler.ts'

const neutralMessage = { message: 'If an account uses that recovery email, a reset link is on its way.' }

function fixture(options = {}) {
  const calls = { rpc: [], links: [], mails: [], logs: [] }
  const client = {
    rpc: async (name) => {
      calls.rpc.push(name)
      if (name === 'consume_password_reset_quota') return options.quota || { data: true, error: null }
      return options.lookup || { data: 'internal@example.com', error: null }
    },
    auth: { admin: { generateLink: async (payload) => {
      calls.links.push(payload)
      return options.link || { data: { properties: { action_link: 'https://auth.example/verify?token=private' } }, error: null }
    } } },
  }
  const handler = createPasswordResetHandler({
    createAdminClient: () => {
      if (options.credentialsError) throw new Error('Private credential details')
      return client
    },
    getEnv: (key) => ({ APP_URL: options.appUrl || 'https://app.example',
      RESEND_API_KEY: 're_test_only', PASSWORD_RESET_FROM_EMAIL: 'local@example.com' })[key],
    fetch: async (url, init) => {
      calls.mails.push({ url, init })
      if (options.fetchError) throw new Error('Private mail details')
      return new Response('{}', { status: options.mailStatus || 200 })
    },
    corsHeaders: {},
    logError: (kind) => calls.logs.push(kind),
  })
  return { calls, request: () => handler(new Request('https://edge.example', {
    method: 'POST', body: JSON.stringify({ email: 'owner@example.com' }),
  })) }
}

for (const [label, options] of [
  ['admin credentials unavailable', { credentialsError: true }],
  ['quota RPC fails', { quota: { data: null, error: new Error('Private database details') } }],
  ['quota RPC returns an unexpected type', { quota: { data: 'true', error: null } }],
  ['lookup RPC fails', { lookup: { data: null, error: new Error('Private lookup details') } }],
]) {
  test(`fails closed without creating a token when ${label}`, async () => {
    const { calls, request } = fixture(options)
    const response = await request()
    assert.equal(response.status, 500)
    assert.deepEqual(await response.json(), {
      error: 'Password recovery is unavailable right now. Please try again later.',
    })
    assert.equal(calls.links.length, 0)
    assert.equal(calls.mails.length, 0)
    assert.deepEqual(calls.logs, ['Error'])
  })
}

test('a denied quota never reaches account lookup or delivery', async () => {
  const { calls, request } = fixture({ quota: { data: false, error: null } })
  assert.deepEqual(await (await request()).json(), neutralMessage)
  assert.deepEqual(calls.rpc, ['consume_password_reset_quota'])
  assert.equal(calls.links.length, 0)
  assert.equal(calls.mails.length, 0)
})

for (const [label, options] of [
  ['Auth link generation fails', { link: { data: null, error: new Error('Private auth details') } }],
  ['mail API rejects delivery', { mailStatus: 503 }],
  ['mail transport throws', { fetchError: true }],
  ['APP_URL is unsafe', { appUrl: 'javascript:alert(1)' }],
]) {
  test(`account-specific failure stays neutral when ${label}`, async () => {
    const { calls, request } = fixture(options)
    const response = await request()
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), neutralMessage)
    assert.deepEqual(calls.logs, ['Error'])
    if (options.appUrl) assert.equal(calls.links.length, 0)
  })
}

test('unknown account skips link generation and mail delivery', async () => {
  const { calls, request } = fixture({ lookup: { data: null, error: null } })
  assert.deepEqual(await (await request()).json(), neutralMessage)
  assert.equal(calls.links.length, 0)
  assert.equal(calls.mails.length, 0)
  assert.deepEqual(calls.logs, [])
})

test('successful delivery uses the fixed Resend endpoint and safe redirect', async () => {
  const { calls, request } = fixture()
  assert.deepEqual(await (await request()).json(), neutralMessage)
  assert.deepEqual(calls.links, [{ email: 'internal@example.com', type: 'recovery',
    options: { redirectTo: 'https://app.example/?recovery=1' } }])
  assert.equal(calls.mails[0].url, 'https://api.resend.com/emails')
  assert.deepEqual(JSON.parse(calls.mails[0].init.body).to, ['owner@example.com'])
  assert.deepEqual(calls.logs, [])
})
