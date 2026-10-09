import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { randomUUID, createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { writeFile, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { localStatus, root, sandbox, sql, serveFunctions } from '../../scripts/recovery-local.mjs'

const runId = randomUUID().replaceAll('-', '')
const users = []
const buckets = new Set()
const mails = []
const password = `Local-${randomUUID()}!`
// Fresh connections avoid stale Kong sockets after a local database reset.
const clientOptions = {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers)
    headers.set('Connection', 'close')
    return fetch(input, { ...init, headers })
  } },
}
let status, admin, anonymous, signedIn, owner, duplicate, mailServer, edgeProcess
let mailStatus = 200
let edgeOutput = ''

function digest(value) {
  return createHash('sha256').update(`${runId}:${value}`).digest('hex')
}

function quotaArgs(email, network) {
  const args = { p_email_hash: digest(email), p_network_hash: digest(network) }
  buckets.add(`email:${args.p_email_hash}`)
  buckets.add(`network:${args.p_network_hash}`)
  return args
}

async function quota(args, client = admin) {
  const { data, error } = await client.rpc('consume_password_reset_quota', args)
  assert.equal(error, null)
  assert.equal(typeof data, 'boolean')
  return data
}

async function createUser(label, profileEmail) {
  const email = `recovery-${runId}-${label}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { profileEmail },
  })
  assert.equal(error, null)
  users.push(data.user.id)
  return data.user
}

async function request(body, options = {}) {
  const response = await fetch(`${status.FUNCTIONS_URL}/${options.production ? 'request-password-reset' : 'recovery-integration'}`, {
    method: options.method || 'POST',
    headers: { apikey: status.ANON_KEY, 'Content-Type': 'application/json',
      'x-forwarded-for': options.network || `198.51.100.${mails.length + 1}` },
    body: ['GET', 'OPTIONS'].includes(options.method) ? undefined :
      typeof body === 'string' ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  })
  const text = await response.text()
  return { status: response.status, headers: response.headers, text }
}

function generic(result) {
  assert.equal(result.status, 200)
  assert.deepEqual(JSON.parse(result.text), {
    message: 'If an account uses that recovery email, a reset link is on its way.',
  })
}

before(async () => {
  status = localStatus()
  admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions)
  anonymous = createClient(status.API_URL, status.ANON_KEY, clientOptions)
  owner = await createUser('owner', `owner-${runId}@example.com`)
  duplicate = `duplicate-${runId}@example.com`
  await createUser('duplicate-a', duplicate)
  await createUser('duplicate-b', `  ${duplicate.toUpperCase()}  `)
  signedIn = createClient(status.API_URL, status.ANON_KEY, clientOptions)
  const login = await signedIn.auth.signInWithPassword({ email: owner.email, password })
  assert.equal(login.error, null)

  const { basePort } = JSON.parse(await readFile(path.join(sandbox, 'test-config.json'), 'utf8'))
  mailServer = createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    if (req.headers.authorization !== 'Bearer re_local_test_only') {
      res.writeHead(401).end()
      return
    }
    mails.push(JSON.parse(Buffer.concat(chunks).toString()))
    res.writeHead(mailStatus, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ id: 'local-captured-mail' }))
  })
  await new Promise((resolve) => mailServer.listen(basePort + 10, '0.0.0.0', resolve))
  const envFile = path.join(sandbox, '.env.local')
  await writeFile(envFile, [
    'APP_URL=http://localhost:5173',
    'ALLOWED_REDIRECT_ORIGINS=http://localhost:5173,http://127.0.0.1:5173',
    'RESEND_API_KEY=re_local_test_only',
    'PASSWORD_RESET_FROM_EMAIL=ApplyTrack <local@example.com>',
    `TEST_MAIL_URL=http://${status.MAIL_HOST}:${basePort + 10}/emails`,
  ].join('\n'))
  edgeProcess = serveFunctions(envFile)
  for (const stream of [edgeProcess.stdout, edgeProcess.stderr]) {
    stream.on('data', (chunk) => { edgeOutput = (edgeOutput + chunk).slice(-10_000) })
  }
  let ready = false
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const result = await request(null, { method: 'OPTIONS' })
      if (result.status === 200) { ready = true; break }
    } catch { /* The runtime may still be downloading its pinned imports. */ }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  assert.ok(ready, 'Local Edge runtime did not become ready.')
}, { timeout: 90_000 })

