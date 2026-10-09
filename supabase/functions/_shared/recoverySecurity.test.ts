import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getRecoveryNetworkAddress,
  getSafeRecoveryRedirect,
  hashRecoveryBucket,
  normalizeRecoveryEmail,
  readRecoveryRequest,
} from './recoverySecurity.ts'

test('normalizes valid email and rejects malformed, non-string and oversized inputs', () => {
  assert.equal(normalizeRecoveryEmail('  User+Tag@Example.COM '), 'user+tag@example.com')
  assert.equal(normalizeRecoveryEmail(undefined), '')
  assert.equal(normalizeRecoveryEmail('not-an-email'), '')
  assert.equal(normalizeRecoveryEmail(`a@${'x'.repeat(255)}.com`), '')
})

test('reads a small valid request without accepting untrusted extra fields', async () => {
  const request = new Request('https://example.com', {
    method: 'POST',
    body: JSON.stringify({
      email: '  OWNER@EXAMPLE.COM  ',
      redirectTo: 'https://example.com/login',
      admin: true,
    }),
  })
  assert.deepEqual(await readRecoveryRequest(request), {
    email: 'owner@example.com',
    redirectTo: 'https://example.com/login',
  })
})

test('rejects invalid JSON and oversized streamed bodies', async () => {
  await assert.rejects(readRecoveryRequest(new Request('https://example.com', {
    method: 'POST', body: 'not json',
  })))
  await assert.rejects(readRecoveryRequest(new Request('https://example.com', {
    method: 'POST', body: 'a'.repeat(4096),
  })), /size limit/)
})

test('recovery redirect uses only allowed origins and resets its path', () => {
  const allowed = 'https://applytrack.example,https://preview.example'
  assert.equal(
    getSafeRecoveryRedirect('https://preview.example/malicious?next=1',
      'https://applytrack.example', allowed),
    'https://preview.example/?recovery=1',
  )
  assert.equal(
    getSafeRecoveryRedirect('https://preview.example.evil.test/reset',
      'https://applytrack.example', allowed),
    'https://applytrack.example/?recovery=1',
  )
  assert.equal(
    getSafeRecoveryRedirect('javascript:alert(1)', 'https://applytrack.example', allowed),
    'https://applytrack.example/?recovery=1',
  )
  assert.equal(
    getSafeRecoveryRedirect('http://preview.example',
      'https://applytrack.example', allowed),
    'https://applytrack.example/?recovery=1',
  )
})

test('permits explicitly allowed loopback http URLs for local development', () => {
  assert.equal(getSafeRecoveryRedirect(
    'http://localhost:5173/ignored',
    'https://applytrack.example',
    'http://localhost:5173',
  ), 'http://localhost:5173/?recovery=1')
})

test('produces fixed-length, separated hashes for quota buckets', async () => {
  const a = await hashRecoveryBucket('email', 'user@example.com')
  const b = await hashRecoveryBucket('network', 'user@example.com')
  assert.match(a, /^[a-f0-9]{64}$/)
  assert.notEqual(a, b)
})

test('extracts a bounded, best-effort network address', () => {
  const request = new Request('https://example.com', {
    headers: { 'x-forwarded-for': '203.0.113.1, 192.0.2.1' },
  })
  assert.equal(getRecoveryNetworkAddress(request), '203.0.113.1')
})
