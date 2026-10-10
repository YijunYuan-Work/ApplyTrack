-- Catalog checks only: safe before or after migration; no recovery RPC is called.
-- Run against the explicitly selected project. Every post-release check must pass.
begin read only;

with target_table as (
  select c.* from pg_class c
  where c.oid = to_regclass('public.password_reset_throttles')
), target_functions as (
  select p.* from pg_proc p
  where p.oid in (
    to_regprocedure('public.consume_password_reset_quota(text,text)'),
    to_regprocedure('public.find_recovery_auth_email(text)')
  )
), checks as (
  select 'transaction_read_only' as name,
    current_setting('transaction_read_only') = 'on' as passed
  union all select 'migration_recorded', exists (
    select 1 from supabase_migrations.schema_migrations
    where version = '20261009201500'
  )
  union all select 'table_rls_enabled', exists (
    select 1 from target_table where relrowsecurity and relkind = 'r'
  )
  union all select 'table_has_no_client_policies', exists (select 1 from target_table)
    and not exists (select 1 from pg_policy where polrelid in (select oid from target_table))
  union all select 'table_client_privileges_revoked', exists (select 1 from target_table)
    and not exists (
      select 1 from target_table t cross join (values ('anon'), ('authenticated')) r(role)
      cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
        ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) v(privilege)
      where has_table_privilege(r.role, t.oid, v.privilege)
    ) and not exists (
      select 1 from pg_attribute a cross join (values ('anon'), ('authenticated')) r(role)
      cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')) v(privilege)
      where a.attrelid in (select oid from target_table) and a.attnum > 0 and not a.attisdropped
        and has_column_privilege(r.role, a.attrelid, a.attnum, v.privilege)
    ) and not exists (
      select 1 from pg_attribute a, lateral aclexplode(a.attacl) acl
      where a.attrelid in (select oid from target_table) and acl.grantee = 0
    ) and not exists (
      select 1 from target_table t, lateral aclexplode(coalesce(t.relacl, acldefault('r', t.relowner))) a
      where a.grantee = 0
    )
  union all select 'table_service_crud', exists (select 1 from target_table)
    and not exists (
      select 1 from target_table t cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) v(privilege)
      where not has_table_privilege('service_role', t.oid, v.privilege)
    )
  union all select 'table_columns_and_primary_key', (
    select count(*) = 3 and bool_and(a.attnotnull) and bool_and(
      (a.attname = 'bucket_key' and a.atttypid = 'text'::regtype) or
      (a.attname = 'attempts' and a.atttypid = 'integer'::regtype) or
      (a.attname = 'expires_at' and a.atttypid = 'timestamptz'::regtype)
    ) from pg_attribute a where a.attrelid in (select oid from target_table)
      and a.attnum > 0 and not a.attisdropped
  ) and exists (
    select 1 from pg_constraint c join pg_attribute a
      on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.conrelid in (select oid from target_table) and c.contype = 'p'
      and cardinality(c.conkey) = 1 and a.attname = 'bucket_key'
  )
  union all select 'attempts_check_constraint', exists (
    select 1 from pg_constraint where conrelid in (select oid from target_table)
      and contype = 'c' and convalidated and pg_get_constraintdef(oid) = 'CHECK ((attempts >= 1))'
  )
  union all select 'expiry_index_valid', exists (
    select 1 from pg_index i join pg_attribute a
      on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
    where i.indexrelid = to_regclass('public.password_reset_throttles_expires_at_idx')
      and i.indrelid in (select oid from target_table) and i.indisvalid and i.indisready
      and i.indnkeyatts = 1 and a.attname = 'expires_at'
  )
  union all select 'both_rpc_signatures_exist', (select count(*) = 2 from target_functions)
  union all select 'rpc_client_execute_revoked', (select count(*) = 2 from target_functions)
    and not exists (
      select 1 from target_functions p cross join (values ('anon'), ('authenticated')) r(role)
      where has_function_privilege(r.role, p.oid, 'EXECUTE')
    ) and not exists (
      select 1 from target_functions p, lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where a.grantee = 0 and a.privilege_type = 'EXECUTE'
    )
  union all select 'rpc_service_execute', (select count(*) = 2 from target_functions)
    and not exists (select 1 from target_functions where not has_function_privilege('service_role', oid, 'EXECUTE'))
  union all select 'rpc_empty_search_path', (select count(*) = 2 from target_functions)
    and not exists (select 1 from target_functions where not coalesce(proconfig @> array['search_path=""'], false))
  union all select 'rpc_owner_is_privileged', (select count(*) = 2 from target_functions)
    and not exists (
      select 1 from target_functions p join pg_roles r on r.oid = p.proowner
      where r.rolname not in ('postgres', 'supabase_admin')
    )
  union all select 'quota_invoker_and_return_type', exists (
    select 1 from target_functions p join pg_language l on l.oid = p.prolang
    where p.oid = to_regprocedure('public.consume_password_reset_quota(text,text)')
      and not p.prosecdef and p.prorettype = 'boolean'::regtype
      and p.provolatile = 'v' and l.lanname = 'plpgsql'
  )
  union all select 'lookup_definer_and_return_type', exists (
    select 1 from target_functions p join pg_language l on l.oid = p.prolang
    where p.oid = to_regprocedure('public.find_recovery_auth_email(text)')
      and p.prosecdef and p.prorettype = 'text'::regtype
      and p.provolatile = 's' and l.lanname = 'sql'
  )
  union all select 'service_role_schema_and_rls_bypass',
    has_schema_privilege('service_role', 'public', 'USAGE')
    and exists (select 1 from pg_roles where rolname = 'service_role' and rolbypassrls)
), results as (
  select name, coalesce(passed, false) as passed from checks
)
select jsonb_build_object(
  'server_version', current_setting('server_version'),
  'all_passed', bool_and(passed),
  'checks', jsonb_object_agg(name, passed order by name)
) as recovery_release_verification from results;

rollback;
