# RF-04 Backup Feasibility and Operator Checklist

Date: 2026-10-11. **Preparation only: no production backup or restore performed.**
Companion to the [RF-04 release runbook](RF_04_OWNERSHIP_MIGRATION_RUNBOOK.md).
CAD $0 software is feasible; credentials, storage protection, permissions and an
actual successful restore are still release blockers, not assumed capabilities.

Stage 2 local assessment: [Backup Readiness Report](RF_04_BACKUP_READINESS_REPORT.md).
The proposed local directory is **NOT READY for real confidential data**:
volume encryption is unverified, inherited ACLs are too broad, complete sync/spill
coverage is unverified, and age/key custody is pending. Synthetic evidence does
not complete any production gate. The four-schema scope below remains unchanged;
the report's smaller release-specific alternative requires explicit approval.

Stage 3: [Local Security Remediation](RF_04_LOCAL_SECURITY_REMEDIATION.md) provides
the synthetic-only ACL test and exact remaining approvals. Its outside-repo
location and narrower scope are proposals, not approved replacements for the
paths/four-schema commands below. Do not export until the chosen path's actual
encryption/ACL/sync protection, age custody and managed restore gates are met.

## Scope and Consistency

One PostgreSQL 17 custom-format `pg_dump` with four explicit schemas is a
consistent database snapshot for public application data, **all tables** in
Auth (not only users/identities), Storage metadata and Supabase migration history.
Inventory must include table DATA entries, sequence values, definitions,
constraints and RLS policies. Auth password hashes, identities, sessions and
tokens are sensitive backup contents; never print records or attach archives.
Do not enable `--enable-row-security` or use the browser publishable key.
[PostgreSQL pg_dump documentation](https://www.postgresql.org/docs/17/app-pgdump.html).

Schema selection does not automatically include dependencies in other schemas,
extensions, global roles, deployment configuration, secrets or Storage bytes.
Check dependencies (including extensions/auth helper functions) and bootstrap a
compatible isolated target; do not claim four-schema coverage is a full hosted
Supabase disaster-recovery backup. If object bytes are required, a separate
explicitly authorized Storage backup is needed; no extra export is authorized.
[Supabase backup exclusions](https://supabase.com/docs/guides/platform/backups).

Use **one** dump, not four independently timed exports. Counts measured later
on a busy database need not match its snapshot. Agree an approved write-quiescent
window encompassing dump and verification, or use an operator-reviewed exported
snapshot shared by pg_dump and aggregate checks. An exported snapshot requires
its transaction/connection to remain open; use direct or session-mode connectivity,
not transaction pooling. Never pause production writers under this task.
Sequence values are not MVCC row snapshots; an exported snapshot does not freeze
`nextval`. Require a quiet window for exact sequence-state comparison.
Schema DDL during dump can fail or interfere with locks; avoid the RF-04 migration
until the dump completes. A pre-change dump restores pre-change ownership/F01.

## Checklist (All Pending Unless Explicitly Recorded)

- [ ] Obtain separate authorization for production export and for restoration of
  real user data locally; name operator, target project and retention period.
- [ ] Supply database credentials and age recipient privately; do not obtain
  them automatically. Verify PostgreSQL 17 clients, verified age binary and
  private recipient/key custody using a synthetic encryption/decryption roundtrip.
- [ ] Verify free direct IPv6 or session pooler access with TLS hostname/CA
  verification. Do not buy an IPv4 add-on. Use private PG service/password files
  with restrictive Windows ACLs, outside Git, not connection URIs in shell history.
- [ ] Catalog-check four schemas and expected tables/extension dependencies.
  Check export-role access to ALL their rows, bypass/ownership as necessary and
  schema USAGE. Default pg_dump fails on RLS filtering; a successful partial
  schema/data selection is not proof of complete coverage.
- [ ] Confirm protected encrypted local storage already available at CAD $0,
  sufficient space and ACLs; `git check-ignore tmp/rf04-backup.local` must pass.
  Check system temp/spill locations and sync/backup clients. If no encryption at
  rest exists, stop or separately review a streaming encrypted export. Compression
  and an encrypted archive do not protect prior plaintext/temp files.
- [ ] Capture non-secret ownership/role membership/extension versions, exact
  grants/default ACLs, policies, trigger/RPC definitions and migration versions
  privately. Dump flags below omit ACLs/ownership restoration; the separate
  manifest is mandatory. Do not export role passwords through pg_dumpall.
  In custom format, pg_dump's `--no-owner` is not an ownership scrub: restore
  behavior is controlled by pg_restore's `--no-owner` and the reviewed owner map.
- [ ] Agree snapshot verification and write coordination; avoid DDL. Obtain
  approval for any maintenance pause; capture aggregate counts at the same
  snapshot/window, not user records.
- [ ] Execute the approved export once, check exit code and all stderr warnings;
  never accept permission-denied/partial results or silently exclude Auth tables.

Example **after authorization only**, inside encrypted, ACL-restricted storage:

```powershell
pg_dump --dbname="service=applytrack-approved-production" --format=custom --no-owner --no-privileges --schema=public --schema=auth --schema=storage --schema=supabase_migrations --file="C:\Work\SideProject\ApplyTrack\tmp\rf04-backup.local\pre-rf04.dump"
pg_restore --list "C:\Work\SideProject\ApplyTrack\tmp\rf04-backup.local\pre-rf04.dump"
age --recipient <verified-operator-recipient> --output "C:\Work\SideProject\ApplyTrack\tmp\rf04-backup.local\pre-rf04.dump.age" "C:\Work\SideProject\ApplyTrack\tmp\rf04-backup.local\pre-rf04.dump"
Get-FileHash -Algorithm SHA256 -LiteralPath "C:\Work\SideProject\ApplyTrack\tmp\rf04-backup.local\pre-rf04.dump.age"
```

These placeholders are not credentials or executable automation; PowerShell
operators must substitute the recipient safely, check `$LASTEXITCODE` after each
native command and stop on failure. Never pipe binary pg_dump output through
Windows PowerShell text redirection. `--file` avoids encoding corruption.

## Verification and Restore Rehearsal Gate

- [ ] Confirm archive list covers `public.applications`, `public.job_leads`, ALL
  inventoried Auth tables including users/identities/session/token tables, Storage
  buckets/objects and ALL migration-history tables, each with TABLE DATA where
  applicable. Compare source inventory to archive, not a fixed short table list.
- [ ] Decrypt with the operator-owned key only into protected encrypted storage.
  Compare decrypted bytes/hash to the original privately. SHA256 detects changes,
  but alone does not prove decryption, complete data or restorability.
- [ ] Prepare a NEW isolated no-network/no-port PostgreSQL 17 target with verified
  compatible roles/extensions. Do not restore over production, another project's
  container or the default Supabase database. A blank database plus reviewed
  bootstrap can avoid conflicting preinstalled Auth/Storage objects; a running
  Supabase sandbox requires a reviewed object/data-only restore strategy.
- [ ] Rehearse full archive with `pg_restore --exit-on-error --single-transaction
  --no-owner --no-privileges` into the named empty target. Establish original
  owner/grantor mapping and replay the separately captured ACL/default/policy
  manifest under reviewed authority. No ignoring managed-schema ownership errors,
  disabling triggers or accepting a partly restored Auth schema.
- [ ] Include schema owners and exact USAGE/CREATE grants/grantors in that
  manifest. A blank-target restore can differ from the source database template's
  baseline schema ACLs even after archive ACL replay. Reconcile only against the
  approved manifest; compare normalized effective privileges (including PUBLIC,
  grant options and defaults), not raw ACL array order or NULL representation.
- [ ] Verify schema/constraint/trigger/RPC/policy/ACL inventory and migration
  versions; compare same-snapshot counts for EVERY included table and private
  per-table content digests, plus sequence states and RF-04 aggregate integrity.
  Counts alone cannot detect changed data. Digests and hashes remain private.
- [ ] Test synthetic rehearsal first. An approved real-data SQL restore validates
  database recovery, not hosted GoTrue sign-in, token validity, Storage bytes or
  Edge configuration. Do not send email or test real credentials/tokens. Keep
  Auth services offline; actual production restore would require a NEW plan.
- [ ] Record only pass/fail, sanitized scope and encrypted archive hash reference.
  Remove known plaintext using verified literal paths after successful encrypted
  verification; retain archive and key separately per policy. Secure erasure on
  SSD is not guaranteed by deletion; encryption at rest is the primary protection.
- [ ] Reviewer accepts evidence and separately authorizes RF-04 migration and
  history registration. No backup, rehearsal, permissions or migration is executed
  by merging these documents.

Remaining blockers: operator credentials/authority; verified encrypted storage
and age key; exact managed-schema/dependency inventory; approved snapshot/window;
successful actual dump/decrypt/restore/ACL verification; history-registration
mechanism and maintenance approval. No Pro, paid backup/domain or cloud upload
is required or provisioned.

Reference: [PostgreSQL pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html),
[age encryption tool](https://github.com/FiloSottile/age).
