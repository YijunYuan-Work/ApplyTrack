# Maintenance

Current repository guidance replaces the completed Refinement/UI 2.0 roadmaps.
Historical details remain in Git and merged PRs, not an active task queue.
This documentation cleanup does not inspect or certify current production state.

## Development and Verification

Use Node.js 24, the committed [package scripts](../package.json) and lockfile:

```powershell
npm ci
npm run lint
npm test
npm run test:contracts
npx playwright install chromium firefox webkit
npm run test:auth
npm run test:browser -- --project chromium
npm run test:smoke
npm run build
git diff --check
```

[CI](../.github/workflows/ci.yml) runs these quality gates on PRs and `main`:
207 Unit, 30 service/security contracts, 12 separate Chromium Auth, 241 Chromium functional cases and
7 smoke cases each in Firefox/WebKit. Functional CI uses two workers; smoke and
local multi-browser runs use one. Do not remove critical PR coverage, add retries
to hide failures or run Vite-owning suites simultaneously. See the
[test guide](../tests/README.md) for
ports, local Firefox/WebKit/SQL commands and fixture limitations.

Use synthetic accounts/data for tests. Keep screenshots/traces, local toolchains
and temporary artifacts ignored inside the workspace; never commit real sessions,
resumes, email contents, credentials or database exports. On this Windows checkout,
old ignored tool trees can slow Vite scanning/watching; keep local evidence isolated
without weakening assertions/timeouts or changing CI just to mask a local problem.

## Database and Release Boundaries

Recorded production project: `qotipygmwlovxklkexjb` (ApplyTrack), not a development
target. Reconfirm identity and current state at any separately approved release.

- **Keep Supabase GitHub Integration `Deploy to production` OFF.** This was
  deliberately disabled and recorded during SEC-02, not re-read by this task.
  Reconfirm writer/queue isolation before a backend release; a GitHub check alone
  is not proof that a deployment writer is inactive. Re-enabling synchronization
  needs a separate reviewed authorization.
- Production SQL, migration/history changes, Edge deploy/delete, permission,
  Auth, secret and integration changes require explicit approval naming the target
  and exact operation. A documentation merge is not that approval. Routine repo
  work must not enable paid services or manually trigger Vercel/Preview deployments.
- [schema.sql](../supabase/schema.sql) is the fresh-Supabase-project schema, not an
  existing-production upgrade script; it includes data updates and policy creation.
  It assumes Supabase Auth/Storage roles and helpers. The
  [migration chain](../supabase/migrations) alone is **not** a standalone bootstrap:
  the original nine migrations assume an Applications table. The local SQL runner
  supplies that historical baseline deliberately. Do not run the final schema and
  then blindly replay every historical migration or rewrite migration history.
- For an approved existing-project release, confirm project identity, exact
  checkout, matching history and only the approved pending migrations via CLI
  list/dry-run. Review transaction/failure and exact-version registration behavior
  for the installed CLI before writing. Stop on drift/partial failure; do not
  invent repairs. Verify catalog, RLS/ACL, history and existing data read-only afterward.
- The only repository Edge Function is
  [ingest-job-alert](../supabase/functions/ingest-job-alert/index.ts), with
  [`verify_jwt=false`](../supabase/config.toml) for a **signature-verified Resend
  webhook**, not unauthenticated trust. Browser configuration is public; service
  credentials and the values described in the
  [server env example](../supabase/functions/.env.example) stay server-side.
  Backend changes need native Deno/import/runtime checks, shared-parser inclusion
  and a separately approved function-specific release. Never blanket-deploy functions.

## Recorded Releases and Data Contracts

These are recorded completion facts, not a new live verification. Do not rerun
them because an older report described a pending stage.

| Completed change | Migration / operational fact |
| --- | --- |
| SEC-02 recovery retirement | `request-password-reset` was removed from the production function inventory after PR #11. Its source/config remain absent; never restore historical code or a public requester without separate approval. |
| RF-04 same-owner Lead associations | [20261011042500_job_lead_ownership_integrity.sql](../supabase/migrations/20261011042500_job_lead_ownership_integrity.sql) was registered and verified. Composite `(user_id, application_id)` FK replaces the old single-ID FK; deletion nulls only `application_id`, preserving owner/state. |
| RF-05 ingestion reliability | [20261012005112_job_alert_processing_reliability.sql](../supabase/migrations/20261012005112_job_alert_processing_reliability.sql) was registered and released with ingest v22 at that time. Atomic claim/finish RPCs are service-role-only; failed writes must remain retryable, and terminal leads must not be downgraded. |
| RF-06 conversion consistency | [20261012025412_job_lead_state_consistency.sql](../supabase/migrations/20261012025412_job_lead_state_consistency.sql) was registered and verified; retries reuse the linked Application, repair stale Lead state and preserve its original applied date. |
| RF-12 rejection dates | [20261014033558_application_rejection_date.sql](../supabase/migrations/20261014033558_application_rejection_date.sql) was registered before the frontend release. Nullable DATE, no default/backfill; unrelated edits preserve it, reopening retains it, a later confirmed rejection replaces it. |

