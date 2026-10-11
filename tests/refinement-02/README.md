# Refinement 02 Audit Tests

These tests began as the Refinement 02 baseline audit. Tests named `BUG` characterize
known defects and intentionally assert current, incorrect behavior. Passing them
does NOT mean the product is defect-free. Approved fixes must replace the relevant
characterization with desired-behavior regression assertions. RF-03 replaces the
F02/F03 notes characterizations with lossless/nullable regression assertions and
adds create/edit coverage at desktop, tablet and phone widths.
RF-04 replaces F01's cross-owner-association characterization with a rejection
regression and extends the real SQL runner; F05's stale-state characterization
is intentionally unchanged.

## Run Locally

Requirements: Node 24, npm dependencies, PowerShell 7, Docker Desktop for SQL tests.
All commands run from `C:\Work\SideProject\ApplyTrack`.

```powershell
npm ci
npx playwright install chromium firefox webkit
npm test
npm run test:audit
npm run test:auth-ui
npm run test:audit-ui
docker pull public.ecr.aws/supabase/postgres:17.6.1.166
npm run test:audit-db
npm run lint
npm run build
npm audit --audit-level=high
```

Run browser suites sequentially: Vite shares its dependency cache. RF-03 tests
import the production row mappers directly without Vite SSR or Supabase setup.
Browser suites reserve ports 5193 (existing auth) and 5195 (audit), refuse to reuse
an existing server, and start their own synthetic environment. Never supply
production credentials. All audit browser requests outside the local Vite origin
are intercepted; only the synthetic backend at `127.0.0.1:54399` is mocked.
Job URLs are never opened. Public demo workflows assert that no backend requests occur.

The Edge harness executes the real TypeScript handler, real parser/linkedom, and
real Resend Svix verification under Node's experimental VM/TypeScript stripping
APIs. Database calls and inbound email retrieval are controlled fixtures. `fetch`
throws instead of allowing external network access. It is NOT a hosted Deno or
Resend integration test.

SQL tests create a uniquely named, labeled, network-disabled Supabase PostgreSQL
17 container with tmpfs data and no host ports or bind mounts. Only that container
is removed in `finally`. The cached image must already exist; the runner does not
pull automatically. Synthetic users are inserted directly; GoTrue, PostgREST and
Storage HTTP services do not run. `bootstrap.sql` supplies a minimal Storage
schema/API contract and local default grants. Consequently, this proves database
policy/RPC behavior under that fixture, not production grants or Storage service
behavior. Historical migration replay first supplies the application-table
baseline from `schema.sql`, because the nine migrations do not create that table.
RF-04 restores that pre-RF-04 application constraint baseline, replays all nine
historical migrations unchanged, seeds valid legacy associations, then applies
`20261011042500_job_lead_ownership_integrity.sql`. Fresh and incremental databases
run the same ownership/role/RPC assertions, eight concurrent conversions each,
and two lock-synchronized owner-change races each. Constraint catalog definitions
are compared between both paths. Separate synthetic databases prove that a
cross-owner link, an orphaned link and nullable-owner schema drift fail the
migration without altering existing data, grants, policies or RPCs. Successful
migration also compares complete legacy rows and those security definitions.
See [RF-04 release runbook](../../docs/refinement/RF_04_OWNERSHIP_MIGRATION_RUNBOOK.md)
for the production approval boundary and test limitations.

Evidence is generated under Git-ignored `test-results/`: responsive screenshots,
failure traces, sanitized performance/axe attachments and breakpoint observations.
Never commit traces from real authenticated sessions or real data. The report
maps every reproduced bug to a stable test title; artifacts can be regenerated.

CI runs the Node audit suite and Chromium audit suite in addition to existing
checks. Firefox, WebKit and Docker SQL tests remain explicitly local gates.
