-- Synthetic pre-migration records: valid associations and an unlinked lead.
insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000003'),('00000000-0000-4000-8000-000000000004');
insert into public.applications(id,user_id,company,role,notes) values
  (601,'00000000-0000-4000-8000-000000000003','Legacy A','Valid legacy','Preserve exactly'),
  (602,'00000000-0000-4000-8000-000000000004','Legacy B','Valid legacy','Preserve B');
insert into public.job_leads(id,user_id,application_id,source,external_id,title,company,state) values
  (901,'00000000-0000-4000-8000-000000000003',601,'linkedin','901','Valid legacy','Legacy A','applied'),
  (902,'00000000-0000-4000-8000-000000000004',602,'indeed','902','Valid legacy','Legacy B','applied'),
  (903,'00000000-0000-4000-8000-000000000003',null,'linkedin','903','Unlinked legacy','Legacy A','new');

create table public.audit_legacy_snapshot as
select 'application' as kind,id,to_jsonb(a) as row_data from public.applications a
union all select 'lead',id,to_jsonb(l) from public.job_leads l;
create table public.audit_security_snapshot as
select 'privilege' as kind,to_jsonb(p) - 'table_catalog' as definition from information_schema.column_privileges p
where table_schema='public' and table_name in ('applications','job_leads')
union all select 'policy',to_jsonb(p) from pg_policies p
where schemaname='public' and tablename in ('applications','job_leads')
union all select 'rpc',jsonb_build_object('definition',pg_get_functiondef(oid),'acl',proacl::text)
from pg_proc where oid='public.complete_job_lead_application(bigint,date)'::regprocedure;
