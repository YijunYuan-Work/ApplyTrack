# RF-04 Stage 2: Local Backup and Restore Readiness

Date: 2026-10-11 (America/Toronto). Baseline: `origin/main` at
`a723bd5112983da61779d7277a74960b3cf06997`; branch
`ops/rf-04-backup-readiness`.

**Verdict: real production backup procedure NOT READY.** Local synthetic results
do not waive storage, tool/key-custody, managed-schema or authorization gates.
RF-04 remains **In Progress**; F01 remains unresolved in production according to
the existing release record. This task did not refresh production metadata/data.

Authority: [master plan](REFINEMENT_MASTER_PLAN.md),
[operator checklist](RF_04_BACKUP_OPERATOR_CHECKLIST.md),
[release runbook](RF_04_OWNERSHIP_MIGRATION_RUNBOOK.md), and
[privilege proposal](PRODUCTION_PRIVILEGE_REVIEW.md). No production export,
connection, privilege change, migration or release is authorized by this report.

## Tools Actually Inspected

| Check | Status | Evidence / limitation |
| --- | --- | --- |
| Docker Desktop | PASS | Installed version 4.94.0.241994; no installation/update performed |
| Docker CLI / running engine | PASS | Both 29.8.2 |
| Cached PostgreSQL image | PASS | `public.ecr.aws/supabase/postgres:17.6.1.166`; reused without pull |
| Isolated PostgreSQL server and clients | PASS | Server, `psql`, `pg_dump`, `pg_restore`: 17.6 |
| Host PostgreSQL tools on PATH | FAIL | `psql`, `pg_dump`, `pg_restore` unavailable; container alternative tested |
| PowerShell / Git | PASS | 7.6.5 / 2.47.1.windows.1 |
| Node authenticated encryption | PASS | Node v24.16.0, OpenSSL 3.5.6; AES-256-GCM available and exercised |
| Selected production tool: age | FAIL | Not on PATH; age binary/recipient/private-key custody not tested |
| Current production/client compatibility | NOT VERIFIED | No production connection permitted; cached 17.6 is a local fixture, not a current server attestation |

No packages, binaries or images were installed/downloaded. AES-GCM used a fresh
in-memory test key, not an existing secret; it is a synthetic exercise, **not**
approval of a custom production encryption format or a durable key-management
solution. No permanent backup credentials/key files were created. The age-based
operator procedure still requires its own reviewed tool and roundtrip.

## Storage Assessment

Target: `C:\Work\SideProject\ApplyTrack\tmp\rf04-backup.local`.
Only fabricated fixtures/archives were placed there.

| Check | Status | Evidence / limitation |
| --- | --- | --- |
| Git exclusion | PASS | Dump, key and log probes under the target are ignored; temporary harness/evidence remain untracked and ignored |
| Volume encryption | NOT VERIFIED | Status-only BitLocker queries could not establish encryption/protection; `manage-bde -status` was access-denied. No keys queried or settings changed |
| Directory ACL confidentiality | FAIL | Inherited broad-group allow entries, including write access; not a private backup directory. ACLs left unchanged |
| Free space for synthetic test | PASS | More than 100 GiB available; production archive/restore/spill sizing not measured |
| Known OneDrive ancestor / inspected parent reparse points | PASS | No match found; this narrow check does not exclude other synchronization agents |
| Complete sync/backup and plaintext-spill coverage | NOT VERIFIED | Arbitrary backup agents, Docker backing disk, paging/temp locations and real-export spill coverage not established |
| Real confidential-data storage | FAIL | NOT READY until encryption, restrictive ACLs and exclusion from unintended copying/spill are verified |

Git ignore and ACLs are not encryption. Encrypting a final archive does not
protect earlier plaintext or guarantee secure SSD deletion. No Windows security
configuration, privileges or synchronization settings were changed.

## Synthetic Rehearsal

Result: **PASS: 42 checks in the final corrected run**. Detailed logs/fixtures live only
under the ignored target; no archives, SQL fixtures, credentials or keys are
committed. The local-only harness can be rerun from the exact project root with
`node tmp/rf04-backup.local/rehearsal.mjs` while those ignored files remain; this
documentation PR does not distribute a production backup utility.

