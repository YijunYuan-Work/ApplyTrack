# Production Privilege Review and RF-04 Preparation

Date: 2026-10-11. Baseline: main `0a5b165`.
Status: **Proposal only; RF-04 In Progress; F01 unresolved in production.**
This documentation-only review does not authorize grants, exports, migrations,
deployment, integration changes or rollback on production.

## Findings and Evidence Boundaries

ChatGPT's reported production preflight found 0 cross-owner associations,
0 missing Applications, 0 duplicate links and 31 valid linked leads. The old FK
remains; migration `20261011042500` is neither registered nor applied. Clean
existing data does not enforce future ownership. No user rows were accessed or
exported by this preparation task.

Independent catalog-only queries in `BEGIN READ ONLY` against
`qotipygmwlovxklkexjb` confirmed:

- Applications owner/grantor `postgres`; RLS enabled; no column ACLs.
- `anon`, `authenticated`, `service_role` each have eight explicit table rights:
  SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE, MAINTAIN;
  none with grant option. No PUBLIC table grant was returned.
- Table defaults in `public` for both creators `postgres` and `supabase_admin`
  grant those same eight rights to the three runtime roles. No global table
  default ACL was returned. Creator/owner grants are outside this proposal.
- These runtime roles cannot LOGIN or CREATE in `public`, and have no membership
  in `postgres`, `supabase_admin` or `pg_maintain`. Only service_role has BYPASSRLS.

The repository's Applications setup enables owner RLS but does not explicitly
set its grants or table defaults. Job Agent migrations separately revoke/regrant
their tables, including restricted Lead column UPDATE. They must not be widened.

