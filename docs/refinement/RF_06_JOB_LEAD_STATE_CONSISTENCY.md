# RF-06: Job Lead State Consistency

Status: Completed; production migration independently verified (2026-10-12 America/Toronto).

## Fix and Rules

The conversion RPC locked the owned Lead, but returned an existing owned
Application before repairing the Lead's state. RF-05 already stopped ingestion
from writing user state; RF-06 fixes the remaining early-return defect.

- First conversion retains the existing Application mapping and date rules.
- A valid same-owner Application association means a successful confirmation
  sets the Lead to Applied, including a stale New or Expired state. Only state
  is repaired; the association and entire Application row remain unchanged.
- Retries return the same Application, ignoring a different supplied date. An
  already Applied retry does not issue an UPDATE or churn the Lead timestamp.
- The existing owner-scoped FOR UPDATE lock serializes conversions. RF-05's
  metadata-only ingestion updates serialize on the same Lead without overwriting
  state or the Application association; its lease and message transaction remain
  unchanged. Errors during repair propagate and roll back.
- No global invariant/trigger is added. Direct authorized state edits remain
  possible; repair happens only when the user confirms a valid linked Lead.
- Deleted Applications/null associations retain the existing behavior. No
  automatic recreation policy, historical bulk repair or new product rule is
  introduced; application-deletion UX remains a separate decision.

Migration `20261012025412_job_lead_state_consistency.sql` uses CREATE OR REPLACE
with the existing signature, SECURITY INVOKER and empty search path. It changes
no grants, RLS, ownership constraints, existing rows or RF-05 RPCs. The fresh
schema has the same five-line correction. No frontend or Edge source changed.

## Verification

The existing PostgreSQL 17 runner checks fresh schema and all migration replays.
Focused SQL assertions cover first conversion, unchanged repeated conversion,
New/Expired repair, complete preservation of edited Application data/date,
no-op Applied retries, write-failure rollback/retry and cross-user denial.
The existing eight-session lock barrier now asserts corrected stale-state repair.
The real handler/SQL suite additionally holds transactions behind catalog-observed
locks in both conversion-first and ingestion-first schedules, verifying Applied,
one Application, stable dates/ownership, successful message completion and duplicate
delivery. Existing RF-04 and RF-05 regressions remain enabled.

Migration replay snapshots prove existing data and the conversion RPC's owner/ACL
are unchanged by the migration. Fresh/replay definitions and anon/authenticated
access are compared. The image's pre-existing default service/admin grants differ
between databases; those baseline grants are preserved, not reconciled.

Host logs, caches and temporary files stay under Git-ignored
`tmp/rf06-tests.local`; browser artifacts use ignored `test-results/` and
`playwright-report/`, also within the workspace. The cached image
runs with no network/host ports, read-only root, disabled Docker logging and only
tmpfs writable data/socket/temp/log paths. The only host bind is the workspace
synthetic key script, read-only; both pgsodium and Vault use it instead of writing
key files. LF is pinned for that Linux fixture. No permanent backup keys/data,
Docker data volumes or other projects' containers are used.

Local results:

- `npm test`: 34 passed; `npm run test:audit`: 27 passed.
- `npm run test:audit-db`: passed on PostgreSQL 17.6. Each fresh/replay path
  ran 25 handler tests (14 mocked edge regressions and 11 real SQL-backed
  tests), focused RF-06 SQL assertions, RF-04 ownership/RLS/FK assertions
  and eight overlapping conversions. Both ingestion/conversion lock orders
  passed on both paths. All 12 migrations replayed successfully; definitions,
  constraints and applicable permissions matched the fresh schema.
- `npm run test:audit-ui -- --project chromium`: 22 passed.
- `npm run test:auth-ui`: 12 passed on an isolated full rerun, covering
  1440/768/390px. The initial run had one demo Progress heading timeout
  (11 passed); it did not recur. Its cause was not established; no unrelated
  frontend or test timeout changes were made.
- Lint, build and `git diff --check`: passed.

This is local synthetic evidence, not a production validation or RF-06 Done
claim. No existing characterization tests for unrelated findings were removed.

## Production Completion

With explicit user approval, the repository migration
`20261012025412_job_lead_state_consistency.sql` was applied to Supabase
project `qotipygmwlovxklkexjb`, and migration history records the exact
version `20261012025412` and name `job_lead_state_consistency`.

ChatGPT independently inspected the deployed conversion RPC: the same-owner
already-linked path now repairs stale New/Expired state before returning the
existing Application; the original row lock, invoker permissions and empty
search path remain. The production RPC is owned by `postgres` and executable
by `authenticated` and `service_role`, not by `anon`.

Read-only checks showed 629 Leads, 420 Applications, 31 valid linked Leads,
342 alert messages, and zero linked-state inconsistencies, cross-owner
associations, duplicate Lead keys, duplicate Application links or active
Processing messages. RF-04's composite ownership FK remains validated, RF-05's
two ingestion RPCs retain their application-role privileges, and the four
relevant tables still have RLS enabled. The `ingest-job-alert` function
remains ACTIVE v22 without redeployment.

GitHub merge CI passed and Vercel Production reached READY. Deterministic
local PostgreSQL tests cover retries and concurrency; no live production
conversion, simulated webhook or user data write was performed during
independent validation.

## Historical Release Boundary (Completed)



The required production SQL migration has been completed; no Edge Function
redeployment or frontend code change was necessary. Supabase automatic
production synchronization remains under its existing OFF hold. No additional
production operation is authorized by this report. Local PostgreSQL tests and
read-only production verification do not certify a live PostgREST HTTP flow.