after(async () => {
  if (admin) {
    for (const id of users) await admin.auth.admin.deleteUser(id)
    if (buckets.size) {
      await admin.from('password_reset_throttles').delete().in('bucket_key', [...buckets])
    }
  }
  if (mailServer) await new Promise((resolve) => mailServer.close(resolve))
  if (edgeProcess?.pid) {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(edgeProcess.pid), '/t', '/f'], { stdio: 'ignore' })
    } else {
      edgeProcess.kill('SIGTERM')
    }
  }
})

test('migrations create protected table, explicit RPC grants and fixed search paths', () => {
  const result = JSON.parse(sql(`select json_build_object(
    'rls', (select relrowsecurity from pg_class where oid = 'public.password_reset_throttles'::regclass),
    'policies', (select count(*) from pg_policies where tablename = 'password_reset_throttles'),
    'functions', (select json_agg(json_build_object('name', p.proname, 'definer', p.prosecdef,
      'config', p.proconfig, 'anon', has_function_privilege('anon', p.oid, 'execute'),
      'user', has_function_privilege('authenticated', p.oid, 'execute'),
      'service', has_function_privilege('service_role', p.oid, 'execute')))
      from pg_proc p where p.oid in ('public.consume_password_reset_quota(text,text)'::regprocedure,
        'public.find_recovery_auth_email(text)'::regprocedure)))`))
  assert.equal(result.rls, true)
  assert.equal(result.policies, 0)
  assert.equal(result.functions.length, 2)
  for (const fn of result.functions) {
    assert.equal(fn.anon, false)
    assert.equal(fn.user, false)
    assert.equal(fn.service, true)
    assert.deepEqual(fn.config, ['search_path=""'])
    assert.equal(fn.definer, fn.name === 'find_recovery_auth_email')
  }
})

test('the recovery migration is safe to apply again without restoring public grants', async () => {
  sql(await readFile(path.join(root, 'supabase/migrations/20261009201500_password_recovery_safety.sql'), 'utf8'))
  assert.equal(sql(`select has_function_privilege('anon',
    'public.find_recovery_auth_email(text)', 'execute')`), 'f')
  assert.equal(sql(`select has_table_privilege('authenticated', 'public.password_reset_throttles', 'select')`), 'f')
})

test('existing applications RLS still isolates signed-in users', async () => {
  const second = await createUser('rls-other', `rls-other-${runId}@example.com`)
  const own = await signedIn.from('applications').insert({ user_id: owner.id,
    company: 'Recovery integration test', role: 'Own row' }).select().single()
  assert.equal(own.error, null)
  const other = await admin.from('applications').insert({ user_id: second.id,
    company: 'Recovery integration test', role: 'Other row' }).select().single()
  assert.equal(other.error, null)
  const visible = await signedIn.from('applications').select('id').in('id', [own.data.id, other.data.id])
  assert.equal(visible.error, null)
  assert.deepEqual(visible.data, [{ id: own.data.id }])
  assert.equal((await signedIn.from('applications').insert({ user_id: second.id,
    company: 'Forbidden', role: 'Forbidden' })).error?.code, '42501')
  for (const query of [
    signedIn.from('applications').update({ company: 'Forbidden' }).eq('id', other.data.id).select(),
    signedIn.from('applications').delete().eq('id', other.data.id).select(),
  ]) {
    const result = await query
    assert.equal(result.error, null)
    assert.deepEqual(result.data, [])
  }
  assert.equal((await signedIn.from('applications').update({ user_id: second.id })
    .eq('id', own.data.id)).error?.code, '42501')
  const unchanged = await admin.from('applications').select('company').eq('id', other.data.id).single()
  assert.equal(unchanged.data.company, 'Recovery integration test')
})

