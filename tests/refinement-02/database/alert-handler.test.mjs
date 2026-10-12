import assert from 'node:assert/strict'
import test from 'node:test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile } from 'node:fs/promises'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'
import { harness } from '../edge.test.mjs'

const exec = promisify(execFile)
const container = process.env.RF05_TEST_CONTAINER
const database = process.env.RF05_TEST_DATABASE || 'postgres'
if (!/^applytrack-audit-[a-f0-9]{12}$/.test(container || '')) throw new Error('Only the isolated audit container is allowed.')
const owner = '00000000-0000-4000-8000-000000000001'
const quote = (value) => value === null ? 'null' : "'" + String(value).replaceAll("'", "''") + "'"
async function sql(statement, role = 'service_role') {
  const { stdout } = await exec('docker', ['exec', container, 'psql', '-U', 'supabase_admin', '-d', database,
    '-At', '-v', 'ON_ERROR_STOP=1', '-c',
    "set statement_timeout='15s'; set role " + role + "; " +
    (role === 'authenticated' ? "select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false); " : '') +
    statement], { maxBuffer: 1_000_000 })
  const json = stdout.trim().split(/\r?\n/).findLast((line) => /^[{[]/.test(line))
  return json ? JSON.parse(json) : null
}

class Query {
  constructor(table) { this.table = table; this.filters = []; this.value = null; this.operation = 'select' }
  select() { return this }
  eq(key, value) { this.filters.push(key + '=' + quote(value)); return this }
  maybeSingle() { return this }
  single() { return this }
  update(value) { this.value = value; this.operation = 'update'; return this }
  upsert(value) { this.value = value; this.operation = 'upsert'; return this }
  then(resolve, reject) { return this.execute().then(resolve, reject) }
  async execute() {
    try {
      let statement
      if (this.operation === 'update') {
        statement = 'update public.' + this.table + ' set ' +
          Object.entries(this.value).map(([key, value]) => key + '=' + quote(value)).join(',') +
          ' where ' + this.filters.join(' and ')
      } else if (this.operation === 'upsert') {
        statement = 'insert into public.job_alert_inboxes(user_id) values(' + quote(this.value.user_id) + ') on conflict(user_id) do nothing'
      } else {
        statement = 'select to_jsonb(t) from public.' + this.table + ' t where ' + this.filters.join(' and ')
      }
      const data = await sql(statement, this.role || 'service_role')
      if (this.afterSelect && this.operation === 'select') await this.afterSelect()
      return { data, error: null }
    } catch { return { data: null, error: { message: 'Synthetic SQL failure' } } }
  }
}
const admin = {
  from: (table) => new Query(table),
  rpc: async (name, args) => {
    try {
      const params = Object.entries(args).map(([key, value]) => key + ' => ' +
        quote(typeof value === 'object' ? JSON.stringify(value) : value)).join(',')
      return { data: await sql("set application_name='rf05-claim-worker'; select public." + name + '(' + params + ')'), error: null }
    } catch { return { data: null, error: { message: 'Synthetic SQL failure' } } }
  },
}
async function fixture(id) {
  const h = await harness({ admin, inbox: { id: 501, user_id: owner } })
  h.event.data.email_id = id
  return h
}
async function snapshot() {
  return sql("select jsonb_build_object('leads',(select count(*) from public.job_leads),'receipt',(select last_received_at from public.job_alert_inboxes where id=501))")
}

test('RF-05 real SQL setup and service-only invoker RPC access', async () => {
  await sql("grant usage on schema public to service_role; grant select,insert,update on public.job_alert_inboxes,public.job_alert_messages to service_role; grant usage,select on sequence public.job_alert_messages_id_seq,public.job_alert_inboxes_id_seq to service_role; insert into public.job_alert_inboxes(id,user_id,address_alias) values(501,'" + owner + "','" + 'a'.repeat(32) + "')", 'supabase_admin')
  for (const signature of ['claim_job_alert_message(bigint,text,text,text,timestamptz,text)', 'finish_job_alert_message(bigint,uuid,bigint,text,jsonb)']) {
    const result = await sql("select jsonb_build_object('anon',has_function_privilege('anon'," + quote('public.' + signature) + ",'EXECUTE'),'authenticated',has_function_privilege('authenticated'," + quote('public.' + signature) + ",'EXECUTE'),'service',has_function_privilege('service_role'," + quote('public.' + signature) + ",'EXECUTE'),'definer',(select prosecdef from pg_proc where oid=" + quote('public.' + signature) + "::regprocedure))")
    assert.deepEqual(result, { anon: false, authenticated: false, service: true, definer: false })
  }
  await sql(`create table public.audit_alert_fault(stage text);
    grant select on public.audit_alert_fault to service_role;
    create function public.audit_alert_fault() returns trigger language plpgsql as $$
    begin
      if exists(select 1 from public.audit_alert_fault where stage=TG_TABLE_NAME)
        and (TG_TABLE_NAME <> 'job_alert_messages' or to_jsonb(NEW)->>'status' in ('completed','partial','ignored')) then
        raise exception 'Synthetic write failure';
      end if;
      if TG_TABLE_NAME = 'job_alert_messages' and to_jsonb(NEW)->>'status' = 'failed'
        and exists(select 1 from public.audit_alert_fault where stage='failure_release') then
        raise exception 'Synthetic failure-release error';
      end if;
      return NEW;
    end; $$;
    create trigger audit_alert_fault before insert or update on public.job_leads for each row execute function public.audit_alert_fault();
    create trigger audit_alert_fault before update on public.job_alert_inboxes for each row execute function public.audit_alert_fault();
    create trigger audit_alert_fault before update on public.job_alert_messages for each row execute function public.audit_alert_fault();`, 'supabase_admin')
})

test('RF-05 actual handler + SQL: each write failure rolls back the transaction and retries', async () => {
  for (const table of ['job_leads', 'job_alert_inboxes', 'job_alert_messages']) {
    const h = await fixture('rf05-failure-' + table)
    h.email.html = h.email.html.replace('/123', '/' + (10001 + ['job_leads', 'job_alert_inboxes', 'job_alert_messages'].indexOf(table)))
    const before = await snapshot()
    await sql('insert into public.audit_alert_fault values(' + quote(table) + ')', 'supabase_admin')
    assert.equal((await h.handler(h.request())).status, 500)
    assert.deepEqual(await snapshot(), before)
    const status = await sql("select jsonb_build_object('status',status) from public.job_alert_messages where resend_email_id=" + quote(h.event.data.email_id))
    assert.equal(status.status, 'failed')
    await sql('delete from public.audit_alert_fault', 'supabase_admin')
    assert.equal((await h.handler(h.request())).status, 200)
    assert.equal((await (await h.handler(h.request())).json()).duplicate, true)
  }
})

test('RF-05 actual handler + SQL: concurrent failed retries, lease takeover and stale-worker fencing', async () => {
  const h = await fixture('rf05-concurrent')
  h.state.retrieveFailed = true
  assert.equal((await h.handler(h.request())).status, 500)
  h.state.retrieveFailed = false
  let release, entered
  const gate = new Promise((resolve) => { release = resolve })
  const ready = new Promise((resolve) => { entered = resolve })
  h.state.retrieveGate = async () => { entered(); await gate }
  const worker = h.handler(h.request())
  await ready
  const attempts = await Promise.all(Array.from({ length: 8 }, () => h.handler(h.request())))
  assert.ok(attempts.every((response) => response.status === 503))
  await sql("update public.job_alert_messages set processing_started_at=clock_timestamp()-interval '6 minutes' where resend_email_id='rf05-concurrent'")
  h.state.retrieveGate = null
  assert.equal((await h.handler(h.request())).status, 200)
  release()
  assert.equal((await worker).status, 500)
  const result = await sql("select jsonb_build_object('count',count(*),'completed',bool_and(status='completed')) from public.job_alert_messages where resend_email_id='rf05-concurrent'")
  assert.deepEqual(result, { count: 1, completed: true })
})

async function waitFor(check) {
  const deadline = Date.now() + 10_000
  while (!await check()) {
    if (Date.now() > deadline) throw new Error('SQL concurrency barrier timed out.')
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

test('RF-05 actual handler + SQL: eight simultaneous initial claims and Failed retries overlap at a lock', async () => {
  await sql('create table public.audit_claim_gate(released boolean); insert into public.audit_claim_gate values(false)', 'supabase_admin')
  for (const retry of [false, true]) {
    const h = await fixture('rf05-overlap-' + retry)
    if (retry) {
      h.state.retrieveFailed = true
      assert.equal((await h.handler(h.request())).status, 500)
      h.state.retrieveFailed = false
    }
    await sql('update public.audit_claim_gate set released=false', 'supabase_admin')
    const barrier = sql(`set application_name='rf05-claim-barrier'; begin;
      lock table public.job_alert_messages in share mode;
      do $$ begin while not (select released from public.audit_claim_gate) loop
        perform pg_sleep(0.05); end loop; end; $$; commit;`, 'supabase_admin')
    let releaseMail
    const mailGate = new Promise((resolve) => { releaseMail = resolve })
    h.state.retrieveGate = () => mailGate
    let deliveries = []
    const responses = []
    try {
      await waitFor(async () => (await sql("select jsonb_build_object('ready',exists(select 1 from pg_stat_activity where datname=current_database() and application_name='rf05-claim-barrier' and wait_event='PgSleep'))", 'supabase_admin')).ready)
      deliveries = Array.from({ length: 8 }, async () => {
        const response = await h.handler(h.request())
        responses.push(response)
        return response
      })
      await waitFor(async () => (await sql("select jsonb_build_object('count',count(*)) from pg_stat_activity where datname=current_database() and application_name='rf05-claim-worker' and wait_event_type='Lock'", 'supabase_admin')).count === 8)
      await sql('update public.audit_claim_gate set released=true', 'supabase_admin')
      await barrier
      await waitFor(() => responses.length === 7)
      assert.ok(responses.every((response) => response.status === 503))
      releaseMail()
      const all = await Promise.all(deliveries)
      assert.equal(all.filter((response) => response.status === 200).length, 1)
      assert.equal(h.state.retrievals, retry ? 2 : 1)
    } finally {
      releaseMail()
      await sql('update public.audit_claim_gate set released=true', 'supabase_admin')
      await barrier
      await Promise.all(deliveries)
    }
  }
})

test('RF-05 actual handler + SQL: metadata refresh preserves applied and expired leads', async () => {
  for (const state of ['applied', 'expired']) {
    const h = await fixture('rf05-terminal-' + state)
    await sql("update public.job_leads set state=" + quote(state) + " where user_id=" + quote(owner) + " and source='linkedin' and external_id='123'")
    assert.equal((await h.handler(h.request())).status, 200)
    assert.equal((await sql("select jsonb_build_object('state',state) from public.job_leads where user_id=" + quote(owner) + " and source='linkedin' and external_id='123'")).state, state)
  }
})

test('RF-05 actual handler + SQL: Indeed salary, metadata and creation/update counts remain supported', async () => {
  const h = await fixture('rf05-indeed')
  h.email.from = 'jobs@indeed.com'
  h.email.html = '<section><a href="https://ca.indeed.com/viewjob?jk=rf05indeed">Data Analyst</a><p>Synthetic Indeed</p><p>Toronto, Ontario</p><p>$90,000 - $120,000 a year</p><p>Remote</p></section>'
  const first = await h.handler(h.request())
  assert.equal(first.status, 200)
  assert.deepEqual(await first.json(), { created: 1, found: 1, ok: true })
  const result = await sql("select jsonb_build_object('min',salary_min,'max',salary_max,'source',source) from public.job_leads where user_id=" + quote(owner) + " and external_id='rf05indeed'")
  assert.deepEqual(result, { min: 90000, max: 120000, source: 'indeed' })
  h.event.data.email_id = 'rf05-indeed-update'
  assert.deepEqual(await (await h.handler(h.request())).json(), { created: 0, found: 1, ok: true })
  const counts = await sql("select jsonb_build_object('created',jobs_created,'updated',jobs_updated,'found',jobs_found) from public.job_alert_messages where resend_email_id='rf05-indeed-update'")
  assert.deepEqual(counts, { created: 0, updated: 1, found: 1 })
})

test('RF-05 actual handler + SQL: failed failure-release writes expire and legacy Processing is reclaimable', async () => {
  const h = await fixture('rf05-release-failure')
  h.state.retrieveFailed = true
  await sql("insert into public.audit_alert_fault values('failure_release')", 'supabase_admin')
  assert.equal((await h.handler(h.request())).status, 500)
  assert.equal((await h.handler(h.request())).status, 503)
  await sql('delete from public.audit_alert_fault', 'supabase_admin')
  await sql("update public.job_alert_messages set processing_started_at=clock_timestamp()-interval '6 minutes' where resend_email_id='rf05-release-failure'")
  h.state.retrieveFailed = false
  assert.equal((await h.handler(h.request())).status, 200)
  const legacy = await fixture('rf05-legacy')
  await sql("insert into public.job_alert_messages(user_id,resend_email_id,status) values(" + quote(owner) + ",'rf05-legacy','processing')")
  assert.equal((await legacy.handler(legacy.request())).status, 200)
})

test('RF-05 actual handler + SQL: unknown and empty alerts require successful terminal writes', async () => {
  for (const provider of ['unknown', 'linkedin']) {
    const h = await fixture('rf05-empty-' + provider)
    h.email.from = provider === 'unknown' ? 'newsletter@example.invalid' : 'jobs@linkedin.com'
    h.email.html = '<p>No supported job links</p>'
    await sql("insert into public.audit_alert_fault values('job_alert_messages')", 'supabase_admin')
    assert.equal((await h.handler(h.request())).status, 500)
    await sql('delete from public.audit_alert_fault', 'supabase_admin')
    assert.equal((await h.handler(h.request())).status, 200)
    assert.equal((await (await h.handler(h.request())).json()).duplicate, true)
    const result = await sql("select jsonb_build_object('status',status) from public.job_alert_messages where resend_email_id=" + quote(h.event.data.email_id))
    assert.equal(result.status, provider === 'unknown' ? 'ignored' : 'partial')
  }
})

test('RF-05 real SQL: null/stale tokens cannot commit and inbox mismatches roll back', async () => {
  await sql("insert into public.job_alert_messages(user_id,resend_email_id,status) values(" + quote(owner) + ",'rf05-null-token','processing')")
  const row = await sql("select jsonb_build_object('id',id) from public.job_alert_messages where resend_email_id='rf05-null-token'")
  await assert.rejects(sql("select public.finish_job_alert_message(" + row.id + ",null,501,'unknown','[]')"), /lease is no longer valid/)
  const claim = await sql("select public.claim_job_alert_message(501,'rf05-null-token','','test',now(),'v2')")
  const before = await snapshot()
  await assert.rejects(sql("select public.finish_job_alert_message(" + claim.id + "," + quote(claim.token) + ",999999,'unknown','[]')"), /inbox no longer exists/)
  assert.deepEqual(await snapshot(), before)
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(sql("select public.claim_job_alert_message(501,'rf05-denied','','test',now(),'v2')", role), /permission denied/)
    await assert.rejects(sql("select public.finish_job_alert_message(" + claim.id + "," + quote(claim.token) + ",501,'unknown','[]')", role), /permission denied/)
  }
})

test('RF-05 actual client initialization + SQL: concurrent callers return one existing alias unchanged', async () => {
  let entered = 0, release
  const gate = new Promise((resolve) => { release = resolve })
  const userId = '00000000-0000-4000-8000-000000000002'
  const context = createContext({ crypto })
  const module = new SourceTextModule(await readFile(new URL('../../../src/api/jobAgent.js', import.meta.url), 'utf8'), { context })
  await module.link(async (specifier) => {
    const exports = specifier.includes('supabase') ? { supabase: {
      from: (table) => {
        const query = new Query(table)
        query.role = 'authenticated'
        query.afterSelect = async () => { if (++entered <= 2) { if (entered === 2) release(); await gate } }
        return query
      },
    } } : { fromApplicationRow: (row) => row }
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
    }, { context })
  })
  await module.evaluate()
  const [first, second] = await Promise.all([
    module.namespace.createJobAlertInbox(userId), module.namespace.createJobAlertInbox(userId),
  ])
  assert.equal(first.id, second.id)
  assert.equal(first.addressAlias, second.addressAlias)
  await sql('update public.job_alert_inboxes set enabled=false where user_id=' + quote(userId))
  assert.equal((await module.namespace.createJobAlertInbox(userId)).enabled, false)
})

test('RF-06 actual handler + SQL: ingestion and conversion serialize in both lock orders', async () => {
  await sql('create table public.audit_state_gate(released boolean); insert into public.audit_state_gate values(false); grant select on public.audit_state_gate to authenticated,service_role', 'supabase_admin')
  const gate = `do $$ begin while not (select released from public.audit_state_gate) loop perform pg_sleep(0.05); end loop; end; $$;`
  for (const conversionFirst of [true, false]) {
    const externalId = conversionFirst ? '9401' : '9402'
    const before = await sql("select jsonb_build_object('applications',count(*)) from public.applications")
    await sql("insert into public.job_leads(user_id,source,external_id,title,company) values(" + quote(owner) + ",'linkedin'," + quote(externalId) + ",'RF06 overlap','Synthetic')")
    const lead = await sql("select jsonb_build_object('id',id) from public.job_leads where external_id=" + quote(externalId) + ' and user_id=' + quote(owner))
    const convert = "select set_config('request.jwt.claim.sub'," + quote(owner) + ",false); select to_jsonb(public.complete_job_lead_application(" + lead.id + ",'2026-10-01'));"
    const h = await fixture('rf06-overlap-' + conversionFirst)
    h.email.html = h.email.html.replace('/123', '/' + externalId)
    await sql('update public.audit_state_gate set released=false', 'supabase_admin')
    let first, second
    if (conversionFirst) {
      first = sql("set application_name='rf06-first'; begin; " + convert + gate + ' commit;', 'authenticated')
    } else {
      const originalRpc = admin.rpc
      const gatedAdmin = { ...admin, rpc: async (name, args) => {
        if (name !== 'finish_job_alert_message') return originalRpc(name, args)
        const params = Object.entries(args).map(([key, value]) => key + ' => ' + quote(typeof value === 'object' ? JSON.stringify(value) : value)).join(',')
        return { data: await sql("set application_name='rf06-first'; begin; select public.finish_job_alert_message(" + params + '); ' + gate + ' commit;'), error: null }
      } }
      const gated = await harness({ admin: gatedAdmin, inbox: { id: 501, user_id: owner } })
      gated.event.data.email_id = h.event.data.email_id
      gated.email.html = h.email.html
      first = gated.handler(gated.request())
    }
    try {
      await waitFor(async () => (await sql("select jsonb_build_object('ready',exists(select 1 from pg_stat_activity where datname=current_database() and application_name='rf06-first' and wait_event='PgSleep'))", 'supabase_admin')).ready)
      second = conversionFirst ? h.handler(h.request()) : sql("set application_name='rf06-second'; " + convert, 'authenticated')
      const waiter = conversionFirst ? 'rf05-claim-worker' : 'rf06-second'
      await waitFor(async () => (await sql("select jsonb_build_object('waiting',exists(select 1 from pg_stat_activity where datname=current_database() and application_name=" + quote(waiter) + " and wait_event_type='Lock'))", 'supabase_admin')).waiting)
      await sql('update public.audit_state_gate set released=true', 'supabase_admin')
      const results = await Promise.all([first, second])
      assert.equal(results[conversionFirst ? 1 : 0].status, 200)
      const result = await sql("select jsonb_build_object('state',l.state,'application',to_jsonb(a),'messages',(select count(*) from public.job_alert_messages where resend_email_id=" + quote(h.event.data.email_id) + " and status='completed' and processing_token is null)) from public.job_leads l join public.applications a on a.id=l.application_id where l.id=" + lead.id)
      assert.equal(result.state, 'applied')
      assert.equal(result.application.applied_date, '2026-10-01')
      assert.equal(result.application.user_id, owner)
      assert.equal(result.messages, 1)
      assert.equal((await sql("select jsonb_build_object('applications',count(*)) from public.applications")).applications, before.applications + 1)
      const retry = await sql(convert.replace('2026-10-01', '2027-01-01'), 'authenticated')
      assert.deepEqual(retry, result.application)
      assert.equal((await (await h.handler(h.request())).json()).duplicate, true)
    } finally {
      await sql('update public.audit_state_gate set released=true', 'supabase_admin')
      await Promise.allSettled([first, second].filter(Boolean))
    }
  }
})