Rejection dates represent local date-only recorded transitions, not necessarily
the employer's original decision date. New/imported Rejected records stay NULL
unless a valid explicit rejection date is supplied.

Ingestion lease recovery depends on webhook redelivery; expiry alone does not run
a background retry. No scheduler or external queue is provisioned.

SEC-02's completion inventory did not prove every future writer impossible. Its
stale-check/queue uncertainty was accepted for that deletion only. If the retired
function reappears, stop releases and investigate; do not auto-restore or redeploy.
Keep shared Supabase/Resend secrets needed by ingestion. Preserve historical
recovery metadata, supported valid-token handling and authenticated password updates.

Recorded evidence: [SEC-02 completion](https://github.com/YijunYuan-Work/ApplyTrack/blob/f5c0aea34b20df43c89601e7275f1a8f2f4fc2ef/docs/refinement/SEC_02_RETIREMENT_RUNBOOK.md#g-production-retirement-completion-record-2026-10-11-utc),
[RF-04 completion](https://github.com/YijunYuan-Work/ApplyTrack/blob/f5c0aea34b20df43c89601e7275f1a8f2f4fc2ef/docs/refinement/RF_04_OWNERSHIP_MIGRATION_RUNBOOK.md#production-completion-record-2026-10-11-americatoronto)
and [release records](https://github.com/YijunYuan-Work/ApplyTrack/blob/f5c0aea34b20df43c89601e7275f1a8f2f4fc2ef/docs/refinement/REFINEMENT_MASTER_PLAN.md).
These pinned records retain historical context, not standing execution instructions
or assertions about today's function version, row counts or cloud settings.

## Outstanding Maintenance and Limits

- **Permissions:** the earlier production review found broad Applications table
  grants/default ACLs, including TRUNCATE/TRIGGER/MAINTAIN. Its proposed
  [least-privilege SQL](https://github.com/YijunYuan-Work/ApplyTrack/blob/f5c0aea34b20df43c89601e7275f1a8f2f4fc2ef/docs/refinement/PRODUCTION_PRIVILEGE_REVIEW.md)
  **was not applied**. RLS-scoped REST CRUD is not proof that all SQL permissions
  are minimal; nor do broad grants alone prove an anonymously reachable exploit.
  Any hardening needs refreshed catalog/authority/compatibility checks and approval.
- **Backup readiness:** prior RF-04 backup stages were synthetic only; encrypted
  confidential-data storage, permanent key custody and actual managed-schema
  restoration were not established. No production-ready backup tool is shipped.
  A future export/real-data restore needs its own approval and verified encrypted,
  access-restricted storage, temp/spill protection and offline restore rehearsal.
  Define public, Auth users/identities/sessions/tokens, Storage metadata and
  migration-history scope explicitly with a consistent snapshot and security
  manifest. A default CLI dump must not be assumed to cover these; SQL archives
  do not contain Storage object bytes, service secrets/configuration or all global
  roles. A plain dump followed by encryption may expose plaintext first.
  Prior backup waivers were release-specific, not a general waiver. See the
  [historical readiness limits](https://github.com/YijunYuan-Work/ApplyTrack/blob/f5c0aea34b20df43c89601e7275f1a8f2f4fc2ef/docs/refinement/RF_04_SECURE_BACKUP_ENVIRONMENT.md#cleanup-rollback-and-remaining-gates).
- **Loaded data:** Applications retrieval is not server-paginated; Dashboard and
  Progress completeness is limited by the server result cap. Job Agent uses its
  separate paginated/count-checked queue. No production truncation count is claimed.
- **Validation/history:** the schema does not universally constrain nonblank names,
  allowed status values or nonnegative interview rounds; the normalizer still
  retains `Infinity`. Direct SQL/third-party/old clients do not enforce first-party
  rejection-date semantics. Unknown dates stay unknown. New constraints, backfills
  or universal enforcement need a separate compatibility decision; existing
  production corruption is not asserted.
- **Imports/removal:** an ambiguous import commit is not automatically idempotent;
  check Dashboard before retrying. Removing a Lead is not permanent suppression:
  a later alert can recreate it. Do not bulk-repair deleted-Application links or
  invent tombstone semantics without a product decision.
- **Parser/dependencies:** email templates and the floating Edge SDK import may
  drift. Use sanitized provider fixtures; salary parsing is conservative, does not
  annualize hourly/monthly values, and does not repair stored historical bounds.
  Review the [dependency policy](security/dependency-security.md). The retained
  unused resume parser/dependencies are not a supported upload feature.
- **Verification/performance:** synthetic HTTP/SQL tests do not certify hosted
  Auth/Storage/Resend, physical devices or screen readers. Full Firefox/WebKit,
  native Deno and PostgreSQL tests remain local gates beyond the CI smoke subset.
  The existing build chunk-size
  warning and an isolated historical CI screenshot failure with unconfirmed cause
  are not grounds to weaken tests or suppress failure evidence. Initial account
  load and Dashboard effects can also duplicate Job Agent summary requests;
  optimization remains separate from the completed correctness work.