Two newly created, uniquely named/labeled containers used the cached image,
`--network none`, no host ports or bind mounts, and tmpfs PostgreSQL data. Binary
archives used their disposable container layer and the ignored synthetic-only
host directory. Docker binary copy avoided PowerShell text conversion. No
existing project's database, user IDs, credentials or real Auth records were
used. A separate empty target database was created from `template0`.

The fixture used the repository application schema with the original RF-04 FK
baseline restored, plus deliberately minimal Auth/Storage/history stand-ins:
16 tables and eight sequences across four schemas. Nonempty examples included
two Applications, three Leads, two fabricated users, one identity, one session,
one refresh-token placeholder, Storage bucket/object metadata, nine synthetic
migration-history rows and one seed-history row. History entries represent
archive handling, **not** a replay or attestation of production history.

| Verification | Status / result |
| --- | --- |
| Custom dump / archive inventory | PASS: TABLE DATA for all 16 fixture tables, SEQUENCE SET for all eight sequences, FK/RLS definitions and `PGDMP` magic |
| Snapshot consistency | PASS: exported repeatable-read snapshot held open; concurrent writer changed live rows across four schemas; restored counts/content digests matched the held snapshot |
| Encryption / decryption | PASS: AES-256-GCM byte-identical roundtrip; modified ciphertext and wrong ephemeral key rejected |
| Bad archive handling | PASS: truncated archive returned exit 1; all six normal dump/restore/list commands returned exit 0 with empty stderr |
| Separate target restore | PASS: `--exit-on-error --single-transaction --no-owner --no-privileges`; no partial result accepted |
| Rows / sequences | PASS: every table's count/digest and every sequence's `last_value`/`is_called` matched; no sequence writer during comparison |
| Security/schema manifest replay | PASS: schema/table/sequence/function owners, effective schema ACLs, table/column grants, default ACLs, RLS, triggers/functions and FK definitions matched after explicit replay |
| Exact RF-04 migration | PASS: unchanged repository SQL applied; rows/sequences unchanged; authenticated cross-owner FK rejection, owner RLS and owner/state-preserving delete/unlink passed; probes rolled back |
| History registration | PASS: direct `psql` application left history unchanged, as expected; production registration remains separately gated |
| Cleanup / other Docker resources | PASS: task container IDs/labels verified before removal; pre-existing container IDs unchanged after every attempt; all 20 generated archive files removed using verified literal paths |

Early attempts exposed local harness defects (sequence serialization, SQL type
casts, schema-qualified names, copying from tmpfs and a cross-owner probe blocked
first by the existing UNIQUE constraint). Those fixtures were corrected; no app,
migration or production code was changed. Schema ACL comparison also uncovered
missing baseline PUBLIC schema USAGE after a blank-target restore. Explicit
captured schema grants must be replayed and normalized effective privileges
compared, not raw ACL array order or NULL/default representation.

Final local evidence: `tmp/rf04-backup.local/synthetic-922a4fa3b3b6/evidence.json`.
Its cached-image SHA256 is
`b3bfedb107413abb3b8cb0d0874b0414a1dceb3d55bc0c778de6ad22d1f7dc86`;
unchanged RF-04 SQL SHA256 is
`d5c941757f0dfd57dff85069babcbab2e0e3e532d8a270a5d19ce71c0c07bf08`.
Only synthetic fixtures, the local-only harness and diagnostic metadata/logs are
retained under Git ignore. Archives and disposable containers are gone; the
ephemeral key was zeroed in memory and never persisted. This is not a secure
erasure attestation and provides no retained real backup.

These representative objects do **not** reproduce Supabase's complete managed
Auth/Storage schemas, extension graph or role topology. SQL restoration does not
prove hosted login, session/token validity, Storage bytes or Edge configuration.
Actual managed-schema restore and real-data decryption/restore: **NOT VERIFIED**.
Hosted Auth/Storage/email tests and production writes in this stage:
**NOT APPLICABLE** (prohibited).

## Backup Scope Review