test('anonymous and authenticated clients cannot read/write throttles or execute either RPC', async () => {
  for (const client of [anonymous, signedIn]) {
    for (const query of [
      client.from('password_reset_throttles').select('*'),
      client.from('password_reset_throttles').insert({ bucket_key: 'forbidden', attempts: 1, expires_at: new Date().toISOString() }),
      client.from('password_reset_throttles').update({ attempts: 1 }).eq('bucket_key', 'forbidden'),
      client.from('password_reset_throttles').delete().eq('bucket_key', 'forbidden'),
      client.rpc('find_recovery_auth_email', { p_recovery_email: owner.user_metadata.profileEmail }),
      client.rpc('consume_password_reset_quota', quotaArgs('unauthorized', 'unauthorized')),
    ]) {
      const result = await query
      assert.equal(result.error?.code, '42501')
    }
  }
})

test('RLS still hides throttle rows if table access is accidentally granted', () => {
  const args = quotaArgs('rls', 'rls')
  for (const role of ['anon', 'authenticated']) {
    const result = sql(`begin;
      insert into public.password_reset_throttles values ('email:${args.p_email_hash}', 1, now() + interval '15 minutes')
        on conflict do nothing;
      grant select, insert on public.password_reset_throttles to ${role};
      set local role ${role};
      select count(*) from public.password_reset_throttles;
      rollback;`)
    assert.equal(result, '0')
    assert.throws(() => sql(`begin; grant insert on public.password_reset_throttles to ${role};
      set local role ${role}; insert into public.password_reset_throttles values ('forbidden', 1, now()); rollback;`),
      /row-level security/)
  }
})

test('lookup returns the exact account, normalizes whitespace/case and fails closed for duplicates', async () => {
  for (const [email, expected] of [
    [owner.user_metadata.profileEmail, owner.email],
    [`  ${owner.user_metadata.profileEmail.toUpperCase()}  `, owner.email],
    [duplicate, null],
    [`absent-${runId}@example.com`, null],
    [null, null], ['', null], ['x'.repeat(255), null], ["' OR 1=1 --", null],
  ]) {
    const { data, error } = await admin.rpc('find_recovery_auth_email', { p_recovery_email: email })
    assert.equal(error, null)
    assert.equal(data, expected)
  }
})

test('malformed quota hashes are rejected without creating rows', async () => {
  const args = quotaArgs('invalid', 'invalid')
  for (const value of [null, '', 'x', 'A'.repeat(64), 'a'.repeat(65), "' OR 1=1 --"]) {
    const result = await admin.rpc('consume_password_reset_quota', { ...args, p_email_hash: value })
    assert.equal(result.error?.code, 'P0001')
  }
  assert.equal(sql(`select count(*) from public.password_reset_throttles where bucket_key in
    ('email:${args.p_email_hash}', 'network:${args.p_network_hash}')`), '0')
})

test('email quota permits exactly five calls and persists across independent clients', async () => {
  const args = quotaArgs('email-limit', 'email-limit')
  const secondAdmin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions)
  const results = []
  for (let i = 0; i < 7; i += 1) results.push(await quota(args, i % 2 ? secondAdmin : admin))
  assert.deepEqual(results, [true, true, true, true, true, false, false])
  assert.equal(sql(`select attempts from public.password_reset_throttles where bucket_key = 'email:${args.p_email_hash}'`), '7')
})

test('network quota permits thirty distinct emails then rejects the thirty-first', async () => {
  for (let i = 0; i < 31; i += 1) {
    assert.equal(await quota(quotaArgs(`network-limit-${i}`, 'shared-network')), i < 30)
  }
})

test('48 simultaneous requests to one email allow exactly five without lost updates', async () => {
  const args = quotaArgs('concurrent-email', 'concurrent-email')
  const results = await Promise.all(Array.from({ length: 48 }, () => quota(args)))
  assert.equal(results.filter(Boolean).length, 5)
  assert.equal(sql(`select attempts from public.password_reset_throttles where bucket_key = 'email:${args.p_email_hash}'`), '48')
})

