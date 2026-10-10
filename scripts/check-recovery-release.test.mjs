import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { approvedOrigin, projectRef, summarizeSecrets, summarizeAuth,
  summarizeBackups, checkManagement } from './check-recovery-release.mjs'

test('release metadata recognizes the exact production allowlist without exposing digests', () => {
  const hash = (value) => createHash('sha256').update(value).digest('hex')
  const items = [{ name: 'APP_URL', value: hash(approvedOrigin) },
    { name: 'ALLOWED_REDIRECT_ORIGINS', value: hash(approvedOrigin) },
    { name: 'SUPABASE_URL', value: hash(`https://${projectRef}.supabase.co`) },
    { name: 'RESEND_API_KEY', value: 'private-metadata' },
    { name: 'PASSWORD_RESET_FROM_EMAIL', value: 'private-metadata' },
    { name: 'SUPABASE_SERVICE_ROLE_KEY', value: 'private-metadata' }]
  const summary = summarizeSecrets(items)
  assert.equal(summary.requiredNamesPresent, true)
  assert.equal(summary.allowlistMatchesProductionOnly, true)
  assert.equal(summary.allowlistMatchesDocumentedLocalhostMix, false)
  assert.equal(summary.supabaseUrlMatchesTarget, true)
  assert.equal(JSON.stringify(summary).includes('private-metadata'), false)
  assert.equal(JSON.stringify(summary).includes(hash(approvedOrigin)), false)
})

test('release Auth checks reject localhost, preview wildcards and embedded credentials', () => {
  for (const redirect of ['http://localhost:5173', 'https://*.vercel.app/**',
    `https://user:password@apply-track-six.vercel.app`, 'https://preview.example.com']) {
    assert.equal(summarizeAuth({ site_url: approvedOrigin, uri_allow_list: redirect }).redirectsProductionOnly, false)
  }
  assert.equal(summarizeAuth({site_url: approvedOrigin,
    uri_allow_list: `${approvedOrigin}/?recovery=1`}).recoveryRedirectExplicitlyListed, true)
})

test('missing backup and Auth metadata stays unknown, not a false assurance', () => {
  assert.equal(summarizeAuth({}).redirectsProductionOnly, null)
  assert.equal(summarizeBackups({}).backupEntryCount, null)
  assert.equal(summarizeBackups({backups: []}).backupEntryCount, 0)
  assert.equal(summarizeBackups({backups: [{}]}).ownerMustVerifyCompletedPreReleaseRestorePoint, true)
})

test('management verifier uses GET only on fixed production paths and redacts failures', async () => {
  const calls = []
  const secret = 'test-only-not-a-real-token'
  const result = await checkManagement(secret, async (url, init) => {
    calls.push({url, init})
    if (url.endsWith('/secrets')) throw new Error(secret)
    return new Response(JSON.stringify({privateValue: secret}), {status: 403})
  })
  assert.equal(calls.length, 5)
  assert.ok(calls.every(({url, init}) => url.startsWith(`https://api.supabase.com/v1/projects/${projectRef}/`)
    && init.method === 'GET' && init.redirect === 'error' && !init.body))
  assert.equal(JSON.stringify(result).includes(secret), false)
  assert.equal(result.auth.status, 403)
  const unexpected = await checkManagement(secret, async (url) => new Response(JSON.stringify(
    url.endsWith('/functions') ? [{slug: 'request-password-reset', version: {privateValue: secret}}]
      : url.endsWith('/secrets') ? [] : {privateValue: secret},
  )))
  assert.equal(unexpected.edge.version, null)
  assert.equal(JSON.stringify(unexpected).includes(secret), false)
  await assert.rejects(checkManagement(''), /owner-authorized/)
})
