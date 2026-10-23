-- Run unchanged against fresh schema and the incremental migration result.
create function public.audit_expect_owner_fk(statement text, label text)
returns void language plpgsql security invoker as $$
declare rejected_constraint text;
begin
  begin
    execute statement;
    raise exception 'FAIL: % was allowed', label;
  exception when foreign_key_violation then
    get stacked diagnostics rejected_constraint = constraint_name;
    perform public.audit_assert(rejected_constraint = 'job_leads_application_owner_fkey', label);
  end;
end;
$$;
grant execute on function public.audit_expect_owner_fk(text, text) to authenticated, service_role;
grant execute on function public.audit_assert(boolean, text) to service_role;
-- Minimal server-side grant fixture; no production grants are modified.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.applications, public.job_leads to service_role;
grant usage, select on sequence public.applications_id_seq, public.job_leads_id_seq to service_role;

select public.audit_assert((select rolbypassrls from pg_roles where rolname='service_role'),'service role fixture bypasses RLS');
select public.audit_assert((select convalidated and not condeferrable and confmatchtype='s' and confupdtype='a'
  and confdeltype='n' and confdelsetcols = array[(select attnum from pg_attribute
    where attrelid='public.job_leads'::regclass and attname='application_id')]::smallint[]
  from pg_constraint where conrelid='public.job_leads'::regclass and conname='job_leads_application_owner_fkey'),
  'validated immediate FK sets only application_id NULL on deletion');
select public.audit_assert(has_column_privilege('authenticated','public.job_leads','state','UPDATE')
  and has_column_privilege('authenticated','public.job_leads','application_id','UPDATE')
  and not has_column_privilege('authenticated','public.job_leads','title','UPDATE')
  and not has_column_privilege('authenticated','public.job_leads','user_id','UPDATE'),
  'authenticated update column allowlist is unchanged');
select public.audit_assert((select relrowsecurity from pg_class where oid='public.job_leads'::regclass)
  and (select relrowsecurity from pg_class where oid='public.applications'::regclass),'RLS remains enabled on both tables');

set role anon;
do $$ begin
  begin
    perform public.complete_job_lead_application(201,current_date);
    raise exception 'FAIL: anonymous conversion was allowed';
  exception when insufficient_privilege then raise notice 'PASS: actual anonymous RPC execution denied'; end;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
do $$ begin
  begin
    update public.job_leads set application_id=(select application_id from public.job_leads where id=201) where id=203;
    raise exception 'FAIL: duplicate application association was allowed';
  exception when unique_violation then raise notice 'PASS: original one-lead-per-application uniqueness preserved'; end;
end $$;
reset role;

select public.audit_expect_owner_fk('update public.job_leads set application_id=102 where id=203',
  'privileged lead UPDATE rejects cross-owner application');
select public.audit_expect_owner_fk($q$insert into public.job_leads(user_id,application_id,source,external_id,title,company)
  values ('00000000-0000-4000-8000-000000000001',102,'linkedin','bad-admin','Test','Test')$q$,
  'privileged lead INSERT rejects cross-owner application');

set role service_role;
select public.audit_expect_owner_fk('update public.job_leads set application_id=102 where id=203',
  'service-role UPDATE rejects cross-owner application');
select public.audit_expect_owner_fk('update public.job_leads set application_id=999999 where id=203',
  'service-role UPDATE rejects missing application');
select public.audit_expect_owner_fk($q$insert into public.job_leads(user_id,application_id,source,external_id,title,company)
  values ('00000000-0000-4000-8000-000000000001',102,'linkedin','bad-service','Test','Test')$q$,
  'service-role INSERT rejects cross-owner application');
select public.audit_expect_owner_fk($q$insert into public.job_leads(user_id,application_id,source,external_id,title,company)
  values ('00000000-0000-4000-8000-000000000001',102,'linkedin','203','Test','Test')
  on conflict (user_id,source,external_id) do update set application_id=excluded.application_id$q$,
  'service-role UPSERT rejects cross-owner application');
update public.job_leads set application_id=101 where id=203;
select public.audit_expect_owner_fk($q$update public.job_leads set user_id='00000000-0000-4000-8000-000000000002'
  where id=203$q$,'service-role lead owner change cannot break association');
select public.audit_expect_owner_fk($q$update public.applications set user_id='00000000-0000-4000-8000-000000000002'
  where id=101$q$,'service-role application owner change cannot break association');
select public.audit_expect_owner_fk('update public.applications set id=999999 where id=101',
  'application ID change cannot orphan association');
reset role;
select public.audit_expect_owner_fk($q$update public.applications set user_id='00000000-0000-4000-8000-000000000002'
  where id=101$q$,'privileged application owner change cannot break association');

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
delete from public.applications where id=101;
select public.audit_assert((select application_id is null and user_id=auth.uid() from public.job_leads where id=203),
  'application deletion unlinks lead without deleting it or changing owner');
select public.audit_assert((select state from public.job_leads where id=203)='new',
  'application deletion preserves existing lead state contract');
update public.applications set role='Edited engineer',notes='Ordinary application edit'
where id=(select application_id from public.job_leads where id=201);
select public.audit_assert((select a.role='Edited engineer' and a.notes='Ordinary application edit'
  and l.user_id=a.user_id and l.state='applied'
  from public.job_leads l join public.applications a on a.id=l.application_id where l.id=201),
  'ordinary authenticated application edits preserve the valid lead association');
reset role;

-- An unrelated server-side alert update preserves a legitimate conversion link.
set role service_role;
insert into public.job_leads(user_id,source,external_id,title,company)
values ('00000000-0000-4000-8000-000000000001','linkedin','201','Updated alert title','Owner A')
on conflict (user_id,source,external_id) do update set title=excluded.title;
select public.audit_assert((select l.application_id=a.id and l.user_id=a.user_id
  from public.job_leads l join public.applications a on a.id=l.application_id where l.id=201),
  'valid service-role ingestion UPSERT preserves converted association');
reset role;
select public.audit_assert(not exists(select 1 from public.job_leads l left join public.applications a on a.id=l.application_id
  where l.application_id is not null and (a.id is null or a.user_id is distinct from l.user_id)),
  'all non-null relationships satisfy same-owner invariant');
