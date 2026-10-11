# RF-04 Stage 3: Local Backup Security Remediation

2026-10-11 (America/Toronto). Baseline: `origin/main`
`61fbbcd6f58a3100ccce0edcf645b8d6b43b2fb7`; branch
`ops/rf-04-local-backup-security`.

**Real backup readiness: NOT READY.** The ACL approach is verified on disposable
directories, not installed on the real backup location. Encryption, age and
managed dependency gates remain open. RF-04 stays **In Progress**; production
F01 remains unresolved per the [master plan](REFINEMENT_MASTER_PLAN.md), not a
new production observation. No production connection/export/write occurred.

Authority: [Stage 2 evidence](RF_04_BACKUP_READINESS_REPORT.md),
[operator checklist](RF_04_BACKUP_OPERATOR_CHECKLIST.md),
[migration runbook](RF_04_OWNERSHIP_MIGRATION_RUNBOOK.md) and
[separate privilege proposal](PRODUCTION_PRIVILEGE_REVIEW.md).

## Findings and Status

| Item | Status | Actual evidence / boundary |
| --- | --- | --- |
| Encryption/protection of C: | NOT VERIFIED | Current process has no elevated administrator token; status command returned access denied, not encryption status |
| Current account's reliable status verification | FAIL | Cannot establish BitLocker protection through this session; no UAC elevation attempted |
| Existing backup directory ACL | FAIL | Inheritance remains enabled; broad read/modify entries remain. No real-directory ACL changed |
| Synthetic private DACL and rollback | PASS | 22 checks: three-principal whitelist, inheritance isolation, operator I/O, exact baseline rollback and cleanup |
| Other-user runtime denial | NOT VERIFIED | No impersonation, new account or alternate credentials used; SYSTEM/admin access established as ACL entries, not separate logins |
| Git/sync isolation | NOT VERIFIED | Existing target is ignored; neither it nor proposed root matches known OneDrive roots. Other privileged backup/sync agents remain unknown |
| Docker/temp encryption coverage | NOT VERIFIED | WSL2/overlayfs backend confirmed; actual Windows Docker disk location/protection not established. Host temp is on C: whose protection is unknown |
| Trustworthy local age / age-keygen | NOT VERIFIED | Neither on PATH; bounded common portable/package installation checks found no executable. Not proof of machine-wide absence |
| age install/provenance and key custody | REQUIRES APPROVAL | Official pinned package/proof identified; no download, install or permanent identity generated |
| age positive/negative encryption tests | NOT VERIFIED | Blocked by missing verified tool; Stage 2 Node encryption is not age verification or the production standard |
| Narrow-scope synthetic dependency handling | PASS | Eight checks including two atomic rejection cases and restore with retained, matching synthetic Auth dependencies |
| Real-data/managed-schema restoration | NOT VERIFIED | Stand-ins are not hosted Supabase Auth/Storage; no real backup or restore performed |

The local token and access-denied result explain the status-inspection blocker;
they do not prove whether BitLocker is installed, enabled, suspended or absent.
No recovery password or protector lookup was performed. No existing credential,
private-key, Docker credential/settings file or user record was read.

### Minimal Operator Encryption Check (Approval Boundary)

After separately approving an elevated **status-only** shell, the operator can
run the following exact commands. Affected resource: C: status only. Rollback:
none (no state mutation). Risk: the shell is privileged; do not run unrelated
commands, print full CIM objects or call protector/key-management methods.

```powershell
$ErrorActionPreference = 'Stop'
$v = Get-CimInstance -Namespace 'root/CIMV2/Security/MicrosoftVolumeEncryption' -ClassName Win32_EncryptableVolume -Filter "DriveLetter = 'C:'"
if (-not $v) { throw 'Volume status unavailable; stop' }
$c = Invoke-CimMethod -InputObject $v -MethodName GetConversionStatus -Arguments @{ PrecisionFactor = [uint32]0 }
$p = Invoke-CimMethod -InputObject $v -MethodName GetProtectionStatus
if ($c.ReturnValue -ne 0 -or $p.ReturnValue -ne 0) { throw 'Status query failed; stop' }
[pscustomobject]@{ ConversionStatus = $c.ConversionStatus; EncryptionPercentage = $c.EncryptionPercentage; ProtectionStatus = $p.ProtectionStatus }
```

