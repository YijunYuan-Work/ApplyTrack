# RF-04: Job Lead Ownership Migration Runbook

Date: 2026-10-11 (America/Toronto).
Status: **Completed - deployed and independently verified (2026-10-11 America/Toronto)**.
Scope: Historical Stage 1/release preparation and the production completion record. **This document does not authorize additional production SQL, exports, migrations, deployments, data repair or integration changes.**

Stage 1 baseline: `origin/main` at `2a0c450`; branch `security/rf-04-job-lead-ownership`.
Release-preparation baseline: main `0a5b165`.
PR: [#12](https://github.com/YijunYuan-Work/ApplyTrack/pull/12), reviewed and merged as `7cd120d`.
Findings: F01 and the SQL-boundary portion of G02 in
[Refinement 02](REFINEMENT_02_QUALITY_AUDIT.md). [Master Plan](REFINEMENT_MASTER_PLAN.md).

## Production Completion Record (2026-10-11 America/Toronto)

**RF-04 is complete.** The user explicitly approved release without a production backup. Codex reported a successful `supabase db push` using the linked project and the exact repository migration; ChatGPT independently read the live database and confirmed:
- Project `qotipygmwlovxklkexjb` is `ACTIVE_HEALTHY`, PostgreSQL 17.6.
- Supabase migration history records `20261011042500` / `job_lead_ownership_integrity` alongside all nine preceding migrations.
- `applications_user_id_id_key` is a validated `UNIQUE (user_id, id)`. `job_leads_application_owner_fkey` is validated and nondeferrable; `MATCH SIMPLE`, `ON UPDATE NO ACTION`, `ON DELETE SET NULL (application_id)`. The previous `job_leads_application_id_fkey` is absent, and `job_leads_application_id_key` remains.
- The owner columns remain NOT NULL. Applications: 420; Leads: 629; linked Leads: 31; missing Applications, cross-owner associations and duplicate links: all 0.
- Both tables retain RLS and their prior ownership policies. The existing Lead column grants and authenticated-only `complete_job_lead_application(bigint,date)` RPC remain unchanged. The only active Edge Function remains `ingest-job-alert` v21.
- No production backup was taken by explicit user risk acceptance; no anonymous-permission hardening, Auth/Edge change or automatic backend deployment-enable action was part of RF-04.

The SQL and registration were not asserted to be one database transaction. Their **successful final state** is confirmed by migration history and actual constraints/data. The pre-release gates and proposed operator steps below are retained solely as historical rationale; **do not rerun them**. F01 is closed; broader G02 hosted integration and earlier Applications grants remain separate future work.

## Root Cause and Design

`job_leads` UPDATE RLS checks the lead's `user_id`, not the owner of its referenced
Application. Authenticated users have UPDATE on `state` and `application_id`.
The original single-column FK checks Application existence even when the
referenced row is hidden by RLS; it does not compare owners. Consequently an
owned lead could reference a hidden, other-owned Application by ID.

The new declarative relationship is:

```sql
constraint applications_user_id_id_key unique (user_id, id)
-- On job_leads:
constraint job_leads_application_owner_fkey
  foreign key (user_id, application_id)
  references public.applications (user_id, id)
  match simple on update no action on delete set null (application_id)
```

The old `job_leads_application_id_fkey` is replaced, not the existing UNIQUE on
`job_leads.application_id`. Both owners remain NOT NULL. MATCH SIMPLE therefore
allows a null application link but cannot exempt a non-null link via a null
owner. The migration explicitly rejects nullable-owner schema drift.

**Column-specific SET NULL is essential:** deleting an Application nulls only
`application_id`, retaining the lead, its owner and existing state. Unqualified
SET NULL would attempt to null the owner too. Parent owner/ID changes that would
break a link are rejected rather than cascaded to another user. Ordinary
Application editing is unchanged.

PostgreSQL's FK checks enforce this for authenticated, service-role/BYPASSRLS
and normal privileged DML, including UPSERT and concurrent parent updates.
Administrative DDL, trigger disabling or replication-role bypass can defeat
constraints and are not supported application write paths; keep such powers
out of runtime credentials. No new SECURITY DEFINER code, RLS policy, privilege
or RPC change is introduced.

Alternatives considered:

- Revoking `application_id` UPDATE alone does not constrain service writes or
  parent owner changes, and could break the SECURITY INVOKER conversion RPC.
- An RLS subquery alone would not cover BYPASSRLS writes or later parent changes.
- A validation trigger needs parent-side enforcement and explicit concurrency
  locking. A composite FK expresses the invariant with built-in RI locking.
- Keeping both old/new FKs permanently is unnecessary duplication. The old FK
  is dropped only after the new validated FK is added in the same transaction.

References: [PostgreSQL 17 foreign keys and SET NULL column lists](https://www.postgresql.org/docs/17/ddl-constraints.html#DDL-CONSTRAINTS-FK),
[ALTER TABLE locks](https://www.postgresql.org/docs/17/sql-altertable.html).
The Supabase changelog was checked; its recent minor-upgrade notes do not change
this native FK mechanism. No version upgrade is performed here.

## Migration Dependencies and Compatibility

Migration: `supabase/migrations/20261011042500_job_lead_ownership_integrity.sql`,
created by the installed CLI's `migration new` command. All nine historical
migrations are unchanged. The historical chain still requires the documented
Application-table baseline; making it standalone belongs to RF-18, not RF-04.
`schema.sql` describes the fresh-install final constraints. Do not rerun the
fresh-install schema on an existing production database.

Requires PostgreSQL 17 or later (tested on 17.6), the existing tables, both
NOT NULL owners, the original named application FK, and sufficient table-owner
DDL privileges. The same-owner UNIQUE adds one B-tree index; existing indexes,
application ID uniqueness and lead uniqueness remain unchanged. Existing valid
rows are not updated. An unexpected constraint/index already present or missing
old FK causes transaction failure rather than being silently reconciled.

The migration uses an explicit transaction, `row_security=off` (fail instead of
silently preflighting only visible rows), `lock_timeout=5s` and
`statement_timeout=60s`. ACCESS EXCLUSIVE locks on Applications then Leads
serialize validation and DDL with both tables' writes. After locking, an
aggregate check rejects cross-owner or missing-parent links with no row IDs or
private data in its error. Adding the validated FK checks all existing links
again. There is no committed enforcement gap or automatic data repair.

Reads and writes on both tables can pause for index creation/validation and
until commit. Use a quiet maintenance window with coordinated ingestion and
conversion activity. The timeout bounds lock waits/per-statement execution,
not the whole transaction. For a large database or repeated contention, stop
and design a separately reviewed staged/index-concurrent rollout; do not simply
increase timeouts or retry continuously. Index size, production data quality
were not measured in Stage 1. Subsequent production metadata/preflight findings
are recorded below; maintenance-window sizing remains pending.

## Read-Only Production Preflight (Reported Complete; Refresh Before Release)

On 2026-10-11, ChatGPT reported an authorized live production preflight:
**0 cross-owner associations, 0 missing Applications, 0 duplicate links and
31 valid linked leads**. The original single-column FK remains and migration
`20261011042500` is not registered or applied. This record attributes data findings
to ChatGPT; this documentation task did not query/export production user rows.
The earlier "not executed" language described Stage 1 and is superseded here.

Independent catalog-only checks during this preparation confirmed broad
Applications/default table ACLs and RLS. See the
[privilege review](PRODUCTION_PRIVILEGE_REVIEW.md) for findings and separately
approval-gated SQL. Clean data does not close F01: enforcement is still missing
in production. Backup, restore rehearsal, migration and post-release verification
are **not completed**. Refresh the full preflight immediately before release;
an earlier clean snapshot does not certify future writes or all remaining gates.

An authorized operator must first independently verify the project is
`qotipygmwlovxklkexjb` / ApplyTrack and use approved private connection storage.
Do not use a browser publishable credential or put connection strings in a
terminal transcript. Run this only with separately approved production access
and a role able to see all rows. Export aggregate/catalog results only:

```sql
begin read only;
set local row_security = off;
select current_setting('server_version_num')::integer as server_version_num;
select
  count(*) filter (where a.id is null) as missing_application_count,
  count(*) filter (where a.id is not null and a.user_id is distinct from l.user_id) as cross_owner_count
from public.job_leads l
left join public.applications a on a.id = l.application_id
where l.application_id is not null;
select count(*) as required_not_null_owner_columns
from pg_attribute
where attrelid in ('public.applications'::regclass, 'public.job_leads'::regclass)
  and attname = 'user_id' and attnotnull and not attisdropped;
select conrelid::regclass as table_name, conname, convalidated,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('public.applications'::regclass, 'public.job_leads'::regclass)
  and contype in ('p', 'u', 'f')
order by table_name, conname;
select count(*) as duplicate_application_links
from (select application_id from public.job_leads where application_id is not null
      group by application_id having count(*) > 1) duplicates;
select relname, relrowsecurity from pg_class
where oid in ('public.applications'::regclass, 'public.job_leads'::regclass);
select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name in ('applications', 'job_leads')
  and grantee in ('anon', 'authenticated', 'service_role')
order by grantee, table_name, column_name, privilege_type;
select has_function_privilege('anon', 'public.complete_job_lead_application(bigint,date)', 'EXECUTE') as anon_rpc,
       has_function_privilege('authenticated', 'public.complete_job_lead_application(bigint,date)', 'EXECUTE') as authenticated_rpc;
commit;
```

Expected: PostgreSQL >=170000; zero invalid/duplicate links; two NOT NULL owner
columns; original single-column FK with ON DELETE SET NULL and unchanged
uniqueness; RLS on both tables; authenticated Lead UPDATE only for state and
application_id; anon RPC false, authenticated RPC true. Record policies, grants
and RPC definition/ACL privately for before/after comparison. Confirm the nine
historical migration versions and that RF-04 is absent in migration history.
Any unexpected history/schema/permission condition blocks application.

Stage 1 existing-data tests were synthetic; the subsequent production aggregate
assessment is reported above, not independently re-attested by this task.
If invalid links exist, preserve them and stop for an owner-aware, separately
approved decision: reviewed unlinking, correcting a demonstrably mistaken
association, or investigation without repair. Never delete a lead/application,
reassign ownership or bulk-null links automatically. Re-run preflight only
after that separately authorized work. The locked migration rechecks counts
so a clean earlier snapshot cannot permit a raced mismatch.

## One-Time Data Safety Gate (CAD $0)

No production export was performed. No backup platform or paid resource is
required. Before approval to migrate, designate an operator, verify available
free PostgreSQL 17 client tooling, and agree backup scope, encryption, retention
and a restore target. Credentials, encryption keys and export authorization must
be supplied privately by the user/operator, not obtained by this task.
Complete the [backup operator checklist](RF_04_BACKUP_OPERATOR_CHECKLIST.md),
including managed-schema dependencies, snapshot-aligned checks, encrypted work
storage and actual restore proof. These remain gates, not verified capabilities.

Use `pg_dump` custom format with an approved snapshot-capable connection and
explicit schemas `public`, `auth`, `storage`, `supabase_migrations`. Subject to
complete schema/data permissions and archive verification, this includes public
Application/Lead data and definitions, all Auth tables (including users,
identities and session/token data), Storage metadata and migration history.
It does not back up Storage object
bytes, global roles, secrets or external service configuration; capture required
non-secret role/grant configuration separately and keep other recovery material
operator-owned. Do not assume a default Supabase CLI dump covers Auth users.
Fail on missing schema permissions or export errors; do not accept partial dumps.

Procedure, requiring separate export authorization:

1. Use a private ACL-restricted, Git-ignored project-local `tmp/rf04-backup.local`
   directory on an encrypted volume. Confirm `git check-ignore` before any export.
   Plaintext dump work files are permitted only inside that encrypted storage;
   no transcript, public artifact, cloud upload or Git staging.
2. Configure PG service/password files privately, require TLS, verify the target,
   and use PostgreSQL 17 `pg_dump` with `--format=custom --no-owner --no-privileges`
   plus all four explicit schema switches. Check exit code. Separately preserve
   the exact table/RPC grants and policies for restore; those flags mean the
   archive alone is not a complete privilege restoration plan.
3. Inspect archive validity/object inventory with `pg_restore --list`; confirm
   both public tables, constraints, Auth users/identities, Storage metadata and
   migration-history table/data entries. Encrypt the archive with a free tool
   such as age to the operator's verified recipient, retaining the private
   decryption key outside Git and outside the backup directory. Record the
   encrypted-file SHA256, archive inventory and completion privately.
4. Decrypt only on protected encrypted storage and rehearse restore in an
   independent local container/compatible sandbox, never over production or
   another project. For real data, this restore needs explicit user approval,
   offline access controls and reviewed Auth/extension/role bootstrap. Verify
   constraints, row counts, owner-link aggregates, grants/policies and migration
   history; keep user-level output private. Synthetic migration tests are NOT
   proof of a production dump's recoverability.
5. After successful encryption and verification, remove only the known plaintext
   work files using verified literal paths. Retain the encrypted archive and key
   according to an agreed short retention period. If encrypted storage or a
   restore-verifiable backup is unavailable, stop the release.

## Approval-Gated Production Sequence (Historical; Completed)

These were pre-release instructions, retained for reference only; the completion record above supersedes their pending language:

1. ChatGPT reviews this PR, SQL evidence and runbook. Obtain separate user
   approval for refreshed production read-only preflight, export/restore rehearsal and the
   exact migration/version/target; agree a maintenance window and operator.
2. Confirm Supabase GitHub Integration **Deploy to production remains OFF** under
   [SEC-02's operational hold](SEC_02_RETIREMENT_RUNBOOK.md#g-production-retirement-completion-record-2026-10-11-utc).
   Isolate any active/queued backend writers; do not treat a skipped check alone
   as proof of an empty queue. Vercel Preview must remain disabled. Do not restore
   the recovery function, deploy ingestion or resume synchronization.
3. Capture read-only preflight and original metadata/security definitions. Verify
   the encrypted backup and approved restore evidence. Stop on mismatch or
   missing permissions. Pause relevant writes only under explicit approval.
4. Stage 1 is already merged; that is not production execution authorization.
   Obtain separate release approval and pin the reviewed migration's commit/hash.
   Do not run `schema.sql`, replay old migrations,
   `db reset`, generic deploy or unreviewed `db push` against production.
5. An authorized operator applies **only** the pinned RF-04 SQL through a reviewed
   migration mechanism, with ON_ERROR_STOP and transactional failure handling.
   For a private, target-verified PG service, the execution shape is:

   ```powershell
   psql "service=applytrack-approved-production" -X --set=ON_ERROR_STOP=1 --file=supabase/migrations/20261011042500_job_lead_ownership_integrity.sql
   ```

   The service name is a placeholder, not existing credentials. The file owns its
   transaction. Direct psql does not record Supabase migration history: the release
   operator must review and approve consistent history registration of version
   `20261011042500` in the same release process, or use a reviewed transactional
   migration runner that records it. A half-recorded release must stop; this
   choice is an explicit deployment gate, not permission for broad CLI sync.
6. Run post-migration read-only checks below; compare the recorded policies,
   column grants and RPC definition/ACL, row counts and aggregate integrity.
   Verify migration history registration. Do not reproduce an attack using real
   users or create production synthetic accounts without separate approval.
7. Only after review accepts the result may separately approved writes resume.
   Keep automatic backend synchronization OFF. Mark RF-04 Done only after
   successful production verification and ChatGPT acceptance.

## Post-Migration Verification (Completed; Reference Queries)

Re-run aggregate invalid-link, NOT NULL, RLS, privilege and RPC queries above.
The inventory should now contain `applications_user_id_id_key` on `(user_id,id)`
and `job_leads_application_owner_fkey`, with the old single-column FK absent.
The one-to-one `job_leads_application_id_key` remains. Inspect exact validated
FK settings, including the column list rather than merely its delete action:

```sql
select conname, convalidated, condeferrable, confmatchtype, confupdtype,
       confdeltype, confdelsetcols, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.job_leads'::regclass
  and conname = 'job_leads_application_owner_fkey';
```

Expected: one row; validated true, deferrable false, match `s`, update `a`, delete
`n`; `confdelsetcols` contains only the attnum of `application_id`; definition
ends with `ON DELETE SET NULL (application_id)`. Data counts must match the
approved quiet-window baseline and invalid aggregates remain zero. No business
state conversion, user-facing date or description is changed by migration.

## Rollback and Stop Conditions

- A failed transaction rolls back its DDL without touching rows. Keep old
  constraints and investigate the cause before an explicitly approved retry.
- After commit, prefer keeping the secure constraints and making a forward
  correction. No routine secure down-migration to the original single-column
  FK exists: dropping owner enforcement restores F01. Restoring a pre-migration
  backup also restores the vulnerable schema and can erase newer user changes.
- There is **no automatic rollback SQL** here. An exceptional weakening requires
  separate explicit security-risk acceptance, isolated writers, verified backup
  and reviewed compensating protections. A trigger alternative would itself need
  concurrency/parent-update review and is not pre-approved.
- Do not disable RI triggers, revoke unrelated grants, reassign records, bypass
  NOT NULL or alter RPCs to make a failed migration pass. Stop on invalid data,
  schema/history drift, lock/statement timeout, active writer uncertainty,
  incomplete backup, failed validation, unexpected row/grant/RPC changes or an
  unexpected Preview/deployment. Do not modify shared secrets/Auth/Edge resources.

## Stage 1 Verification and Remaining Limits

The real SQL gate uses cached Supabase Postgres `17.6.1.166`, `--network none`,
tmpfs storage, no host ports/mounts and synthetic users only. The runner removes
only its randomly named, labeled container. Fresh schema and nine historical
migrations plus RF-04 pass the same actual role/constraint tests. Separate
databases test failure on cross-owner links, orphan links and nullable-owner
drift; full rows/security snapshots verify no repair or partial DDL for mismatch
and nullable baselines. Two lock-synchronized parent/lead race orders and eight
concurrent conversions run on each successful path; a held row lock and catalog
barrier prove all eight RPC sessions overlap before release. Ownership catalog parity,
valid legacy preservation, idempotency, anonymous RPC denial, RLS and column
restrictions, service-role INSERT/UPDATE/UPSERT and deletion semantics are covered.

| Gate | Result |
| --- | --- |
| `npm test` | 34 passed |
| `npm run test:audit` | 18 passed |
| `npm run test:auth-ui` | 12 passed; 1440/768/390px |
| `npm run test:audit-ui -- --project chromium` | 22 passed |
| `npm run lint` / `npm run build` | Passed; local only |
| `npm audit --audit-level=high` | Exit 0; no High/Critical, 3 pre-existing Moderate findings |
| `npm run test:audit-db` | Passed; fresh/incremental security tests, 10 migration replays, 3 invalid-baseline rejections, 16 overlapping conversion calls and 4 owner-change races |
| `git diff --check` | Passed; repeat before publication |

No frontend/API/ingestion source, Auth/session behavior, production data, secrets,
historical migration or deployment setting is changed. F05's known stale-state
characterization and other unrelated BUG tests remain intentionally unchanged;
passing them is not a claim they are fixed. SQL tests do not run hosted Deno,
GoTrue/PostgREST/Storage HTTP, use production grants, or verify a production dump.
G02 is addressed at the SQL ownership boundary, not closed for full-stack
integration. Docker SQL/Firefox/WebKit remain local rather than new CI gates.
The production migration and its read-only verification are complete as recorded above. The user expressly accepted skipping a backup for this release; this is not a standing waiver for unrelated releases. CAD $0/month is preserved.

Publication observations: Vercel's branch-filtered deployment inventory returned
no deployments immediately after the implementation Push and after PR #12 was
created. This is a bounded observation, not independent inspection of the saved
Preview switch or a guarantee against delayed events. Automatic backend sync
remains under the existing operator-confirmed OFF hold; no setting was changed.
