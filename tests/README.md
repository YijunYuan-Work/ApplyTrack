# Test Guide

See [Maintenance](../docs/MAINTENANCE.md) for release boundaries and
[Design System](../docs/DESIGN_SYSTEM.md) for the current responsive UI.

Tests are organized by responsibility, not the implementation phase that added
them. Existing assertions cover ownership, ingestion retries, mutation reliability,
selection, historical rejection dates, navigation, Demo passwords and salary parsing.
Historical finding IDs and release evidence remain in Git history and the
[maintenance records](../docs/MAINTENANCE.md#recorded-releases-and-data-contracts).

The non-finite interview-count characterization in
[`services/data-contracts.test.js`](services/data-contracts.test.js) still preserves
`Infinity`. This is a separate normalization correctness follow-up, not a claim
that normal UI or SQL inputs can persist that value.

## Structure

| Location | Responsibility |
| --- | --- |
| `browser/functional/` | Full browser regressions and locally scoped HTTP/data/interaction helpers. |
| `browser/auth/` | Separate authentication browser suite and synthetic Auth backend. |
| `services/` | Real Edge handler with controlled dependencies, inbox and source/data contracts. |
| `database/postgres/` | Isolated SQL fixtures, migration replay, synchronized races and runner. |
| `security/` | Recovery-retirement contracts and optional Windows synthetic ACL/encryption checks. |
| `diagnostics/` | Opt-in rendering measurements, outside mandatory CI discovery. |
| `fixtures/` | Cross-layer salary examples; browser-specific helpers stay beside their callers. |

Co-located Unit tests remain under `src/` and the shared alert parser. No suite
was split, merged or copied as part of the organization change.

## Run Locally

Requirements: Node 24, installed npm dependencies and Playwright browsers.
The separate SQL runner also requires PowerShell 7 and Docker Desktop.
Run from the repository root (on this Windows workspace,
`C:\Work\SideProject\ApplyTrack`):

```powershell
npm ci
npx playwright install chromium firefox webkit
npm test
npm run test:contracts
npm run test:auth
npm run test:browser -- --project chromium
npm run test:smoke
# Optional cross-engine local gate (all three configured engines):
npm run test:browser
npm run lint
npm run build
```

Run Auth, functional and smoke invocations sequentially; they share Vite's dependency
cache. Auth owns port 5193 and runs one Chromium worker. Functional tests own port
5195, default to one local worker and use two workers in CI. Files can run
concurrently, but cases within a file remain serial. Smoke owns port 5195 and uses
one worker for 7 existing `@smoke` cases each in Firefox and WebKit. None of the
suites reuses an existing server. There are still 241 Chromium functional cases
and 12 Auth cases, with no configured retries. Each test has isolated
context/backend state. Verify the selection without running tests or replacing
the HTML report (explicitly override the configured reporter):

```powershell
npm run test:smoke -- --project=firefox --list --reporter=list
npm run test:smoke -- --project=webkit --list --reporter=list
```

Never supply production credentials. Functional browser requests outside the
local Vite origin are intercepted: the backend at `127.0.0.1:54399` is mocked and
unexpected external requests are blocked. Job Agent navigation tests open an
intercepted synthetic posting/new tab, not a live LinkedIn or Indeed page. Demo
tests assert that simulated workflows do not send persistence/Auth requests.

To run a single case, use its file and a title fragment (not a new test copy):

```powershell
npm run test:browser -- status-mutations.spec.js --project=chromium --grep "late abandoned database write"
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
npm run test:database
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
real-handler/SQL ingestion tests. See [database/postgres/run.ps1](database/postgres/run.ps1)
for exact fixtures. Historical migration names, RPCs, `RF05_TEST_CONTAINER` /
`RF05_TEST_DATABASE`, container labels and cleanup checks are deliberately unchanged.

The optional [ACL](security/local-directory-acl.ps1) and
[encryption](security/age-encryption.mjs) scripts are not general backup tools or
CI gates. They retain their exact Windows workspace, synthetic-directory and
verified-tool requirements. Do not rewrite those guards or acquire missing tools
merely to run a naming-cleanup check.

Auth users are synthetic rows; bootstrap supplies minimal Auth/Storage contracts
and local grants. GoTrue, PostgREST and Storage HTTP services do not run. These
tests establish behavior under that fixture, not live production ACLs, hosted Auth,
Storage object recovery or production migration/deployment readiness.

## CI And Evidence

All three suites preserve the console list reporter and generate native HTML reports
without opening a browser automatically. Outputs are Git-ignored and isolated:

| Suite | HTML report | Raw test output | CI artifact |
| --- | --- | --- | --- |
| Functional | `playwright-report/functional/` | `test-results/functional/` | `playwright-functional-report` |
| Authentication | `playwright-report/auth/` | `test-results/auth/` | `playwright-auth-report` |
| Firefox/WebKit smoke | `playwright-report/smoke/` | `test-results/smoke/` | `playwright-smoke-report` |

Running one suite cannot clear another's report or raw evidence. A rerun of the
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
npx playwright show-report playwright-report/smoke --host 127.0.0.1
```

In the report, inspect the status/duration and open a test for source, steps,
errors and any attachments. A passing test does not necessarily have a screenshot
or trace. `trace: 'retain-on-failure'` keeps traces only for failed tests, without
adding retries. Responsive screenshots, axe/geometry JSON and breakpoint evidence
are produced by selected tests, not promised for every test.

### Download CI Evidence

Open this repository's **Actions > CI > the PR run**, verify its commit SHA and
scroll to **Artifacts**. Download and extract the functional, Auth or smoke artifact,
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
vary by test and browser; Auth/smoke traces use the `auth/` and `smoke/` subtrees.

All three HTML uploads use `if: always()`, so earlier test failures and skipped later
test/build steps do not prevent uploading an already generated report. No report
can be uploaded for a suite that never started or failed before generating one;
missing files are ignored rather than represented as passing results. Raw failure
evidence still uploads on job failure. All four artifacts expire after three days.

Use only synthetic fixture data. Never commit or upload traces from real accounts,
session credentials, private resumes, mail or production environments. Synthetic
test tokens are inert fixtures, not usable account credentials. Artifacts follow
GitHub repository access rules and must not be treated as secret storage. Local
report generation alone does not prove GitHub's artifact-upload step succeeded;
check the actual run and downloaded artifact before making that claim.

Every PR and push to `main` runs lint, 207 Unit, 30 service/security contracts,
the separate 12-case Auth suite,
the complete 241-case Chromium functional suite (two workers), 7 smoke cases each
in Firefox and WebKit (one worker), and build. Full Firefox/WebKit, SQL/Docker and
native Deno checks remain local gates; no critical Chromium coverage is deferred
to `main`. See [CI](../.github/workflows/ci.yml),
[functional config](../playwright.functional.config.js) and
[Auth config](../playwright.auth.config.js) and
[smoke config](../playwright.smoke.config.js). The
[QA case study](../docs/QA_AUTOMATION.md) explains three representative test designs.
