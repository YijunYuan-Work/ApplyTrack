# RF-05: Job Alert Processing Reliability

Status: In Progress; implementation ready for review, not released.
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

## Release Boundary and Limits

Requires a separately approved application of
`20261012005112_job_alert_processing_reliability.sql`, followed by an approved
`ingest-job-alert` deployment. Production v21 is not changed by this PR.
The SQL is additive and does not rewrite existing messages or Leads.

Before deployment, arrange an approved quiet/drained webhook window: old v21
workers do not honor tokens, so they must not overlap the new workers. Apply SQL
before deploying the new handler; do not use `schema.sql` on an existing database.
Keep automatic Supabase production synchronization OFF and Vercel Preview disabled.
No production migration, function deployment or integration change is authorized
by this document.

Lease recovery is on redelivery, not a new scheduler or background queue.
If Resend's retry window is exhausted, operator-approved redelivery is necessary.
An ambiguous lost response after commit is safe: the next delivery sees the
terminal message and deduplicates. Receipt time now records committed processing
(including ignored/partial), rather than a best-effort early update.
Historic partial writes from v21 are not deleted/repaired; retries refresh metadata
without changing existing user decisions.
