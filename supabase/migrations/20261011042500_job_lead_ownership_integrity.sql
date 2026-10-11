-- RF-04: enforce association ownership without changing RLS or conversion behavior.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
set local row_security = off;

-- Serialize preflight and DDL with both sides of the relationship.
lock table public.applications, public.job_leads in access exclusive mode;

do $$
declare
  invalid_count bigint;
begin
  if current_setting('server_version_num')::integer < 170000 then
    raise exception 'RF-04 requires PostgreSQL 17 or later; verify column-specific SET NULL support.';
  end if;

  if (select count(*) from pg_catalog.pg_attribute
    where attrelid in ('public.applications'::regclass, 'public.job_leads'::regclass)
      and attname = 'user_id' and attnotnull and not attisdropped) <> 2 then
    raise exception 'RF-04 blocked: both owner columns must retain NOT NULL; no schema repaired.';
  end if;

  select count(*) into invalid_count
  from public.job_leads as lead
  left join public.applications as application on application.id = lead.application_id
  where lead.application_id is not null
    and (application.id is null or application.user_id is distinct from lead.user_id);

  if invalid_count > 0 then
    raise exception using
      errcode = '23514',
      message = format('RF-04 blocked: %s invalid Job Lead/Application associations; no data repaired.', invalid_count);
  end if;
end;
$$;

alter table public.applications
  add constraint applications_user_id_id_key unique (user_id, id);

-- MATCH SIMPLE permits an unlinked lead; deletion must never null its owner.
alter table public.job_leads
  add constraint job_leads_application_owner_fkey
  foreign key (user_id, application_id)
  references public.applications (user_id, id)
  match simple on update no action on delete set null (application_id);

alter table public.job_leads
  drop constraint job_leads_application_id_fkey;

commit;