test('48 simultaneous distinct emails sharing one network allow exactly thirty', async () => {
  const results = await Promise.all(Array.from({ length: 48 }, (_, i) => quota(quotaArgs(`concurrent-network-${i}`, 'concurrent-network'))))
  assert.equal(results.filter(Boolean).length, 30)
})

test('expired windows reset independently without extending a live window', async () => {
  const args = quotaArgs('expiry', 'expiry')
  await quota(args)
  const expiry = sql(`select expires_at from public.password_reset_throttles where bucket_key = 'network:${args.p_network_hash}'`)
  sql(`update public.password_reset_throttles set attempts = 5, expires_at = now() - interval '1 second'
    where bucket_key = 'email:${args.p_email_hash}'`)
  assert.equal(await quota(args), true)
  assert.equal(sql(`select attempts from public.password_reset_throttles where bucket_key = 'email:${args.p_email_hash}'`), '1')
  assert.equal(sql(`select expires_at from public.password_reset_throttles where bucket_key = 'network:${args.p_network_hash}'`), expiry)
  sql(`update public.password_reset_throttles set attempts = 30, expires_at = now() - interval '1 second'
    where bucket_key = 'network:${args.p_network_hash}'`)
  assert.equal(await quota(args), true)
  assert.equal(sql(`select attempts from public.password_reset_throttles where bucket_key = 'network:${args.p_network_hash}'`), '1')
})

test('both quota updates roll back when the second update fails', () => {
  const args = quotaArgs('rollback', 'rollback')
  const result = sql(`begin;
    create function public.test_recovery_network_failure() returns trigger language plpgsql as $f$
      begin if new.bucket_key = 'network:${args.p_network_hash}' then raise exception 'injected failure'; end if; return new; end; $f$;
    create trigger test_recovery_network_failure before insert on public.password_reset_throttles
      for each row execute function public.test_recovery_network_failure();
    do $b$ begin
      begin perform public.consume_password_reset_quota('${args.p_email_hash}', '${args.p_network_hash}');
        raise exception 'Expected injected failure';
      exception when others then if sqlerrm <> 'injected failure' then raise; end if; end;
    end; $b$;
    select count(*) from public.password_reset_throttles where bucket_key = 'email:${args.p_email_hash}';
    rollback;`)
  assert.equal(result, '0')
})

test('production Edge entrypoint handles preflight, methods and unknown accounts', async () => {
  const preflight = await request(null, { method: 'OPTIONS', production: true })
  assert.equal(preflight.status, 200)
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*')
  assert.equal((await request(null, { method: 'GET', production: true })).status, 405)
  generic(await request({ email: `unknown-${runId}@example.com` }, { production: true }))
})

test('Edge rejects invalid JSON, arrays and oversized bodies; malformed emails reveal nothing', async () => {
  const initial = mails.length
  for (const body of ['broken', '[]', 'null', '"string"', 'a'.repeat(2049)]) {
    assert.equal((await request(body)).status, 400)
  }
  for (const email of [null, '', 12, {}, 'invalid', 'x'.repeat(300)]) generic(await request({ email }))
  assert.equal(mails.length, initial)
})

test('known, unknown and duplicate emails have identical public replies; only one mail is sent', async () => {
  const initial = mails.length
  const known = await request({ email: `  ${owner.user_metadata.profileEmail.toUpperCase()}  `,
    redirectTo: 'https://evil.example/reset' })
  generic(known)
  const unknown = await request({ email: `unknown-edge-${runId}@example.com` })
  const ambiguous = await request({ email: duplicate })
  assert.equal(known.text, unknown.text)
  assert.equal(known.text, ambiguous.text)
  assert.equal(mails.length, initial + 1)
  const mail = mails.at(-1)
  assert.deepEqual(mail.to, [owner.user_metadata.profileEmail])
  assert.equal(mail.subject, 'Reset your ApplyTrack password')
  const link = new URL(mail.text.slice(mail.text.indexOf('http')))
  assert.equal(link.pathname, '/auth/v1/verify')
  assert.equal(link.searchParams.get('type'), 'recovery')
  assert.equal(link.searchParams.get('redirect_to'), 'http://localhost:5173/?recovery=1')
  assert.ok(link.searchParams.get('token'))
})