The checklist's explicit four-schema scope remains unchanged. A single custom
dump covers selected row data and definitions; outside-schema dependencies,
global roles, secrets, service configuration and Storage object bytes require
separate planning. `--no-privileges` omits grants/default ACL restoration; custom
format `--no-owner` is controlled at restore time, not a guaranteed owner scrub.
[PostgreSQL dump](https://www.postgresql.org/docs/17/app-pgdump.html) and
[restore](https://www.postgresql.org/docs/17/app-pgrestore.html).

| Option | Coverage / exposure | Recovery limits and operational effort |
| --- | --- | --- |
| Existing `public/auth/storage/supabase_migrations` dump plus security manifest | Broad SQL recovery coverage; includes password hashes, identities, sessions/tokens as well as private app data | Requires verified managed roles/extensions/bootstrap, encrypted storage and full offline SQL rehearsal; still not complete hosted disaster recovery |
| Proposed `public` plus `supabase_migrations` dump, dependency inventory and exact schema/security manifest | Release-specific app/history recovery; less Auth/session exposure; still sensitive, including forwarded-alert content | Does not recover Auth records or Storage metadata/bytes; retained Auth parent IDs and cross-schema dependencies remain prerequisites; requires approved dependency handling and rehearsal |

**Recommendation for review only:** for this additive ownership constraint/index
migration, prefer the second release-specific option if the operator explicitly
accepts that limited recovery objective and approves revised scope. Including all
public tables avoids silently omitting public FK dependencies in a two-table-only
export. Preserve history and exact owners, grants/grantors, column/schema/default
ACLs, role attributes/membership, extension versions, RLS, triggers and RPCs
separately in the protected package. Do not export global role passwords.

No reduced export is approved by this report. If broader Auth/Storage SQL
recovery is required, retain the existing four-schema plan and resolve its
managed-schema rehearsal blockers. Synthetic Auth parent stubs are test fixtures,
not a permissible real-data restore strategy. Neither option is ready today;
both use free existing tools/local storage and add no paid monthly service.

Use one consistent dump and same-snapshot verification, or an approved quiet
window. Keep an exported snapshot's connection open; use approved direct/session
connectivity, not transaction pooling. Sequence values and DDL/security changes
are not frozen by a row snapshot, so freeze those writers separately by approval.
[PostgreSQL snapshot synchronization](https://www.postgresql.org/docs/17/functions-admin.html#FUNCTIONS-SNAPSHOT-SYNCHRONIZATION).

Prefer transaction rollback on migration failure and forward correction after
success; do not routinely restore an older database or weaken ownership checks.
A pre-change restore reinstates F01 and may discard newer user activity. Any
production restore/weakening requires a new reviewed plan and explicit approval.

## Next Authorization Gates

1. Operator supplies status-only verification of encrypted/protected storage;
   separately approve a private ACL-restricted directory or necessary Windows
   security changes. Confirm temp/spill/Docker/paging and sync coverage and sizing.
2. Approve acquisition of a verified encryption tool if needed, private key
   custody/recovery and synthetic roundtrip. No automatic install, image pull,
   production credentials retrieval or private-key inspection is authorized.
3. Reviewer/operator choose the recovery objective and explicitly approve any
   scope change. Inventory required managed dependencies and approve an isolated
   restore bootstrap before exporting; preserve exact security manifests.
4. Separately authorize named operator/project production connection/export,
   retention, TLS/private credential delivery and quiet window/shared snapshot.
   This task never accessed connection strings or existing secret files.
5. Separately authorize restoration of real data into a protected offline target;
   verify every included table, sequence and security object. Keep hosted Auth
   and email services offline; stop on warning, missing object or mismatch.
6. Only after accepted backup/restore proof and refreshed release preflight,
   obtain separate RF-04 migration/history-registration approval. Do not combine
   the privilege proposal or enable GitHub production synchronization.

## Repository Validation and Safety Record

- PASS: `npm test` (34), `npm run test:audit` (18), `npm run lint`, `npm run build`.
- PASS: `npm run test:audit-db`: fresh/incremental parity, nine historical
  migrations plus RF-04, three invalid-baseline rejections, 16 overlapping
  conversion calls and four owner-change races. Its disposable container was removed.
- Existing BUG characterization tests remain unchanged; passing is not a fix claim.
- PASS: `git diff --check`; publication is restricted to this report and checklist.
- UI/browser regression testing: NOT APPLICABLE to these documentation-only edits.
- No production PostgreSQL connection, data access/export/restore, migration,
  permission/Auth/Edge/secret/integration change or paid resource operation.
- Existing production integration OFF hold retained; no toggle or deployment.
  Branch-filtered Vercel inventory before publication returned zero deployments;
  this does not independently verify the saved switch or rule out delayed events.
