# RF-05: Job Alert Processing Reliability

Status: Completed; migration and production Edge Function v22 independently verified (2026-10-11 America/Toronto).
Scope: F06 and R07. No production operations, new dependencies or paid services.

## Behavior

- `claim_job_alert_message` uses the existing unique Resend email ID and
  conditional INSERT/ON CONFLICT UPDATE to give exactly one delivery a processing
  token. Received/Failed messages can retry immediately. Processing leases expire
  after five minutes; legacy Processing rows without a lease can be reclaimed.
- Completed/Partial/Ignored deliveries return duplicate success without retrieving
  mail again. Active Processing returns HTTP 503, not a successful acknowledgment.
- `finish_job_alert_message` locks the message, verifies its token/lease, then
  commits Lead metadata, the monotonic Inbox receipt time, counts and terminal
  status in one database transaction. Any failed write rolls back all of them.
- Failure returns HTTP 500 and attempts a checked, token/status-conditional Failed
  update. If even that write fails, redelivery can reclaim the expired lease.
  A late worker cannot commit or overwrite a newer worker's completion.
- Both RPCs are SECURITY INVOKER with an empty search path; EXECUTE is granted
  only to runtime service_role (not PUBLIC, anon or authenticated); database
  owners/administrators retain their existing rights. Existing table grants,
  RLS policies, Auth, secrets and user data are unchanged.
- Inbox initialization uses INSERT ON CONFLICT DO NOTHING and rereads the winning
  row. Existing aliases, enabled state and receipt timestamps are never reset.
- Lead uniqueness remains `(user_id, source, external_id)`. Metadata refresh
  deliberately excludes state, application_id and discovered_at. This prevents
  ingestion retries from worsening F05, but RF-06's conversion-RPC stale-state
  repair remains unresolved and its existing SQL characterization is retained.

## Verification

Run `npm test`, `npm run test:audit`, `npm run test:audit-db`,
`npm run test:auth-ui`, `npm run test:audit-ui -- --project chromium`,
`npm run lint`, `npm run build` and `git diff --check`.

The real-handler harness still executes the actual parser and Svix signature
verification. Corrected F06 and ingestion-side F05 tests replace the old
bug-characterization assertions; no relevant failing characterization was deleted.
Fast tests cover write failures, retrieval failure, immediate retries, duplicates,
active leases, lease expiry/takeover and concurrent Inbox initialization.

The existing isolated PostgreSQL 17 runner additionally executes the actual handler
and client API against the real RPC SQL via a psql adapter, on both fresh schema
and incremental migration paths. Fault-injection triggers prove transaction
rollback for Lead, Inbox and terminal-message writes. A catalog-observed table
lock proves eight simultaneous initial claims and eight Failed retry claims
overlap before release. Further checks cover stale-worker fencing, legacy rows,
failed failure-release writes, ignored/partial writes, preserved terminal states,
service-only RPC access and authenticated concurrent Inbox initialization.
Fresh/incremental RPC definitions and effective runtime-role EXECUTE permissions
must match (normalizing CRLF only). The image's default database additionally
grants EXECUTE to the administrative postgres role; the replay database does not.
This existing default-ACL difference is not changed or mistaken for a runtime grant.

The container has no network, host ports or mounts, and uses synthetic data and
tmpfs. The runner removes only its own randomly named, labeled container.
These tests do not certify hosted Deno/PostgREST/Resend delivery; those remain
separate approved release smoke tests.

### Local Results

| Gate | Result |
| --- | --- |
| `npm test` | 34 passed |
| `npm run test:audit` | 27 passed |
| `npm run test:audit-db` | Passed, including existing ownership/RLS/RPC assertions and all 11 migrations |
| RF-05 actual-handler/SQL workflows | 10 passed on each of fresh schema and migration replay (20 executions) |
| Reused Edge harness inside the SQL suite | 14 passed on each path; not counted as additional SQL workflows |
| `npm run test:auth-ui` | 12 passed across desktop, tablet and phone |
| `npm run test:audit-ui -- --project chromium` | 22 passed, including responsive/overflow checks |
| Lint, Build, `git diff --check` | Passed |

Both schema paths also verify Indeed salary extraction and accurate creation/update
counts. The database runner exited successfully and removed its own container.
No production database, Edge Function, Auth or deployment configuration was changed.

## Production Release and Independent Verification

With explicit user approval, the migration `20261012005112_job_alert_processing_reliability.sql` was applied to production Supabase project `qotipygmwlovxklkexjb`; its exact version and name are registered in Supabase Migration History. Codex deployed only `ingest-job-alert`; ChatGPT verified that the function is ACTIVE at v22 with `verify_jwt=false`. Its deployed handler and shared parser match GitHub `main` byte-for-byte after normalizing CRLF to LF.

Read-only production checks found both new JSONB RPCs with SECURITY INVOKER and an empty search path; only `service_role` among application roles has EXECUTE. The new UUID/token and processing-start columns are present. Both RPC definitions contain the expected lease mechanism, and the finish RPC checks the processing token.

Data verification: 342 job-alert messages, all terminal; 0 processing, failed or received messages and 0 retained processing tokens; 0 duplicate email IDs. Existing 629 Leads, 420 Applications and 31 associations remain, with 0 orphan/cross-owner associations and 0 duplicate Lead keys. RLS remains enabled and the RF-04 ownership FK remains validated.

This release did not include a production webhook test using a real Resend email; success under live delivery still depends on normal operation. Local PostgreSQL 17 fault-injection and concurrent-handler suites were reported as passed by Codex; GitHub CI was independently checked and passed. No backup, unrelated production schema change or automatic production-sync enablement was performed as part of this release.

## Historical Pre-release Boundaries and Ongoing Limits

The following paragraphs describe the planned release procedure before this rollout; the production completion record above supersedes their pending language. No further rollout is requested.



The released SQL is additive and does not rewrite existing messages or Leads.
Keep automatic Supabase production synchronization OFF. Original v21 workers did
not honor tokens; the authorized production rollout moved to v22 after the new RPCs
were registered. Do not replay `schema.sql` on an existing database.

Lease recovery is on redelivery, not a new scheduler or background queue.
If Resend's retry window is exhausted, operator-approved redelivery is necessary.
An ambiguous lost response after commit is safe: the next delivery sees the
terminal message and deduplicates. Receipt time now records committed processing
(including ignored/partial), rather than a best-effort early update.
Historic partial writes from v21 are not deleted/repaired; retries refresh metadata
without changing existing user decisions.
