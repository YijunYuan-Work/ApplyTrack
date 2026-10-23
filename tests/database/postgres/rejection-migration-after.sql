do $$ begin
  if exists (
    (select id,row_data from rejection_rows_before except select id,to_jsonb(a)-'rejected_date' from public.applications a)
    union all
    (select id,to_jsonb(a)-'rejected_date' from public.applications a except select id,row_data from rejection_rows_before)
  ) then raise exception 'F08 migration altered existing application data'; end if;
  if exists(select 1 from public.applications where rejected_date is not null) then
    raise exception 'F08 migration inferred a historical date'; end if;
  if exists (
    (select * from rejection_security_before except
      (select 'table',jsonb_build_object('owner',relowner,'acl',relacl::text,'rls',relrowsecurity,'forced',relforcerowsecurity)
       from pg_class where oid='public.applications'::regclass
       union all select 'policy',to_jsonb(p) from pg_policies p where schemaname='public' and tablename='applications'
       union all select 'rpc',jsonb_build_object('definition',pg_get_functiondef(oid),'owner',proowner,'acl',proacl::text)
       from pg_proc where pronamespace='public'::regnamespace and prokind='f'
       union all select 'trigger',to_jsonb(t) from pg_trigger t where tgrelid='public.applications'::regclass))
  ) then raise exception 'F08 migration altered security or triggers'; end if;
  raise notice 'PASS: F08 additive migration preserves all existing data, RLS, ACLs, RPCs and triggers';
end $$;
commit;
