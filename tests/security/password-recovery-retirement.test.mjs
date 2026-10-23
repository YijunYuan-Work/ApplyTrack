import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir } from 'node:fs/promises'

const root = new URL('../../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

// These checks prove repository state only, not removal of a deployed cloud function.
test('Recovery retirement: legacy handler and its source-dependent characterization suite are retired', async () => {
  await assert.rejects(read('supabase/functions/request-password-reset/index.ts'), { code: 'ENOENT' })
  await assert.rejects(read('tests/sec-01/request-password-reset.test.mjs'), { code: 'ENOENT' })
})

test('Recovery retirement: legacy function configuration is absent and ingestion JWT policy remains explicit', async () => {
  const config = await read('supabase/config.toml')
  assert.doesNotMatch(config, /request-password-reset/)
  assert.match(config, /^\[functions\.ingest-job-alert\]\r?\nverify_jwt = false$/m)
})

test('Recovery retirement: recovery-only example settings are removed while inbound alert settings remain', async () => {
  const template = await read('supabase/functions/.env.example')
  assert.doesNotMatch(template, /^(?:APP_URL|ALLOWED_REDIRECT_ORIGINS|PASSWORD_RESET_FROM_EMAIL)=/m)
  for (const name of ['RESEND_API_KEY', 'RESEND_WEBHOOK_SECRET', 'INBOUND_EMAIL_DOMAIN']) {
    assert.match(template, new RegExp(`^${name}=`, 'm'))
  }
})

test('Recovery retirement: first-party source contains no legacy requester or replacement public reset-email API', async () => {
  const src = new URL('src/', root)
  for (const path of await readdir(src, { recursive: true })) {
    if (!/\.(?:[cm]?js|jsx|ts|tsx)$/.test(path)) continue
    const code = await readFile(new URL(path.replaceAll('\\', '/'), src), 'utf8')
    assert.doesNotMatch(code, /request-password-reset|requestPasswordReset|resetPasswordForEmail|\/auth\/v1\/recover\b/, path)
  }
})
