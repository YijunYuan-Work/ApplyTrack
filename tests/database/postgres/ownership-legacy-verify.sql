do $$ begin
  if exists (
    (select kind,id,row_data from public.audit_legacy_snapshot except
      (select 'application',id,to_jsonb(a) from public.applications a union all
       select 'lead',id,to_jsonb(l) from public.job_leads l))
    union all
    ((select 'application',id,to_jsonb(a) from public.applications a union all
      select 'lead',id,to_jsonb(l) from public.job_leads l) except
     select kind,id,row_data from public.audit_legacy_snapshot)
  ) then raise exception 'FAIL: migration changed legacy data'; end if;
  raise notice 'PASS: migration preserves every legacy record and nullable association exactly';
  if exists (
    (select * from public.audit_security_snapshot except
      (select 'privilege',to_jsonb(p) - 'table_catalog' from information_schema.column_privileges p
       where table_schema='public' and table_name in ('applications','job_leads')
       union all select 'policy',to_jsonb(p) from pg_policies p
       where schemaname='public' and tablename in ('applications','job_leads')
       union all select 'rpc',jsonb_build_object('definition',pg_get_functiondef(oid),'acl',proacl::text)
       from pg_proc where oid='public.complete_job_lead_application(bigint,date)'::regprocedure))
    union all
    ((select 'privilege',to_jsonb(p) - 'table_catalog' from information_schema.column_privileges p
      where table_schema='public' and table_name in ('applications','job_leads')
      union all select 'policy',to_jsonb(p) from pg_policies p
      where schemaname='public' and tablename in ('applications','job_leads')
      union all select 'rpc',jsonb_build_object('definition',pg_get_functiondef(oid),'acl',proacl::text)
      from pg_proc where oid='public.complete_job_lead_application(bigint,date)'::regprocedure)
     except select * from public.audit_security_snapshot)
  ) then raise exception 'FAIL: migration changed policies, grants or RPC'; end if;
  raise notice 'PASS: migration preserves policies, column privileges and RPC definition/ACL exactly';
end $$;
