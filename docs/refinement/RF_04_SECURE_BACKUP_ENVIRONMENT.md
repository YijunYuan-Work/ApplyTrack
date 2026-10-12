# RF-04 Stage 4: Local Secure Backup Environment

2026-10-11 (America/Toronto). Baseline: `origin/main`
`ab484a3451cfaf9780121601a39e4f8b22e35441`; branch
`ops/rf-04-secure-backup-environment`.

**Confidential-data environment: NOT READY.** Verified portable age and a new
restricted directory improve local readiness, but do not resolve encryption,
sync/spill, permanent custody or managed restore gates. RF-04 remains **In
Progress**; production F01 remains unresolved according to the existing release
record. No production metadata or user data was accessed in this stage.

Authority: [master plan](REFINEMENT_MASTER_PLAN.md),
[migration runbook](RF_04_OWNERSHIP_MIGRATION_RUNBOOK.md),
[operator checklist](RF_04_BACKUP_OPERATOR_CHECKLIST.md),
[Stage 2 evidence](RF_04_BACKUP_READINESS_REPORT.md) and
[Stage 3 remediation](RF_04_LOCAL_SECURITY_REMEDIATION.md).

## Updated Workspace Boundary

The user superseded the initial outside-repository directory proposal:
**all new tools, cache, temporary files, test keys and artifacts must remain
inside `C:\Work\SideProject\ApplyTrack`.** Do not create or modify
`C:\ApplyTrackBackups` or use that historical proposal as an active plan.
Do not request an elevated BitLocker check. Permission denial is a blocker,
not permission to bypass it or a reason to abandon independent synthetic work.

Active synthetic-only root: `tmp/rf04-stage4.local`, newly created and Git ignored.
Existing `tmp/rf04-backup.local` and shared/parent ACLs are unchanged. Neither
directory is authorized to receive production data or permanent backup keys.
The old runbook's project-local export paths remain gated; do not execute its
example export commands or silently substitute this synthetic root.
Four-schema scope (`public`, `auth`, `storage`, `supabase_migrations`) is unchanged.

The user separately approved official portable Go and the fixed Sigsum verifier,
using official module sources/checksum verification and workspace-only paths.
No installer, package manager, global PATH, registry or account change occurred.

## Actual Readiness Outcomes

| Condition | Result | Evidence / limitation |
| --- | --- | --- |
| C: fully encrypted and protection active | NOT VERIFIED | Reviewed status-only CIM query returned Access Denied; no protector/key query or elevation |
| New actual directory DACL | PASS | Protected root; current operator owner; exactly operator, SYSTEM and built-in Administrators with inheritable FullControl |
| Actual child inheritance and operator I/O | PASS, synthetic only | New child directory/file inherited only the three principals; read/write and non-recursive cleanup verified |
| Existing parent/backup ACL preservation | PASS | Before/after owner/group/DACL comparisons matched; no existing ACL changed |
| Separate-account effective access | NOT VERIFIED | No alternate credentials, impersonation or new accounts used |
| Git exclusion | PASS | `tmp/` is ignored; binaries, archives, caches and evidence excluded from commit |
| Unintended cloud sync/backup | NOT VERIFIED | No known OneDrive-root match; arbitrary copy/sync/privileged backup agents not certified |
| Host temp and paging volume | PASS, location only | System temp, system directory and observed pagefile are on C:; its protection remains unknown |
| Docker host backing storage protection | NOT VERIFIED | Linux overlayfs root is not a Windows volume attestation; known default VHDX probes found no file |
| PostgreSQL 17 client execution path | PASS before revised boundary | Cached 17.6 image provided pg_dump/pg_restore/psql; no-network disposable container removed, other container IDs unchanged |
| Official age package hash and publisher proof | PASS | Pinned ZIP hash, publisher signature, log inclusion and official witness/quorum policy verified; modified ZIP rejected |
| age encryption and recovery | PASS, synthetic only | 48 checks, including byte-identical recovery, wrong-key/tamper failures and actual partial-output cleanup |
| Permanent private identity custody | NOT VERIFIED | No permanent identity generated or obtained; synthetic memory copies are not durable custody |
| Managed-schema/real-data restore | NOT VERIFIED | Stage 2/3 synthetic evidence reused; no real export/restore authorized |

The token is not elevated. Only conversion/protection status methods were called;
no recovery passwords, protectors or private keys were inspected. Access denial
does not imply an unencrypted disk. No BitLocker setting was changed.

