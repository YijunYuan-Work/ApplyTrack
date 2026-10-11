# Refinement 02 Audit Tests

These tests investigate the unchanged application. Tests named `BUG` characterize
known defects and intentionally assert current, incorrect behavior. Passing them
does NOT mean the product is defect-free. Approved fixes must replace the relevant
characterization with desired-behavior regression assertions.

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

Run browser and Vite SSR tests sequentially: Vite shares its dependency cache.
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

Evidence is generated under Git-ignored `test-results/`: responsive screenshots,
failure traces, sanitized performance/axe attachments and breakpoint observations.
Never commit traces from real authenticated sessions or real data. The report
maps every reproduced bug to a stable test title; artifacts can be regenerated.

CI runs the Node audit suite and Chromium audit suite in addition to existing
checks. Firefox, WebKit and Docker SQL tests remain explicitly local gates.