Require ConversionStatus **1** (fully encrypted) and ProtectionStatus **1** (on);
percentage alone is insufficient. Review used-space-only/free-space history
privately if old plaintext may exist. Any unknown/off/partial result blocks
confidential work. Changing encryption/protectors is **not authorized**.
[Microsoft conversion status](https://learn.microsoft.com/en-us/windows/win32/secprov/getconversionstatus-win32-encryptablevolume),
[protection status](https://learn.microsoft.com/en-us/windows/win32/secprov/getprotectionstatus-win32-encryptablevolume).

Docker reports a Linux root inside WSL2, not the host volume protecting its
virtual disk. Known legacy/current disk-file probes did not locate that disk;
this is not evidence of no disk. Operator must inspect Docker Desktop's displayed
disk-image location privately, then status-check that host volume and relevant
temp/paging/spill volumes. Do not move Docker storage or change other projects.
[Docker WSL data location](https://docs.docker.com/desktop/features/wsl/).
Container tmpfs is not a guarantee against host paging or privileged access.

## Exact ACL Findings and Proposed Location

Existing target: `C:\Work\SideProject\ApplyTrack\tmp\rf04-backup.local`.
All observed access entries were inherited:

- Built-in Users: ReadAndExecute + Synchronize, applying to directory/children.
- Authenticated Users: Modify + Synchronize on the directory; another inherit-only
  entry carries generic read/write/execute and DELETE to descendants.
- Four additional private-principal entries: two Modify + Synchronize and two
  Write + ReadAndExecute + Synchronize. Identifiers intentionally omitted.
- SYSTEM and Built-in Administrators: FullControl, which must be preserved.
- No Everyone entry was observed; that does not make the other broad grants safe.

These permit reading, mutation or deletion through broad memberships and can
propagate to newly created archives. Reviewed broad ACEs on the inspected tmp
and C: parents did not contain an applicable DELETE_CHILD right; this is not a
complete effective-access/membership or future-policy attestation.

Proposed final location, **not created**: `C:\ApplyTrackBackups\RF04`, below a new
private root `C:\ApplyTrackBackups`. It lies outside this checkout and therefore
outside ordinary repository staging. It is not automatically encrypted, unsynced
or immune to SYSTEM-level backup agents; operator confirmation is still required.
No parent-directory ACL changes are proposed. No data should remain in the
existing shared project-local target for a real export.

### Reviewed Future Operation (Not Executed; Requires Approval)

Approve the new root/path and its three-principal FullControl DACL first. Only
create it if absent, after storage and synchronization verification. Reject any
existing target/reparse point or unexpected parent rights rather than resetting
an existing directory. Apply while empty, before placing confidential contents:

```powershell
$root = 'C:\ApplyTrackBackups'
if (Test-Path -LiteralPath $root) { throw 'Existing root; stop for review' }
$operator = [Security.Principal.WindowsIdentity]::GetCurrent().User
$acl = [Security.AccessControl.DirectorySecurity]::new()
$acl.SetOwner($operator)
$acl.SetAccessRuleProtection($true, $false)
$inherit = [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit
foreach ($principal in @($operator, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'), [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))) {
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($principal, 'FullControl', $inherit, 'None', 'Allow'))
}
New-Item -ItemType Directory -Path $root -ErrorAction Stop | Out-Null
if ((Get-Item -LiteralPath $root -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse point; stop' }
Set-Acl -LiteralPath $root -AclObject $acl -ErrorAction Stop
```

Expected: protected DACL, owner=current authorized operator, exactly operator,
SYSTEM and Administrators allow entries, FullControl inheritable to children.
Confirm exact entries and child I/O before creating/using `RF04`; stop on failure.
If elevation is needed, obtain separate approval for this exact new root only;
never use takeown, parent-wide grants, recursive icacls or account changes.
Administrators/SYSTEM and the operator can still access or change this boundary.

Rollback of this future **empty** root is `Remove-Item -LiteralPath
'C:\ApplyTrackBackups'` without recursion, only after identity/reparse/content
checks and no confidential data has ever been placed there. If populated,
preserve restrictive permissions and stop for a separate retention/cleanup plan;
do not run `/reset` or restore broad inheritance on real confidential contents.
Any existing-directory ACL change still requires an exact separately reviewed
baseline/change/rollback; the snippet does not authorize it.

### Verified Synthetic ACL Procedure

Run `pwsh -NoProfile -File tests/rf04/local-directory-acl.ps1` from this workspace.
It accepts no target parameter and generates only random directories under tmp;
there is no route to harden the real backup directory. Baseline owner/group/DACL
are held in memory, never logged/stored. The test removes inheritance and grants
only the three required principals, creates a synthetic child, then grants
Everyone read access on its **disposable parent** and verifies no propagation.

Initial `Set-Acl` rollback attempts demanded SeSecurityPrivilege. Rather than
elevating, the corrected test requires an inherited-only fixture baseline and
uses `icacls <exact synthetic directory> /inheritance:e /q` then `/reset /q`.
The original owner/group/DACL and inheritance matched exactly afterward. This
reset is **not** a general rollback for explicit or confidential-data ACLs.
[Microsoft icacls](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/icacls).

Final run: 22 PASS markers, including existing tmp/backup ACLs unchanged. Both
failed-attempt directories and the successful fixture were cleaned through
verified names, markers, non-reparse literal paths and non-recursive removal.
No runtime artifacts or private account identifiers enter Git. Cross-account runtime access
remains NOT VERIFIED; this test proves the DACL structure and current-operator
behavior, not every agent/token's effective access.

## age Acquisition and Custody Gate

Bounded checks covered PATH, common WinGet/portable/Scoop/Chocolatey locations and
project tools/bin. No age executable was found. Go and sigsum-verify also were not
on PATH. Do not execute an unknown binary, search private key stores, download or
install automatically. Permanent key custody remains unprovisioned.

Official release identified: [age v1.3.2](https://github.com/FiloSottile/age/releases/tag/v1.3.2),
Windows amd64 portable ZIP for the inspected X64 architecture. Public GitHub
release metadata advertised `age-v1.3.2-windows-amd64.zip` SHA256:
`f48d8f8f9ebe903ab5027ed067652f2cc1db94bc206976430133b905dcd8e8c7`.
The paired `.zip.proof` is available. This is metadata verification, **not**
downloaded-byte or publisher-proof verification.

After approval, use the exact official release asset URL and its `.proof` under
`https://github.com/FiloSottile/age/releases/download/v1.3.2/`. Check local bytes
with `Get-FileHash -Algorithm SHA256 -LiteralPath <approved-zip-path>` against
the pinned digest, then verify its Sigsum proof with trusted `sigsum-verify`
v0.13.1, publisher public keys and `sigsum-generic-2025-1` policy from the pinned
[official Sigsum procedure](https://github.com/FiloSottile/age/blob/v1.3.2/SIGSUM.md).
Acquiring a verifier/Go, or using an already trusted verifier host, is a separate
operator decision; none was provisioned. A same-source hash alone is not a
cryptographic publisher signature. Stop on mismatch or unavailable verification.

Only after verification, extract the portable tools to an approved private tool
directory, invoke their absolute paths and check `age --version` (1.3.2). No
system-wide PATH change or plugin setup is needed for the proposed native-key
workflow. Rollback: remove only identified new tool files after path/ownership
checks; never delete keys/backups. No installation command was executed here.

Next synthetic gate: generate ephemeral native age identities into memory,
roundtrip binary synthetic data, reject a wrong identity and a tampered payload,
check every exit code and clean any partial decrypted output. Use byte-preserving
process pipes, not PowerShell text pipelines; age `--identity -` can consume an
in-memory identity through stdin when input ciphertext is a named file. Protect
any decrypt/restore temporary output even on failure. No age tests were executed;
do not substitute Stage 2 AES-GCM PASS for this gate.
[Pinned age manual](https://github.com/FiloSottile/age/blob/v1.3.2/doc/age.1).

Permanent custody proposal, not key-generation permission: operator-controlled
native age identity, private generation on a verified protected host, public
recipient-only export step, identity kept separately from archives/Git/logs and
not reused from SSH/Auth credentials. Keep recovery copies in operator-approved
existing encrypted/offline storage, agree access and retention, and prove recovery
on synthetic ciphertext before real use. Do not assume a second protected medium
exists at CAD $0; if unavailable, custody/recovery remains blocked. Agent must
never acquire or print production identity material.

## Backup Scope Decision

RF-04 changes a UNIQUE/index and ownership FK in a transaction, without DML.
Failure rolls back its DDL; after success prefer forward correction. Routine
restoring a stale database can lose new activity and restore F01. This is a
release safety objective, not automatic whole-platform rollback.

| Scope | Recovery objective / exposure | Dependency and consistency requirements |
| --- | --- | --- |
| A: public, auth, storage, supabase_migrations | Broad selected SQL recovery, including sensitive credentials/session material; not Storage bytes or hosted service/config recovery | Complete managed schema/role/extension bootstrap, exact security manifest and all-row/archive/sequence checks; actual restore still unverified |
| B: public, supabase_migrations + dependency/security manifest | Application/history recovery only while Auth and Storage remain available/unchanged; excludes their row data and reduces that exposure, not all private app/email data | Matching Auth parents, auth.uid/helper/role/extension compatibility; public FK closure, retained external dependencies and approved targeted restore; history at same snapshot/window |

New synthetic-only dependency evidence: one labeled cached PostgreSQL 17.6
container, no network/ports/binds, four new databases. A two-schema archive
omitted Auth/Storage data. Restore without Auth Schema/helpers failed atomically;
restore with helpers but no matching users also failed atomically on FK
validation. With matching retained synthetic users/helpers, all seven public
table content digests and synthetic migration/seed history matched. Auth/Storage
stand-ins remained unchanged. Eight checks passed, task container removed and
pre-existing container IDs unchanged. Evidence/harness remain Git-ignored under
`tmp/rf04-security.local/`; no host dump was retained. No ownership migration or
four-schema restore regression was unnecessarily rerun.

This demonstrates **modeled** dependency compatibility only, not real managed
schemas, roles/extensions, storage routines or hosted services. B cannot rebuild
lost Auth records from this archive; never manufacture Auth parents for a real
restore. Stage 2's owner/ACL/RLS replay and sequence/snapshot tests are reused,
not new B security-parity proof. Sequences and concurrent DDL/security metadata
still require a separately approved quiet window.

Recommendation: propose B as the smallest release-specific scope **only** if the
operator/reviewer agrees Auth/Storage preservation is the recovery objective and
accepts dependency/real-restore proof before release. Otherwise keep A. The
existing four-schema runbook, export commands and scope remain unchanged. Neither
scope meets the production-readiness gates today; no recurring paid resource is
introduced. Production/client/extension compatibility needs a later authorized
check; current Supabase minor-upgrade notes are not a production-version attestation.

## Remaining Approvals and Validation

1. REQUIRES APPROVAL: elevated status-only operator check above, actual Docker
   host-volume/temp/spill coverage and confirmation of no unintended synchronization.
   Encryption/protector changes are outside this plan.
2. REQUIRES APPROVAL: exact new outside-repo root/DACL operation and later runbook
   path revision; no existing directory/parent/account ACL change is authorized.
3. REQUIRES APPROVAL: pinned portable age/proof and trusted verifier acquisition
   or verification host; then age synthetic tests and permanent custody decision.
4. REQUIRES APPROVAL: recovery objective and any B scope change, managed-dependency
   bootstrap, real offline restore plan, retention and snapshot/writer coordination.
5. REQUIRES APPROVAL: separate production connection/export, real-data restoration,
   refreshed preflight and RF-04 migration/history registration. This stage grants none.

PASS: new ACL test (22 checks), subset dependency test (eight checks), Lint,
Build and documentation/diff validation. Stage 2's 34 unit/18 audit tests and
full SQL/backup rehearsal are reused because app/schema/migration code is unchanged;
not claimed as rerun. Only this report, minimal cross-links and the synthetic ACL
test are proposed for Git. No secrets, real user data, private account identifiers,
backup archives or keys are committed. No production/Supabase integration/Vercel
configuration was changed; automatic production sync remains under its OFF hold.
Before publication, the branch-filtered Vercel inventory returned zero deployments;
this is bounded observation, not independent verification of its saved Preview setting.
No downloads/installs, encryption changes, other-project mutations, merge or
deployment occurred. Stop for ChatGPT review; do not mark RF-04 Done.