test('Edge respects email quota even when requests spoof different network headers', async () => {
  const user = await createUser('edge-limit', `limit-${runId}@example.com`)
  const initial = mails.length
  for (let i = 0; i < 7; i += 1) {
    generic(await request({ email: user.user_metadata.profileEmail }, { network: `203.0.113.${i + 1}` }))
  }
  assert.equal(mails.length, initial + 5)
})

test('parallel Edge requests enforce shared quotas across workers', async () => {
  const user = await createUser('edge-parallel', `parallel-${runId}@example.com`)
  const initial = mails.length
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => request(
    { email: user.user_metadata.profileEmail }, { network: `192.0.2.${i + 1}` },
  )))
  for (const result of results) generic(result)
  assert.equal(mails.length, initial + 5)
})

test('a real Supabase recovery token resets password and cannot be reused', async () => {
  const user = await createUser('token', `token-${runId}@example.com`)
  const initial = mails.length
  generic(await request({ email: user.user_metadata.profileEmail, redirectTo: 'http://127.0.0.1:5173/ignored' }))
  assert.equal(mails.length, initial + 1)
  const link = new URL(mails.at(-1).text.split('password: ')[1])
  assert.equal(link.searchParams.get('redirect_to'), 'http://127.0.0.1:5173/?recovery=1')
  const tokenClient = createClient(status.API_URL, status.ANON_KEY, clientOptions)
  const token = link.searchParams.get('token')
  const verified = await tokenClient.auth.verifyOtp({ token_hash: token, type: 'recovery' })
  assert.equal(verified.error, null)
  assert.equal(verified.data.user.id, user.id)
  const newPassword = `Updated-${randomUUID()}!`
  assert.equal((await tokenClient.auth.updateUser({ password: newPassword })).error, null)
  const loginClient = createClient(status.API_URL, status.ANON_KEY, clientOptions)
  assert.ok((await loginClient.auth.signInWithPassword({ email: user.email, password })).error)
  assert.equal((await loginClient.auth.signInWithPassword({ email: user.email, password: newPassword })).error, null)
  assert.ok((await tokenClient.auth.verifyOtp({ token_hash: token, type: 'recovery' })).error)
})

test('mail-provider failure does not reveal whether an account exists or log private data', async () => {
  const user = await createUser('mail-failure', `failure-${runId}@example.com`)
  const initial = mails.length
  mailStatus = 503
  try {
    const result = await request({ email: user.user_metadata.profileEmail })
    assert.equal(mails.length, initial + 1, 'The provider failure must actually be exercised.')
    generic(result)
    const unknown = await request({ email: `outage-unknown-${runId}@example.com` })
    assert.equal(result.status, unknown.status)
    assert.equal(result.text, unknown.text)
    assert.equal(edgeOutput.includes(user.user_metadata.profileEmail), false)
    assert.equal(edgeOutput.includes('token='), false)
  } finally {
    mailStatus = 200
  }
})

test('control characters in email cannot trigger a database error or expose account state', async () => {
  const initial = sql('select count(*) from public.password_reset_throttles')
  for (const character of ['\u0000', '\u0001', '\u007f', '\u200b', '\u202e']) {
    generic(await request({ email: `user${character}@example.com` }))
  }
  assert.equal(sql('select count(*) from public.password_reset_throttles'), initial)
})

test('expired Supabase recovery tokens cannot create a session', async () => {
  const user = await createUser('expired-token', `expired-${runId}@example.com`)
  const initial = mails.length
  generic(await request({ email: user.user_metadata.profileEmail }))
  assert.equal(mails.length, initial + 1)
  const link = new URL(mails.at(-1).text.split('password: ')[1])
  sql(`update auth.users set recovery_sent_at = now() - interval '2 days' where id = '${user.id}'`)
  const tokenClient = createClient(status.API_URL, status.ANON_KEY, clientOptions)
  const result = await tokenClient.auth.verifyOtp({ token_hash: link.searchParams.get('token'), type: 'recovery' })
  assert.ok(result.error)
  assert.equal(result.data.session, null)
})