The cached PostgreSQL check occurred **before** the user's stricter workspace-only
artifact instruction. It used no binds/ports/network/database connection and only
printed client versions. The temporary container was removed; subsequent work
created no Docker resources. Docker normally maintains storage outside the
checkout, so another container-based client/restore run is **blocked** unless its
storage behavior is reconciled with that boundary under new authorization.
Do not claim the prior check satisfies workspace-only Docker storage.

## Actual Directory and Local Changes

Created only the absent, non-reparse `tmp/rf04-stage4.local` root. The operator's
identity stayed in memory; no account name or private SID was logged. A protected
DACL removes inherited broad entries **only on that new root**, with inheritable
FullControl for operator, SYSTEM and Administrators. Owner, whitelist, inheritance
flags and parent preservation were checked before use. Actual root/child ACL
verification was separate from the supporting 22-check synthetic ACL rehearsal.
Eight critical executable/archive/key-policy files were additionally inspected:
only the same three inheritable FullControl entries were present. This is
structural ACL evidence, not a cross-account runtime denial test.

Retained local layout, all Git ignored:

- `tools/go/`: official portable Go 1.27.2, no system installation.
- `tools/sigsum/sigsum-verify.exe`: built official module v0.13.1.
- `tools/age-v1.3.2/`: only verified age.exe, age-keygen.exe and LICENSE.
- `downloads/`: official Go ZIP, age ZIP/proof and pinned public SIGSUM procedure.
- `cache/`: Go module/build/GOPATH caches; no private credentials.
- `scratch/`: workspace-local temporary location; age test directories removed.
- Local build/verification helpers and sanitized provenance/test JSON evidence.

Known OneDrive roots do not enclose this location. This is not a complete sync
inventory: SYSTEM/admin agents retain access by design, and private ACLs cannot
prevent their copying. Git ignore is not encryption or a backup-client exclusion.
The existing broader project-local backup directory is still unsuitable for
confidential data and was not hardened by this task.

## Tool Provenance and Windows Verification

