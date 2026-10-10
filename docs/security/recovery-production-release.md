# PR #6 Production Release Runbook

**Status: preparation only; NO-GO for production execution until the gates below close.**
No production migration, deployment, configuration update, recovery email, or
restore was performed during preparation. This document is not authorization.
All SQL in `verify-recovery-release.sql` is catalog-only, inside `BEGIN READ ONLY`
and `ROLLBACK`; it does not invoke the quota or lookup RPC.

## Release Identity

| Item | Pinned value |
| --- | --- |
| Repository/workspace | `YijunYuan-Work/ApplyTrack`; `C:\Work\SideProject\ApplyTrack` |
| Branch / PR | `security/recovery-hardening` / [PR #6](https://github.com/YijunYuan-Work/ApplyTrack/pull/6) |
| Application code reviewed | `0b688fed0c6d7124dd79a0fec509269639e5ec3f` (before this preparation commit) |
| Production project | `qotipygmwlovxklkexjb`, ApplyTrack, us-west-2 |
| Old production source / main baseline | `3216007b7b952a980099355ae25f46a55ab1d294` |
| Only new migration | `20261009201500_password_recovery_safety.sql` |
| Migration Git content SHA-256 (LF) | `33bde9c6c86e13c02d35b72284b1a0da4f0a59c9f74ad11399ae4fdf493b83d2` |
| Migration Windows checkout SHA-256 (CRLF) | `a5f4fe693cd2c058ec133bed83dba4f96f994358d73e7db610bddcd9d0f97c6d` |
| Old Edge version / JWT verification | `request-password-reset` v39 / disabled |
| Old unbundled `index.ts` SHA-256 | `63b7f1fc1df6bf7290ec3c3707700eb81f1153292c9d9ef051c56f924083e110` |
| Old deployed bundle SHA-256 | `46398f223482754999e1aef1f2a749d4a95267ee88500e665b6d2328aa82933c` |

Source-file and deployed-bundle hashes are different measurements, not interchangeable.
Git content and Windows checkout hashes also differ because of line-ending
conversion; require the corresponding approved hash, never silently normalize
other content changes to make a mismatch pass.
The public canonical website is the **Live application** link in `README.md`.
At release time the approver must record the final PR HEAD SHA, CI run IDs,
operator, UTC window, approvals, and artifact hashes in a restricted release
record. Recheck all facts immediately before execution. Never release a moving
branch or assume the code SHA above includes later commits.

## Preflight Findings

Read-only production inspection: **2026-10-10 UTC / 2026-10-09 Toronto**.

| Check | Actually verified | Consequence |
| --- | --- | --- |
| Checkout / PR | Clean target branch; local, remote and PR HEAD `0b688fe`; PR open/mergeable | Preserve user work; no main edits or merge |
| CI at that HEAD | Unit/quality, Docker integration and high/critical dependency gate successful | Not proof of production configuration or backup |
| Database | PostgreSQL 17.6; project ACTIVE_HEALTHY | Previous local integration uses 17.11, not exact 17.6 |
| Migration history | Nine versions match repository filenames; statement arrays present | Only the recovery migration is pending; historical SQL byte equivalence not established |
| New objects | Throttle table and both recovery RPCs absent | Current v39 must remain until migration passes |
| Public tables | All seven existing public tables have RLS | Applications SELECT/INSERT/UPDATE/DELETE remain `auth.uid() = user_id` |
| Service role | Public schema USAGE and BYPASSRLS present | Actual Edge credential usability still requires approved smoke test |
| Auth inventory | 3 users, 3 identities, 1 nonempty recovery contact, 0 duplicate normalized contacts | Counts only; no account identifiers or contacts retrieved |
| Backup scope | One Storage object; no custom Auth triggers, Vault secret rows, cron jobs, or extra user schemas found | Database backup alone does not protect that Storage binary |
| Organization | Free plan | No paid daily-backup/PITR entitlement may be assumed |
| Function | v39 active, JWT verification disabled; sole source file equals pinned main byte-for-byte | Local recoverable source and manifest prepared |
| Edge Secret metadata | Required names present; APP_URL and SUPABASE_URL digests match canonical site/project | Names/digests do not establish valid Resend key/sender |
| Edge redirect allowlist | Digest matches the documented mixed development/production example, including loopback HTTP origins | **Release blocker: remove development origins after separate configuration approval** |
| Auth URL settings / Data API configuration | Not verified through available connector; dashboard requires sign-in | Operator must inspect Site URL, redirect list and exposed `public` schema |
| Resend sender/domain | Not verified; no real emails sent | Operator must confirm verified domain, authorized sender and key scope |
| Available backup timestamps | Not verified; no archive created/downloaded | Fresh backup and restore drill remain mandatory |
| Security advisors | Existing `pg_net` in public and disabled leaked-password protection warnings | Separate owner-reviewed security follow-up, not silently changed in this release |

The attempt to reuse the CLI credential through Windows Credential Manager was
blocked by the execution policy; that probe was not executed and was removed.
No workaround, credential extraction, Secret reveal or production configuration
change was performed. Remaining management checks can use the explicitly
owner-supplied, process-only token described below, or the signed-in dashboard.

Historical versions, in order:

```text
20260722050558  20260722052947  20260722053109
20260722185453  20260722220608  20260723023917
20260723034601  20260723043551  20260723045043
```

## Safe Read-Only Verification Tools

1. Select production `qotipygmwlovxklkexjb` explicitly in the SQL editor or MCP.
   Execute the complete `docs/security/verify-recovery-release.sql`. Before
   migration, `all_passed=false` is expected. After migration, **all 17 checks
   must be true**. It emits no recovery contacts, identities, tokens or quota rows.
2. An owner may provide a narrowly scoped **read-only** Management API token
   through the process environment, without putting it in a file or shell history:

   ```powershell
   npm run check:release:recovery
   ```

   The tool requires `SUPABASE_ACCESS_TOKEN` already present. It uses only GET
   on this fixed project's secrets metadata, Auth config, backup inventory,
   PostgREST config and function metadata. It never reads keyrings/files, prints
   Secret values/digests, follows redirects, or writes production. HTTP success
   is not a go/no-go decision: inspect every returned boolean; `null` or
   `unavailable` means **unverified**, not safe. No token was supplied in this task.
3. For existing CLI Secret names only, the metadata read command is:

   ```powershell
   npx --yes supabase@2.120.0 secrets list --project-ref qotipygmwlovxklkexjb --output json |
     ConvertFrom-Json | Select-Object -ExpandProperty name
   ```

Do not print raw management responses, run CLI `--debug`, or use `db push`
as a read-only preflight. The pinned CLI's remote target resolver can mint a
temporary database role even when migration execution is dry-run. This task did
**not** run a production migration dry-run. Inspect catalog/history with a
read-only connection instead. Never use a management SQL endpoint to call
`consume_password_reset_quota` during preparation; it writes counters.

## Backup Strategy and Backup Verification

### Coverage Contract

A release backup is incomplete unless it covers:

| Artifact | Required coverage |
| --- | --- |
| Database schema + data | All public tables, sequences, functions, triggers, RLS, ACLs and defaults; complete `auth` schema and data (users, password hashes, identities, sessions, refresh tokens, MFA/flow/OTP tables as present); `storage` metadata; `supabase_migrations` history |
| Role/extension inventory | Role memberships/ACLs without role passwords; installed extension versions and required compatible roles/bootstrap |
| Storage binary copy | Every existing object, including the one currently present; private manifest, byte counts and checksums, not just `storage.objects` rows |
| Non-database configuration | Auth URLs/providers/TTL, API exposure, JWT/signing/encryption key custody, Edge settings and Resend sender configuration, stored in the owner's secret manager, not Git |
| Recovery rollback | Reviewed v39 source, JWT setting, original bundle metadata and hashes; retained independently of a future moving main |

The default `supabase db dump` is **schema-only**, not a full backup. Its schema
filter excludes managed schemas. CLI data-only mode has different filtering and
excludes platform migration tables. Never infer Auth coverage from a successful
default dump or a file size. [CLI reference](https://supabase.com/docs/reference/cli/supabase-db-dump)
and [pinned data dump implementation](https://github.com/supabase/cli/blob/v2.120.0/apps/cli-go/pkg/migration/scripts/dump_data.sh).

Paid managed backups/PITR are a possible additional safety net, not verified
protection for this Free project. An operator must check available completed
restore points, their age, retention and ability to restore. Database backups
exclude Storage binaries; physical backups are not necessarily downloadable.
[Supabase backup documentation](https://supabase.com/docs/guides/platform/backups).

### Required Export Procedure (Not Executed)

Use a PostgreSQL **17** client, TLS with certificate verification, and the
existing owner-approved direct or **session** pooler connection (not transaction
pooling). Do not reset a production password to obtain backup access. Supply
connection details using process-only PG environment settings or an ACL-restricted
temporary `PGSERVICEFILE`/`PGPASSFILE` outside tracked paths. Do not place passwords
or a database URL on a command line, in a transcript, or in this document.

The owner must first approve sensitive-data handling, provide encryption/key
custody, and authorize the protected staging location. Keep all temporary work
under `.temp/release-prep/` inside the sole project root. Use an encrypted local
volume/private ACL, no inherited broad read permissions, no editor indexing,
cloud sync or terminal transcription. `.gitignore` alone is NOT encryption.
Do not start an export without these safeguards.

Under those conditions, the explicit logical snapshot command template is:

```powershell
# PGHOST/PGPORT/PGUSER/PGDATABASE/PGSSLMODE and protected credentials
# are supplied by the owner. BackupStage is inside the approved encrypted staging area.
pg_dump --version
# BackupStage must already exist on the approved encrypted/private staging volume.
$Repo = 'C:\Work\SideProject\ApplyTrack'
$Stage = (Get-Item -LiteralPath $BackupStage).FullName
if (-not $Stage.StartsWith("$Repo\.temp\release-prep\", [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Refusing an unapproved backup staging path.'
}
pg_dump --format=custom --schema=public --schema=auth --schema=storage `
  --schema=supabase_migrations --no-password --file="$BackupStage/database.dump"
if ($LASTEXITCODE -ne 0) { throw 'Backup failed; do not release.' }
pg_dumpall --roles-only --no-role-passwords --no-password --file="$BackupStage/roles.sql"
if ($LASTEXITCODE -ne 0) { throw 'Role backup failed; do not release.' }
```

These native commands avoid the CLI's implicit schema/data exclusions and
credential-minting remote resolver. They take a consistent database snapshot
without DDL/DML (normal pg_dump read locks may briefly conflict with DDL).
The selected scope matches today's inventory; if extra user schemas, Vault
secrets, jobs or encrypted columns appear, **stop and expand coverage/key custody**.
Schema-selective pg_dump does not automatically include external dependencies;
compatible Supabase roles and extension/bootstrap dependencies are mandatory.
Raw archives are NOT blindly portable into an already populated managed project.
[PostgreSQL pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html).

Use the approved encryption tool/key policy to encrypt the archive, roles,
private inventory and Storage copy as a single release artifact set. Test
decryption privately, hash the **encrypted** deliverables, and retain an off-site
copy in owner-controlled protected storage plus a separate recoverable key.
Do not pipe binary archives through Windows PowerShell text redirection. Remove
only this task's staging plaintext after encryption is verified, following the
owner's retention policy. Never remove unrelated files or Docker volumes.

### Verification and Restore Drill (Still Required)

1. Record UTC snapshot time, client/server/extension versions and each covered
   table's row count in the encrypted private manifest. User/identity counts may
   change before release; remeasure, do not hard-code today's 3/3. No user rows,
   addresses, password hashes or tokens in logs/reports.
2. Decrypt privately and run `pg_restore --list` to a protected TOC file, not a
   public transcript. Verify both schema AND TABLE DATA entries for every public
   table, `auth.users`, `auth.identities`, all other existing Auth tables, Storage
   metadata and migration history. Verify sequence/ACL/policy/function entries.
3. Restore into a **new, empty, isolated local database** inside the project,
   with compatible Supabase PostgreSQL 17 roles/extensions/Auth schema versions.
   Pin production-compatible 17.6 for the exact-version drill where available;
   testing only on 17.11 is not an exact-version restore proof. Use a new
   namespace, loopback-only free ports, ownership checks and retained local volumes.
   Do not reset the ordinary development database or touch other containers.
4. Deny external egress and real SMTP/webhook delivery before restoration;
   disable automatic schedulers and keep Auth/Edge workers stopped during data
   load. Supabase baseline setup and restore are **local writes only**. Resolve
   role/extension dependencies in that disposable target. Then use:

   ```powershell
   # Owner has verified every PG target variable points to the disposable local DB.
   if ($env:PGHOST -ne '127.0.0.1') { throw 'Restore drill requires loopback, never production.' }
   # Also verify PGPORT/database against the new drill namespace, not another project.
   pg_restore --exit-on-error --single-transaction --no-owner `
     --dbname="$env:PGDATABASE" "$BackupStage/database.dump"
   if ($LASTEXITCODE -ne 0) { throw 'Restore drill failed; do not release.' }
   ```

   Restore reviewed role memberships and explicitly verify original object
   owners/ACLs; `--no-owner` is only for the disposable drill, not permission
   equivalence. Never suppress errors, skip Auth/identities, or omit constraints
   to make the drill pass. A target with pre-existing managed Auth/Storage tables
   requires a separately reviewed restore plan, not `--clean` against production.
5. Compare all private manifest counts, sequence values, user-to-identity and
   application-owner FK consistency; verify password hashes/recovery metadata
   preserved **inside the private target**, without printing them. Verify RLS,
   policies, RPC/ACLs and Storage object integrity. Apply PR #6 there and run the
   17 catalog checks. Use newly generated synthetic local accounts for token,
   password/login tests with captured mail; do not send to restored real contacts.
6. Record successful restore time and actual RPO/RTO in the restricted release
   record; both are currently **unknown**. A checksum/TOC inspection alone is
   not a restore drill. Close this backup gate only after the actual drill succeeds.
7. During the approved release window, stop application writes/signups and alert
   ingestion through separately approved maintenance controls, or obtain an
   explicit acceptable-loss-window decision. Capture a fresh final snapshot
   and matching Storage inventory before DDL, then repeat integrity/coverage
   checks. Earlier rehearsal alone does not cover later writes.

The official Supabase logical-restore procedure is an alternative, with separate
roles/schema/data/history and custom Auth/Storage handling. It also documents
encryption-key requirements. Use it only with the same explicit Auth/identity
coverage and successful isolated rehearsal; do not improvise production restores.
[Supabase restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

## Edge Function Verification and Configuration

| Requirement | Required release state | Current evidence |
| --- | --- | --- |
| APP_URL | Canonical approved HTTPS origin; no credentials/preview/loopback | Exact canonical-origin digest matches |
| ALLOWED_REDIRECT_ORIGINS | Exact production origin only, no wildcard/path/trailing slash/localhost/preview | **Current mixed list fails this gate** |
| Auth Site URL | Same canonical production site | Owner confirmation pending |
| Auth Redirect URLs | Explicit canonical `/?recovery=1` route, plus only justified production routes; no broad preview wildcards or loopback | Owner confirmation pending |
| Data API | Enabled, `public` exposed; new service-role RPCs reachable after cache refresh | Owner/read-only API confirmation pending |
| SUPABASE_URL | Exactly this project; not a sandbox or another project | Digest matches target |
| Server credential | Valid service role, or valid secret-key fallback; never browser publishable/anon credential | Both credential names present, runtime validity untested |
| RESEND_API_KEY | Valid send permission for the sender domain | Name present only |
| PASSWORD_RESET_FROM_EMAIL | Sender on verified sending domain; authorized address; not receive-only `resend.app` alias | Name present only |
| Function JWT verification | Disabled for logged-out recovery requests; only this function deployed | Current v39 disabled; repository config also disabled |
| Entry/dependencies | `index.ts`, `handler.ts`, `_shared/recoverySecurity.ts`; pinned server dependency imports | Reviewed PR code, local integration tested |

Resend receiving/webhook configuration is separate from sending-domain
verification. Do not rotate the shared Resend key as part of this release unless
separately approved: it may affect job-alert ingestion. Supabase SMTP is not used
to send this custom recovery email; the function uses admin `generateLink` plus
the fixed Resend endpoint. Auth redirect validation still applies.

Configuration correction is an **independent production-write approval gate**.
Have the owner set the production-only origin in the dashboard/secret manager
and align Auth URL settings. Never copy `.env.example` to production. Do not
print secret-set commands containing real keys. Re-run the sanitized metadata
tool, confirm all URL checks true, and record conclusions only.

## Exact Deployment Sequence (Future Approved Execution Only)

**Never run these mutation commands during preparation.** Do not deploy Vercel,
merge main, use `db reset`, `--include-all`, `--include-seed`, `--include-roles`,
`--yes` on Supabase prompts, or apply the test bootstrap in production.

1. Close Gate A/B below: owner configuration checks/corrections, risk acceptance,
   completed backup + restore rehearsal, v39 artifact, final window and release SHA.
   Keep v39 active. Freeze concurrent releases. Confirm the original v39
   version/source/bundle again; any drift requires refreshed rollback evidence.
2. Pin the approved PR HEAD and compare it to GitHub; stop on a dirty checkout,
   missing local historical migration, new pending migration, changed reviewed
   migration hash, failed CI or PR changes after approval.

   ```powershell
   $Repo = 'C:\Work\SideProject\ApplyTrack'
   $Project = 'qotipygmwlovxklkexjb'
   Set-Location -LiteralPath $Repo
   git status --short --branch
   git rev-parse HEAD
   gh pr view 6 --json headRefOid,statusCheckRollup
   (Get-FileHash supabase/migrations/20261009201500_password_recovery_safety.sql -Algorithm SHA256).Hash
   npm run prepare:rollback:recovery
   ```

3. Complete fresh final backup and verification above. Confirm storage copy,
   decryption key, successful rehearsal, rollback source and explicit RPO/RTO.
   Stop here unless Gate C authorizes the one migration on this exact project.
4. Apply **only** the recovery migration using the pinned CLI, explicit target
   and no Vault sync. Provide existing approved credentials privately; CLI
   connection setup can create a temporary login role, which is part of Gate C.

   ```powershell
   npx --yes supabase@2.120.0 db push --project-ref $Project --skip-vault --workdir $Repo
   if ($LASTEXITCODE -ne 0) { throw 'Migration failed; keep v39 and stop.' }
   ```

   Review the CLI confirmation plan: it must show exactly the recovery file.
   If history differs, **decline**; do not repair the ledger or reapply old SQL.
   Preserve the protected CLI result (no debug/secrets); verify ledger increases
   from the recorded nine versions to ten with the new version once, not twice.
   Do not manually execute only the SQL body while leaving CLI history unrecorded.
5. Execute `verify-recovery-release.sql` on production. Require `all_passed=true`
   and all 17 results true. Check original public RLS/ownership policies remain
   unchanged; check migration function bodies against the reviewed SQL and
   owners are privileged. Wait for normal PostgREST schema cache refresh and
   confirm Data API exposure; do not automatically issue privileged reload SQL.
   **Do not deploy Edge if any check or history verification fails.**
6. With separate Gate D authorization, deploy exactly one function from the
   pinned checkout. No unrelated functions/configuration changes:

   ```powershell
   npx --yes supabase@2.120.0 functions deploy request-password-reset `
     --project-ref $Project --no-verify-jwt --workdir $Repo
   if ($LASTEXITCODE -ne 0) { throw 'Edge deployment failed; start approved rollback assessment.' }
   ```

7. Read metadata/source back: status ACTIVE, new version greater than 39,
   verify_jwt=false, expected entrypoint and all three reviewed source files.
   Compare unbundled contents/hashes, not bundle hash to source-file hash.
   Validate URL configuration again. Keep v39 artifact intact.
8. Gate E authorizes the controlled smoke matrix below, including Auth writes,
   quota writes and explicit owner-consented mail/password changes. Record
   pass/fail, status codes and redacted error kinds only. No reset URLs, bodies
   containing tokens, screenshots of inboxes, password hashes or credentials.
9. Monitor recovery 5xx/delivery failures and unrelated login/alert-ingestion
   health for the agreed window; record acceptance and end approved maintenance.
   Remember known-account provider failures can return 200: public success is
   not proof of delivery. PR merge/Vercel deployment are separate future actions
   and are **not** part of this runbook's execution authorization.

## Post-Migration SQL Verification

The executable verifier checks read-only transaction, ledger entry, RLS/no
policies, all anonymous/authenticated table/column privileges and PUBLIC ACLs revoked,
service CRUD, columns/PK/check/index, exact RPC signatures, PUBLIC/client
EXECUTE revoked, service EXECUTE, empty search_path, privileged ownership,
security invoker/definer, language/volatility/return types and service schema
USAGE/BYPASSRLS. It is also exercised against the real local migrated database.

It does not establish RPC body equivalence, network/WAF trust or Data API
exposure. Review catalog function definitions against the approved migration
without printing Auth rows. Unauthorized client execution must fail with
permission denied in the approved smoke test. Do not call the lookup RPC with
real user data in shared logs or try the quota RPC without production-write approval.

## Smoke Test Matrix (Gate E; Not Executed in Preparation)

| Scenario | Procedure and expected outcome |
| --- | --- |
| OPTIONS / GET | OPTIONS 200; unsupported GET 405; no quota/auth/mail action |
| Invalid body | Invalid JSON/array/over-2KiB -> 400; malformed email/control characters -> same neutral 200; no mail or lookup |
| Unknown address | Unique controlled non-account address -> neutral 200, no mail; valid input still writes quota rows |
| Known address | Owner-consented account/contact only -> exact same neutral response; one legitimate inbox delivery verified privately |
| Case/whitespace | Same normalized contact resolves correctly; control/format characters rejected rather than silently removed |
| Duplicate metadata | Production read-only aggregate remains unambiguous; duplicate fail-closed behavior proven locally. Do not create/edit real accounts for this smoke |
| Email quota | Six requests to one unique unknown address within 15 minutes -> neutral replies; counter 6 and no mail. Known-address delivery ceiling separately verified locally to avoid five real emails |
| Concurrency | Small approved burst to another unknown test address; counters match calls, no 500/lost updates. 48-way RPC and 12-way Edge enforcement remain local evidence, not a production load test |
| Network quota | Thirty/31st behavior tested locally; live burst requires extra approval because it can throttle legitimate users sharing the operator's network. Do not spoof headers or purge production counters |
| Approved redirect | One owner-controlled recovery link ends only on canonical `/?recovery=1`; a requested path/query is normalized |
| Attacker/preview/loopback/credentials redirect | Separate owner-consented link requests fall back to canonical origin, never external/localhost. Inspect links privately; unknown-email responses cannot prove redirect selection |
| Reset / reuse | Owner follows most recent link, personally enters a new password, then reuse cannot open a fresh recovery session. Previously generated links may be superseded |
| Expired link | After configured Auth TTL, unused controlled link rejected; wait for expiry, never update production timestamps to simulate it |
| Username login | Original username login still works with owner-entered credentials; new password succeeds and old password fails after controlled reset |
| Client privileges / RLS | Anonymous and controlled ordinary user cannot access throttles or execute either RPC; existing application visibility remains owner-scoped |
| Resend failure / DB outage | Fault injection remains local. Do not break production keys, permissions, database or mail provider for a smoke test |
| Other workflow | Existing application pipeline and alert ingestion unchanged; no unrelated deploy or data edit |

Wait 15 minutes for quota expiry between conflicting scenarios instead of deleting
counter rows. Plan mail-related cases around the five/email limit and actual
Auth token TTL. Password entry/reset is performed by the account owner, not the
agent; credentials and test-contact identity remain out of the release report.

## Rollback Procedures

### Migration Not Started / Failed Before Edge

Keep v39 running. Do not deploy the new handler. Investigate using read-only
catalog/history queries. The migration is additive and ordinary transactional
DDL; nevertheless verify actual committed state/ledger before retrying. Partial
objects or unexpected permissions require review, not a blind repair/re-run.

### Edge Failure After Successful Migration

Prefer a forward fix if safely understood; otherwise request rollback approval.
The reproducible local rollback directory is `.temp/release-prep/v39` and contains
only the pinned v39 source, single-function config and a manifest. Recreate with
`npm run prepare:rollback:recovery`; it refuses hash mismatch or different existing
files. No reliance on the current main branch, old deleted review directory, or
download commands that overwrite current PR source.

After explicit rollback authorization and artifact hash recheck:

```powershell
npx --yes supabase@2.120.0 functions deploy request-password-reset `
  --project-ref qotipygmwlovxklkexjb --no-verify-jwt `
  --workdir 'C:\Work\SideProject\ApplyTrack\.temp\release-prep\v39'
```

This deploys v39 **code as a new function version**, not a platform version-number
rewind. Read the resulting active source/JWT setting back and compare against the
pinned source hash. Rollback restores older, weaker recovery behavior (in-memory
throttling, user enumeration scan, different error responses); require incident
owner acceptance and a follow-up hardening release. Keep narrowed production
redirect settings; do not restore unsafe development origins.

### Additive Database Change

Leave the new throttle table/RPCs and their restrictive grants in place when
rolling back Edge. Keep the applied migration history entry. Old v39 does not
use them; leaving them avoids losing audit/counters or destroying later
dependencies. Do **not** drop objects, delete history, broaden client grants,
or restore a full database merely to undo this additive migration.

If removal is genuinely necessary, create a separately reviewed forward migration
after dependency/data checks and separate DDL approval. No automatic down migration
or emergency `db reset` is supplied.

### Catastrophic Data/Schema Recovery

Full database restore is the last resort and a separate high-impact approval:
identify encrypted artifact/restore point, establish data loss since snapshot,
stop approved writers, agree downtime/RPO/RTO, and use the **successfully rehearsed**
Supabase-compatible restore procedure. Database and Storage binaries/configuration
must be recovered consistently. Inspect Auth users/identities, roles/RLS, sequence
state, migration history and owner login privately. Preserve current post-incident
evidence before recovery. Managed backups are an option only if an actual usable
restore point is verified; do not promise PITR for this Free project.

Do not paste the raw native archive into the production SQL editor or invoke
`pg_restore --clean` on production. No production restore was rehearsed or
authorized here; successful local synthetic tests are not a real-backup drill.
Restoring Auth can reinstate older password hashes, sessions and refresh tokens;
an incident restore requires an approved session/token invalidation and owner
reauthentication plan. Restoring into a different project also changes the host
used by ApplyTrack's synthetic username-email mapping. A new-project cutover
needs separately tested identity/configuration migration, not just restored rows.

## Preparation Validation

The local preparation changes add a catalog-only SQL verifier, redacted
Management API reader, reproducible v39 rollback-source builder, and production
versus local configuration documentation. No production runtime handler or
migration body was changed in this preparation.

- `npm test`: 45 unit tests pass (including four management-redaction/origin tests).
- `npm run test:integration:recovery`: 23 real local Supabase tests pass, including
  all 17 catalog checks; local database lint returns no errors.
- `npm run lint`, `npm run build`, and `git diff --check`: pass.
- `npm run prepare:rollback:recovery`: reproduces the verified byte-identical v39
  source/manifest without network/deployment; a second run is idempotent.
- Production execution of the read-only SQL safely returns the expected
  pre-migration failure state on PostgreSQL 17.6, without invoking either RPC.
- Management reader with no owner-supplied token fails closed; actual Auth,
  backup and Data API endpoint results remain unverified, not simulated evidence.

One initial local run failed when a readiness-probe keep-alive socket remained
in Node fetch's shared pool during synchronous catalog checks. The test-only
probe now uses `Connection: close`, matching the existing client fixture; the
suite then passed without retries or relaxed assertions. No production network
behavior was changed to fix this fixture issue.

## Stop Conditions

- Wrong project/checkout/SHA, dirty user changes, moving main, failed CI or
  migration plan showing anything other than the one approved file.
- Missing/recently changed backup, failed decryption/TOC/restore drill, unavailable
  off-site key, unprotected staging, omitted Auth identities or Storage binary.
- Noncanonical/loopback/preview/wildcard production redirect, unknown Auth settings,
  unverified Resend domain/key, unavailable Data API or server credentials.
- Any post-migration catalog check false, unauthorized client access, missing
  history entry, different RPC definition/owner, failed Edge source verification.
- Smoke failure, unexpected account-specific response, token/PII leakage in logs,
  recovery/login regression, unexpected real recipient or unapproved writer activity.
- An action requires a production permission not explicitly covered by its gate.

Stop means keep/restore the approved safe operating state, report evidence, and
request the next specific approval. It does not authorize another project,
automatic retries, role repair, Secret changes or a merge.

## Remaining Risks

- Editable `user_metadata.profileEmail` is still **ownership-unverified**. This
  PR preserves that legacy model; duplicate contacts fail closed and may enable
  denial of recovery. Owner must accept this residual risk or require a separate
  verified-email-identity migration before release.
- Network headers are best-effort/spoofable; email quota is durable. SHA-256
  buckets are pseudonymous, not guaranteed anonymization; low-entropy addresses
  can be guessed. Responses are not asserted to have constant timing.
- Probabilistic cleanup and counters can grow under sustained abuse; monitor
  table growth and endpoint traffic. An existing trusted WAF/abuse-control plan
  should be reviewed separately; no new platform setting is enabled here.
- Actual production backup/restore, Auth redirects, Resend validity, inbox flow
  and deployed proxy behavior remain unproven. Free-plan disaster recovery needs
  owner-operated encrypted exports and tested restoration.
- Production is 17.6 while current local tests run 17.11. The upstream minor
  security-update advisory needs separate maintenance review, including extension
  compatibility; no production upgrade is authorized by PR #6. See
  [Supabase's PostgreSQL minor-upgrade advisory](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes).
- Existing advisor warnings: [public extension](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)
  and [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
  Previous dependency gate allows existing moderate advisories; high/critical CI
  success is not a claim of zero vulnerabilities.

## Explicit Approval Gates

| Gate | Owner approval/evidence required | Preparation status |
| --- | --- | --- |
| A - Sensitive backup handling / configuration | Protected encrypted staging/key custody; existing DB access; read-only inventory; explicit approval for production origin/Auth corrections if needed; verified Resend sender/key | Open; unsafe Edge allowlist confirmed, Auth/Resend/backup inventory incomplete |
| B - Recovery readiness | Completed encrypted backup set and real restore drill; Storage copy; measured RPO/RTO; v39 source/hash; accepted legacy-email/network/17.6 risks | Open; v39 artifact ready, backup/drill/risk acceptance pending |
| C - Database migration | Exact project, final release SHA/CI, fresh final backup, only recovery migration, CLI temporary-role connection setup | **Not authorized** |
| D - Edge deployment | All 17 SQL checks true, reviewed function definitions, Data API reachable, exact one-function bundle, JWT disabled | **Not authorized** |
| E - Production smoke | Specific owner-controlled account/mailbox, mail limits, quota/Auth writes and owner password reset; agreed monitoring window | **Not authorized** |
| R - Rollback/restore | Specific source artifact and single-function deployment, or separately approved forward DB change/full restore/loss window | **Not authorized** |
| M - Merge/frontend release | Separate PR merge and Vercel authorization | Outside this preparation; **not authorized** |

**Decision:** technical evidence is sufficient to request a *conditional* release
authorization review, not to execute release. Do not issue an unconditional GO
until A/B are closed, current unsafe origins corrected under approval, missing
configuration confirmed, and C/D/E explicitly authorized.