The [official Supabase bootstrap source](https://github.com/supabase/postgres/blob/develop/migrations/db/init-scripts/00000000000000-initial-schema.sql)
uses `ALTER DEFAULT PRIVILEGES ... GRANT ALL` on public tables, including for
supabase_admin. The [current API security guide](https://supabase.com/docs/guides/api/securing-your-api)
documents historical automatic exposure and a move toward explicit grants.
These explain a documented platform source consistent with the live ACLs;
catalogs do **not** establish the exact original operator, command or date.
PostgreSQL itself does not give PUBLIC table rights by default. The Supabase
changelog was consulted; no relevant change was applied to this project.

## Permission Versus Reachability

| Right | Risk if SQL execution as the role becomes reachable | Evidence / limitation |
| --- | --- | --- |
| TRUNCATE | Whole-table deletion bypasses row policies. FK dependencies can require truncating referencing tables too; it is not equivalent to row DELETE. | Confirmed on synthetic RLS tables. Normal REST DELETE remains RLS-scoped; no anonymous arbitrary-SQL RPC was discovered in ChatGPT's inventory. |
| TRIGGER | Can attach a trigger if its function is executable; can change write behavior. It does not alone grant ownership, disable RI triggers, create arbitrary functions or bypass RLS. | Existing trigger execution does not require runtime TRIGGER permission. Public-schema CREATE is denied; other-schema/function/RPC paths were not exhaustively audited. |
| MAINTAIN | Allows maintenance operations, potentially expensive work/locks; not blanket row CRUD or ownership. | PostgreSQL 17 includes VACUUM, ANALYZE, CLUSTER, REINDEX, REFRESH MATERIALIZED VIEW and LOCK TABLE. There is no ordinary REST maintenance verb. |
| REFERENCES | Unneeded for runtime CRUD; can support new FK creation with additional DDL powers and expose existence information. | Existing FK enforcement/cascades do not require this grant on each write. |
| Anon CRUD | Currently RLS blocks row access with no anon policy; unnecessary ACLs expand exposure if policy/RLS drifts. | Removing grants is defense in depth, not evidence of an existing anonymous data leak. |

References: [PostgreSQL privileges](https://www.postgresql.org/docs/17/ddl-priv.html),
[RLS limitations](https://www.postgresql.org/docs/17/ddl-rowsecurity.html),
[CREATE TRIGGER prerequisites](https://www.postgresql.org/docs/17/sql-createtrigger.html),
[PostgREST table API](https://docs.postgrest.org/en/v12/references/api/tables_views.html).
Runtime roles being NOLOGIN prevents ordinary direct authentication as those
roles, not a compromised privileged session doing SET ROLE. No public exploit
or complete absence of alternate SQL paths is claimed.

## Smallest Compatibility-Preserving Proposal

Reduce only Applications' runtime table ACLs and the two observed public table
defaults. Keep authenticated/service-role CRUD; remove all anon table defaults
and Applications rights. Leave other existing tables, column grants, sequences,
functions, roles, schemas, Auth, Storage, owners and RLS unchanged.

Keeping authenticated CRUD defaults avoids changing current creation contracts,
but **does not make new public tables safe without RLS**. Each future migration
must enable owner-scoped RLS and explicitly override grants where appropriate.
Opt-in defaults for authenticated as well would be a separate broader change.
Defaults affect objects created by that exact role, not existing tables or other
creators. Schema-level revocation cannot cancel global default grants.
[PostgreSQL default privilege rules](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).

### Exact Proposed SQL (Not a Production Authorization)

Run only after independent approval, privately captured ACL baseline, current
target/version/owner/default-creator/global-ACL/membership checks and a reviewed
operator with authority over BOTH creators (hosted postgres alone may lack
authority over supabase_admin). Stop rather than silently skipping one creator.
Use psql `-X --set=ON_ERROR_STOP=1`; do not place this block in migrations yet.

<!-- privilege-proposal-start -->
```sql
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$
begin
  if current_setting('server_version_num')::integer < 170000
     or (select relowner <> 'postgres'::regrole or not relrowsecurity
         from pg_class where oid = 'public.applications'::regclass)
     or exists (select 1 from pg_attribute
                where attrelid = 'public.applications'::regclass and attacl is not null)
  then raise exception 'Privilege proposal blocked: version/owner/RLS/column ACL drift';
  end if;
end $$;
revoke all privileges on table public.applications
  from anon, authenticated, service_role;
grant select, insert, update, delete on table public.applications
  to authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges for role supabase_admin in schema public
  revoke all privileges on tables from anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
do $$
declare r text; p text;
begin
  foreach p in array array['SELECT','INSERT','UPDATE','DELETE','REFERENCES','TRIGGER','TRUNCATE','MAINTAIN'] loop
    if has_table_privilege('anon','public.applications',p) then
      raise exception 'Privilege proposal blocked: residual anon privilege %', p;
    end if;
  end loop;
  foreach r in array array['authenticated','service_role'] loop
    foreach p in array array['REFERENCES','TRIGGER','TRUNCATE','MAINTAIN'] loop
      if has_table_privilege(r,'public.applications',p) then
        raise exception 'Privilege proposal blocked: residual % privilege %', r, p;
      end if;
    end loop;
  end loop;
end $$;
commit;
```
<!-- privilege-proposal-end -->

Before release, repeat `aclexplode(relacl)`, `aclexplode(defaclacl)` and role
membership checks in a read-only transaction. Stop on grant options, additional
grantors/creators, global or PUBLIC table defaults, owner/column ACL drift,
inherited rights or unknown administrative writers. REVOKE uses RESTRICT, not
CASCADE. Do not broaden privileges or membership to make this proposal execute.

Post-change read-only checks (each row must match the matrix, not just SELECT):

```sql
select r, p, has_table_privilege(r,'public.applications',p) as allowed
from unnest(array['anon','authenticated','service_role']) r
cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','REFERENCES','TRIGGER','TRUNCATE','MAINTAIN']) p;
select pg_get_userbyid(d.defaclrole) as creator, n.nspname,
       case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,
       a.privilege_type, a.is_grantable
from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
cross join lateral aclexplode(d.defaclacl) a
where d.defaclobjtype='r' and (n.nspname='public' or d.defaclnamespace=0);
```

Expected: anon all false; authenticated/service_role only four CRUD rights;
both creators' public defaults match that matrix for runtime grantees. Preserve
unrelated defaults/owner entries. Also compare policies, FK/trigger definitions,
Lead column permissions, RPC ACL/definition and all sequence ACLs to baseline.

Compatibility: application CRUD and the SECURITY INVOKER conversion RPC need
CRUD, not TRIGGER/REFERENCES/MAINTAIN/TRUNCATE. Identity generation and existing
sequence USAGE/SELECT remain untouched; direct sequence privileges are separate
from table grants. Ingestion uses inbox/message/lead DML, not Applications DDL.
Its current existing-table and sequence rights remain unchanged. BYPASSRLS
does not bypass missing table ACLs, and removing service_role DDL does not remove
its BYPASSRLS attribute. Administrators still create triggers/constraints.

## Local Validation and Rollback

Validation uses the cached Supabase PostgreSQL 17.6 image, a randomly named,
labeled container, `--network none`, tmpfs, no host ports or mounts, synthetic
users and current repository schema. It models both creators' broad defaults
and Applications owner postgres, and executes the exact SQL block above.
This is not hosted HTTP/Edge or production-operator execution proof. Local
fixtures and synthetic logs are Git-ignored in `tmp/privilege-review/`; no test
script, fixture or runnable migration is part of this documentation-only PR.

| Local validation | Result |
| --- | --- |
| Exact documented SQL, executed twice on each baseline | Passed; repeat execution preserves the matrix |
| Fresh RF-04 schema | Passed; 56 PASS markers including reused role/ownership regressions |
| Original single-column FK baseline | Passed; 20 PASS markers; legacy F01 remains reproducible after ACL hardening |
| Actual SQL anon TRUNCATE/CREATE TRIGGER | Allowed on modeled broad baseline; denied after revocation; TRUNCATE bypass shown on an unreferenced RLS fixture, not production Applications |
| Actual anon ANALYZE | Allowed before; warning/skip after MAINTAIN revocation |
| Effective rights/new public tables | Expected eight-right matrix verified for all runtime roles and both creators |
| Authenticated CRUD/conversion RPC | Passed; owner isolation, idempotency, timestamp trigger and DELETE/SET NULL retained |
| Service ingestion DML | Inbox/message INSERT/UPDATE, Lead INSERT/UPSERT passed; no Deno/Resend call |
| Unrelated security definitions | Existing table/sequence ACLs, policies, triggers and conversion RPC unchanged by proposal |
| Local rollback inverse inside transaction | Restored modeled old right, then ROLLBACK retained hardened ACL |
| `npm test` / `npm run test:audit` | 34 / 18 passed |
| `npm run test:audit-db` | Passed; fresh/historical migration regressions, rejection cases, overlapping RPC conversions and ownership races |
| `npm run lint` / `npm run build` | Passed; local build only |

PASS markers are assertions/progress labels, not 76 independent test cases.
Reproduction on this workstation: `pwsh -NoProfile -File
tmp/privilege-review/run.ps1` and the same command with `-Legacy`. The runner
extracts the marked SQL block from this document and uses existing schema/test
fixtures, plus synthetic compatibility checks. Cached image ID:
`sha256:b3bfedb107413abb3b8cb0d0874b0414a1dceb3d55bc0c778de6ad22d1f7dc86`.
Reproducing elsewhere requires recreating that isolated harness; documentation
publication is not installing a permanent backup/security test platform.

Residual scope: existing non-Applications table grants and broad sequence/function
defaults are unchanged and need their own least-privilege review. Future tables
under unreviewed creators, inherited/global grants, grant options or platform
permission-resetting writers are not automatically hardened by this block.

Rollback: transaction failure restores ACLs atomically. After commit, prefer a
forward correction to the specific missing CRUD/sequence right, never blanket
GRANT ALL. Capture exact owner/grantor, grant options, table/column/sequence ACLs,
global/schema defaults and memberships before execution. Restoring the reported
baseline would reintroduce dangerous rights and future anon grants; that requires
separate risk acceptance. For this unchanged eight-right/no-grant-option baseline,
the inverse is `GRANT ALL ON public.applications TO anon, authenticated, service_role`
and `ALTER DEFAULT PRIVILEGES FOR ROLE <each original creator> IN SCHEMA public
GRANT ALL ON TABLES TO anon, authenticated, service_role`, under the original
grantor authority. Do not use this inverse after drift or on a later PostgreSQL
version with additional privileges. Defaults rollback does not repair ACLs on
tables created since the change: inventory and review those individually.

## Separate Authorization Gates

- ChatGPT reviews this documentation-only PR; merging docs changes no permissions.
- Separate explicit production privilege authorization names project, exact SQL,
  operator authority, ACL snapshot, window, compatibility checks and rollback.
- RF-04 export/real-data restore, migration/history registration and release each
  retain their own gates in the [migration runbook](RF_04_OWNERSHIP_MIGRATION_RUNBOOK.md).
- Complete the [backup operator checklist](RF_04_BACKUP_OPERATOR_CHECKLIST.md)
  before requesting migration execution. No backup/rehearsal is claimed here.
- Keep Supabase auto-production sync and Vercel Preview disabled. Stop on
  deployment activity, drift, missing access or unexpected local results.

Privilege hardening is defense in depth, **not the RF-04 ownership fix**. F01
remains unresolved until the composite FK is applied and independently verified.