Independently refreshed official [age v1.3.2 release metadata](https://api.github.com/repos/FiloSottile/age/releases/tags/v1.3.2)
before downloading from that release's official GitHub asset URLs. The downloaded
Windows amd64 ZIP SHA256 matched the Stage 3 pin:
`f48d8f8f9ebe903ab5027ed067652f2cc1db94bc206976430133b905dcd8e8c7`.
Proof SHA256:
`00ae35a24a47b9bace52ec62f06d402f38f6ecba4ca099d060a137e82ef0bc1d`.
A same-source checksum alone was not treated as publisher authentication.

The separately approved compiler was downloaded from `go.dev/dl/`, pinned to
`go1.27.2.windows-amd64.zip`, SHA256
`1314008898bd40df77af4b014f777f08873dbdfbcd3d92308728ee03304fe04f`,
and matched [official Go metadata](https://go.dev/dl/?mode=json) before execution.
This compiler trust uses official HTTPS/distribution metadata, not an age proof.

Built `sigsum.org/sigsum-go/cmd/sigsum-verify@v0.13.1` with
`GOPROXY=https://proxy.golang.org`, `GOSUMDB=sum.golang.org`, `GOVCS=*:off`,
`CGO_ENABLED=0`, `GOENV=off`, `GOTELEMETRY=off`, `GOTOOLCHAIN=local` and empty
private/no-sum/no-proxy overrides. GOPATH, GOMODCACHE, GOCACHE, GOBIN, GOTMPDIR,
TEMP and TMP were routed inside the new workspace root for the build.
No automatic toolchain download or system configuration file write was enabled.
The module hash verified by the [Go checksum database](https://go.dev/ref/mod#authenticating)
is `h1:q3LCLow8dWmy2hivXhEwu2uNeCwigIbLMwS1+CD35Lo=`; the only external
dependency was `github.com/pborman/getopt/v2@v2.1.0`. Verifier version/build
metadata both identified v0.13.1.

Trust anchors were the publisher's two public keys from pinned
[SIGSUM.md](https://github.com/FiloSottile/age/blob/v1.3.2/SIGSUM.md), not keys
supplied by the ZIP/proof, and the unmodified official `sigsum-generic-2025-1`
policy from the checksum-verified Sigsum module. This assumes the trusted official
HTTPS sources and Go checksum infrastructure; it is not out-of-band human
verification of publisher fingerprints.

Windows `-P sigsum-generic-2025-1` failed before signature evaluation: v0.13.1
uses `filepath.Join` for an embedded filesystem lookup, producing a backslash.
Used `-p <absolute workspace path to that same official .builtin-policy>` instead,
without changing the verifier, keys, logs, witnesses or quorum. Policy SHA256:
`666d9d0b9ab2e4019769c42eaccd7d6d502a9abac45979bb9b08b7213e4f53e3`.
Binary ZIP bytes were supplied through Node process stdin, not a text pipeline.
Original proof verification exited **0**; modified ZIP verification exited **1**.
Only then were age/age-keygen extracted and executed; age reported **v1.3.2**.
Public verification materials were copied into the protected root with matching
hashes and the known empty initial acquisition directory was removed.

## Synthetic Encryption and Recovery Evidence

Repeat from this workspace after verifying the retained tool/environment gates:

```powershell
node tests/rf04/age-encryption.mjs
```

The Windows-only test accepts no backup target or connection. It guards exact
workspace/tool paths and the executable hashes derived from the verified ZIP.
No automatic tool acquisition occurs. Three disposable native identities are
generated into process memory, never files/logs; private bytes use binary stdin.
Child TEMP/TMP and every test output stay inside the workspace root.

Final corrected run: **48 checks PASS**. A fabricated 1 MiB + 37 byte payload
containing all byte values was encrypted for primary and independent recovery
recipients. Both restored identical bytes. The original recovery buffer was
cleared before decrypting using its separate in-memory copy. Wrong identity and
late ciphertext modification each exited **1**, without publishing an output.
Late tampering produced real partial plaintext; the wrapper removed that staging
file on failure. Successful output was committed only after exit **0**.

Cleanup verifies the exact new directory, refuses unexpected/reparse entries,
removes only known synthetic files and uses non-recursive empty-directory removal.
An initial test used rmSync on an empty directory and failed cleanup; corrected
to rmdirSync. Its known empty directory was checked and removed separately.
Final evidence found zero age-synthetic or actual ACL-check directories.
All held private identity buffers were cleared in finally. This is not proof
that every runtime/OS copy is erased or that paging is encrypted.
No permanent identity, production recipient or confidential archive was created.

## Cleanup, Rollback and Remaining Gates

Portable tools, public archives, workspace caches and sanitized evidence remain
locally for review/reuse, not in Git. Synthetic keys/files are not retained.
No actual-root rollback was required; its new restrictive DACL remains installed.
Supporting disposable ACL tests restored their exact baseline before cleanup.
No existing parent, account, shared backup or outside-directory ACL changed.

Rollback must stop tools, verify exact literal paths, non-reparse ownership and
the known generated file inventory, then remove only those identified artifacts
and empty directories bottom-up. Do not recursively delete an unknown/populated
directory or reset inheritance. If confidential/unexpected contents ever appear,
preserve restrictive permissions and request a separate retention decision.
No global PATH/registry/installer rollback is necessary.

Unresolved conditions requiring independent evidence or new authorization:

1. Verify encrypted/protected storage independently; this stage will not request
   UAC/elevation or change BitLocker. Until established, synthetic/public only.
2. Confirm sync/backup exclusions and complete temp/paging/spill protection,
   actual Docker backing-storage volume, and a workspace-compliant PostgreSQL
   execution/restore path. Do not relocate Docker or alter another project.
3. Approve permanent native identity generation/custody, separate protected
   recovery copies, access/retention and recovery testing on a safe host.
   Workspace-only storage is not approval to collocate production keys/archives.
4. Resolve managed roles/extensions/Auth/Storage restore bootstrap and real
   security-manifest replay; no narrower production export is authorized.
5. Obtain separate production connection/export, real-data restore, writer/window
   coordination and RF-04 migration/history-registration authorization. None is
   granted by this task or by merging this PR.

## Validation and Production Boundary

PASS: 34 unit tests, 18 audit tests, Lint, Build, 22 supporting ACL checks,
actual new-root/child ACL verification, official age/proof checks including
negative verification, and 48 synthetic age checks. Stage 2's expensive database
restore/migration tests and Stage 3 dependency tests were not repeated because
application/schema/migration code and backup scope are unchanged. Existing BUG
characterizations passing does not mean those unrelated defects were fixed.

The initial post-acquisition Lint run scanned the portable Go distribution's
third-party JavaScript under ignored `tmp/` and failed. ESLint now excludes that
generated root and applies the existing Node recommended rules to RF-04 test
modules. Application rules are unchanged; no third-party source was edited.

No production PostgreSQL connection, data export/inspection/restore, migration,
privilege/Auth/Edge/secret/history change or permanent identity generation.
No integration toggle, paid service, system installer, PATH/registry modification,
BitLocker/account change, production deployment or merge. Automatic Supabase
production sync remains under its existing OFF hold, not independently re-read.
Vercel branch inventory before publication contained zero deployments; the
post-Push inventory observation is reported in the PR handoff. Inventory observations
do not independently certify the saved switch or exclude delayed events.
Stop after opening the focused PR for ChatGPT review; RF-04 is not Done.
