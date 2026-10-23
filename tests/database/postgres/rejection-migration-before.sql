begin;
insert into public.applications(id,user_id,company,role,status,applied_date,last_updated,notes)
values (615,'00000000-0000-4000-8000-000000000003','Legacy rejection','Engineer','Rejected','2020-01-01','2026-01-09','No reliable event date');
create temp table rejection_rows_before as select id,to_jsonb(a) as row_data from public.applications a;
create temp table rejection_security_before as
select 'table' as kind,jsonb_build_object('owner',relowner,'acl',relacl::text,'rls',relrowsecurity,'forced',relforcerowsecurity) as definition
from pg_class where oid='public.applications'::regclass
union all select 'policy',to_jsonb(p) from pg_policies p where schemaname='public' and tablename='applications'
union all select 'rpc',jsonb_build_object('definition',pg_get_functiondef(oid),'owner',proowner,'acl',proacl::text)
from pg_proc where pronamespace='public'::regnamespace and prokind='f'
union all select 'trigger',to_jsonb(t) from pg_trigger t where tgrelid='public.applications'::regclass;
