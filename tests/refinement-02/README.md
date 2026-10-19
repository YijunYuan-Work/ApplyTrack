# Refinement Regression Tests

This directory began as the Refinement 02 audit. Fixed findings now assert the
desired behavior, including ownership, ingestion retries and terminal states,
mutation reliability, selection, historical rejection dates, responsive navigation,
Demo passwords and salary parsing. Finding numbers in test titles are traceability
labels, not evidence that those bugs remain open.

The non-finite interview-count characterization in `logic.test.js` still preserves
`Infinity`. This is a separate normalization correctness follow-up, not a claim
that normal UI or SQL inputs can persist that value.

## Run Locally

Requirements: Node 24, installed npm dependencies and Playwright browsers.
The separate SQL runner also requires PowerShell 7 and Docker Desktop.
Run from `C:\Work\SideProject\ApplyTrack`:

```powershell
npm ci
npx playwright install chromium firefox webkit
npm test
npm run test:audit
npm run test:auth-ui
npm run test:audit-ui -- --project chromium
# Optional cross-engine local gate (all three configured engines):
npm run test:audit-ui
npm run lint
npm run build
```

Run Auth and functional invocations sequentially; they share Vite's dependency
cache. Auth owns port 5193 and runs one Chromium worker. Functional tests own port
5195, default to one local worker and use two workers in CI. Files can run
concurrently, but cases within a file remain serial. Neither suite reuses an
existing server. There are currently 237 Chromium functional cases and 12 Auth
cases, with no configured retries. Each test has isolated context/backend state.

Never supply production credentials. Functional browser requests outside the
local Vite origin are intercepted: the backend at `127.0.0.1:54399` is mocked and
unexpected external requests are blocked. Job Agent navigation tests open an
intercepted synthetic posting/new tab, not a live LinkedIn or Indeed page. Demo
tests assert that simulated workflows do not send persistence/Auth requests.

## Edge And Database Coverage

The Edge harness executes the real TypeScript handler, real parser/linkedom, and
real Resend Svix verification under Node's experimental VM/TypeScript stripping
APIs. Database calls and inbound email retrieval are controlled fixtures. `fetch`
throws instead of allowing external network access. It is NOT a hosted Deno or
Resend integration test.

```powershell
# Explicitly acquire the pinned image before the runner, if not cached:
docker pull public.ecr.aws/supabase/postgres:17.6.1.166
npm run test:audit-db
```

The SQL runner creates only its own uniquely named/labeled PostgreSQL 17 container:
network disabled, no host ports, read-only root filesystem, tmpfs database/logs and
one read-only bind of `synthetic-getkey.sh`. It checks mounts and removes only its
own labeled container in `finally`; it does not pull images automatically. Its
absolute workspace check makes it a Windows local gate, not an Ubuntu CI drop-in.

It tests both the canonical schema and historical migration replay. Replay supplies
the original application-table baseline (not created by the nine original
migrations), then exercises RF-04 ownership constraints/failure atomicity, RF-05
atomic claims/retries/leases, RF-06 conversion state consistency, and RF-12 nullable
rejection dates. It compares fresh/replayed constraints, RPC definitions and
execution permissions, and runs synchronized conversion/ownership races plus the
real-handler/SQL ingestion tests. See `database/run.ps1` for exact fixtures.

Auth users are synthetic rows; bootstrap supplies minimal Auth/Storage contracts
and local grants. GoTrue, PostgREST and Storage HTTP services do not run. These
tests establish behavior under that fixture, not live production ACLs, hosted Auth,
Storage object recovery or production migration/deployment readiness.

## CI And Evidence

Evidence is generated under Git-ignored `test-results/`: responsive screenshots,
failure traces, sanitized performance/axe attachments and breakpoint observations.
Never commit traces from real authenticated sessions or real data. The report
maps every reproduced bug to a stable test title; artifacts can be regenerated.

Every PR and push to `main` runs lint, Unit, Audit, the separate 12-case Auth suite,
the complete 237-case Chromium functional suite (two workers), and build.
Firefox/WebKit, SQL/Docker and native Deno checks remain local gates; no critical
Chromium coverage is deferred to `main`. CI retains browser failure artifacts for
three days. See `.github/workflows/ci.yml` and the two Playwright configs.
