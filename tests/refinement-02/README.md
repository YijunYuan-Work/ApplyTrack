# Refinement Regression Tests

See [Maintenance](../../docs/MAINTENANCE.md) for release boundaries and
[Design System](../../docs/DESIGN_SYSTEM.md) for the current responsive UI.

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
Run from the repository root (on this Windows workspace,
`C:\Work\SideProject\ApplyTrack`):

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
existing server. There are currently 241 Chromium functional cases and 12 Auth
cases, with no configured retries. Each test has isolated context/backend state.

Never supply production credentials. Functional browser requests outside the
local Vite origin are intercepted: the backend at `127.0.0.1:54399` is mocked and
unexpected external requests are blocked. Job Agent navigation tests open an
intercepted synthetic posting/new tab, not a live LinkedIn or Indeed page. Demo
tests assert that simulated workflows do not send persistence/Auth requests.

To run a single case, use its file and a title fragment (not a new test copy):

```powershell
npm run test:audit-ui -- status-mutations.spec.js --project=chromium --grep "late abandoned database write"
```

The full commands above run every existing case; the targeted invocation is a
debugging aid, not a replacement CI gate. Diagnostic measurements under
`tests/diagnostics` are opt-in via `playwright.diagnostics.config.js`, stay
console-only, and use a separate output folder.

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
real-handler/SQL ingestion tests. See [database/run.ps1](database/run.ps1) for exact fixtures.

Auth users are synthetic rows; bootstrap supplies minimal Auth/Storage contracts
and local grants. GoTrue, PostgREST and Storage HTTP services do not run. These
tests establish behavior under that fixture, not live production ACLs, hosted Auth,
Storage object recovery or production migration/deployment readiness.

## CI And Evidence

Both suites preserve the console list reporter and generate native HTML reports
without opening a browser automatically. Outputs are Git-ignored and isolated:

| Suite | HTML report | Raw test output | CI artifact |
| --- | --- | --- | --- |
| Functional | `playwright-report/functional/` | `test-results/functional/` | `playwright-functional-report` |
| Authentication | `playwright-report/auth/` | `test-results/auth/` | `playwright-auth-report` |

Running one suite cannot clear the other's report or raw evidence. A rerun of the
**same** suite replaces that suite's local report; copy it to an ignored directory
first if you need to preserve a previous run. Existing tests sometimes also write
ad hoc screenshots under ignored `tmp/`; only attached/copied report evidence and
files in uploaded output directories travel with the CI artifacts.

### View Reports Locally

After running the relevant suite:

```powershell
npx playwright show-report playwright-report/functional --host 127.0.0.1
# Stop that viewer with Ctrl+C before viewing the other report on its default port:
npx playwright show-report playwright-report/auth --host 127.0.0.1
```

In the report, inspect the status/duration and open a test for source, steps,
errors and any attachments. A passing test does not necessarily have a screenshot
or trace. `trace: 'retain-on-failure'` keeps traces only for failed tests, without
adding retries. Responsive screenshots, axe/geometry JSON and breakpoint evidence
are produced by selected tests, not promised for every test.

### Download CI Evidence

Open this repository's **Actions > CI > the PR run**, verify its commit SHA and
scroll to **Artifacts**. Download and extract the functional or Auth artifact,
then point `npx playwright show-report` at the extracted folder containing
`index.html`. Keep the `data/` folder beside it for attachments. Opening through
the local viewer is preferable to double-clicking `index.html`.

When the job fails, `browser-failure-traces` also contains the raw `test-results/`
tree. After extracting, open an actual retained trace (substitute its path):

```powershell
npx playwright show-trace "path/to/extracted/functional/failed-test/trace.zip" --host 127.0.0.1
```

Inspect the failed action/assertion, DOM snapshot and synthetic network responses.
This local viewer needs no public upload or report-hosting service. Trace paths
vary by test and browser; Auth traces are under the `auth/` subtree instead.

Both HTML uploads use `if: always()`, so earlier test failures and skipped later
test/build steps do not prevent uploading an already generated report. No report
can be uploaded for a suite that never started or failed before generating one;
missing files are ignored rather than represented as passing results. Raw failure
evidence still uploads on job failure. All three artifacts expire after three days.

Use only synthetic fixture data. Never commit or upload traces from real accounts,
session credentials, private resumes, mail or production environments. Synthetic
test tokens are inert fixtures, not usable account credentials. Artifacts follow
GitHub repository access rules and must not be treated as secret storage. Local
report generation alone does not prove GitHub's artifact-upload step succeeded;
check the actual run and downloaded artifact before making that claim.

Every PR and push to `main` runs lint, Unit, Audit, the separate 12-case Auth suite,
the complete 241-case Chromium functional suite (two workers), and build.
Firefox/WebKit, SQL/Docker and native Deno checks remain local gates; no critical
Chromium coverage is deferred to `main`. See [CI](../../.github/workflows/ci.yml),
[functional config](../../playwright.audit.config.js) and
[Auth config](../../playwright.auth.config.js). The
[QA case study](../../docs/QA_AUTOMATION.md) explains three representative test designs.
