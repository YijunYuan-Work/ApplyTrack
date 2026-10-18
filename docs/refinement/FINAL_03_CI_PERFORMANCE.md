# Final-03: CI Performance

Base: main `45de218cb0747524e382e297d58ed303bd490c2c` (Final-02).
Recommendation: retain two file-level Chromium workers in CI, with one worker
for local defaults and the separate Auth suite. Local and GitHub results below
support the change without removing tests, weakening assertions or adding retries.

## Configuration And Isolation

Previously the functional config used one worker. The single GitHub quality job
runs on pull requests and main: unit/audit checks, separate Auth12, Chromium237,
then build. Auth has its own one-worker config and server port 5193; functional
tests use port 5195. No critical coverage is deferred to main-only jobs.

The only execution change is `workers: process.env.CI ? 2 : 1`, with an explicit
Node `process` import required by existing ESLint rules. Local defaults remain
serial, including normal multi-browser debugging. CI still selects Chromium.
`fullyParallel` remains false, retries remain zero, and timeouts are unchanged.

- Backend routes and mutable data are created per BrowserContext. There is no
  shared live backend listener on the synthetic port 54399.
- Cookies, storage, clocks, timezone options, pending requests and account state
  are context/page scoped. Workers have separate processes and browsers.
- One runner-owned Vite server serves unchanged application files. It is not
  created once per worker; dependency optimization remains inside that server.
- Most artifacts use `testInfo.outputPath`. Legacy fixed screenshot names live
  in distinct RF-07/08/09 directories and are unique per width within each file.
  Files can overlap; tests inside each file remain serial. This analysis covers
  the existing single-Chromium CI command, not simultaneous multi-engine runs.
- Clipboard replacements are page-local; BroadcastChannel/session tests run in
  isolated contexts. Native dialogs and keyboard events are page-scoped.
- Download files use test-specific paths or in-memory buffers. No suite-global
  database, account, persistent storage state, server port or output file was
  found that needs an isolation refactor for the proposed scheduling.

The baseline records SHA256 hashes of 137 tracked files. All 136 test/application/
backend/dependency/Auth-config files remain identical; the workflow only gains
the failure-evidence step described below. No test body or assertion changes,
including all nine Final-01 Sign Out and twelve Auth cases.

## Measurements

Primary one-worker baseline is merged main
[39172399030](https://github.com/YijunYuan-Work/ApplyTrack/actions/runs/39172399030):
**1048s (17m28s)** functional, 40s Auth, **1131s (18m51s)** job; all 237+12 passed.
This run completed while local evaluation was already underway; it did not
block starting the task. A second completed baseline is
[39170000004](https://github.com/YijunYuan-Work/ApplyTrack/actions/runs/39170000004),
commit `d68c0d65266ad4685c9e5fd9bf17a44e0d2da919`. Its protected sources/config are
identical to merged main. Chromium237 and Auth12 passed: functional step
**939s (15m39s)**, Auth step 35s, complete job **1022s (17m02s)**.
The difference between these one-worker runs illustrates runner/run variance.

Local Windows benchmark: Node 24.16.0, Playwright 1.62.1, 20 logical CPUs,
31.82 GiB RAM. Each run starts a fresh Vite server and browsers; the Vite cache
is retained. Order: two-worker A (cold cache), one worker, two-worker B.
Identical debug logging and five-second owned-process-tree sampling are used.
No benchmark overlaps another local browser/check run.

| Run | Workers | Command wall | Playwright elapsed | Passed | Failed/skipped/flaky/retries/timeouts |
| --- | ---: | ---: | ---: | ---: | --- |
| Two-worker A | 2 | 368.129s | 367.715s | 237 | 0/0/0/0/0 |
| One-worker comparison | 1 | 680.927s | 680.517s | 237 | 0/0/0/0/0 |
| Two-worker B | 2 | 358.074s | 357.679s | 237 | 0/0/0/0/0 |

All **711/711** local functional executions passed. Both two-worker runs had
exactly two worker indices and two active tests, versus one for the control.
The mean two-worker elapsed time was **46.7% shorter locally**.

Sampled summed process-tree RSS peaks: **1.38 GiB** (one), **2.45/2.03 GiB** (two).
Private-byte peaks: 1.28 GiB and 2.72/1.71 GiB respectively. Available system RAM
remained at least 13.58 GiB. All 250 sampling records succeeded. These approximate
five-second process sums can double-count shared RSS and miss instantaneous
peaks; they are not unique physical-memory usage or measurements of CI limits.

Native GPU mailbox stderr counts were **15** (one), **12/13** (two), with no
associated local test failure or crash. Logs contained no matched uncaught JS,
Vite internal/import error, fatal/OOM message or nonzero browser exit; reports
had no runner errors. Injected application/HTTP failures remain expected test
behavior. GPU diagnostics are retained, not suppressed, and do not establish
the cause of the separate CI screenshot failure below.

Actual two-worker CI
[39174353894](https://github.com/YijunYuan-Work/ApplyTrack/actions/runs/39174353894),
commit `0d947cdd6b8ef5670fb3f0c9a71a0afe9cd96d61`, passed every quality gate:
**615s (10m15s)** functional, 40s Auth, **697s (11m37s)** job. Logs explicitly
confirm 237 tests using two workers, 237 passed, Auth12, Unit207 and Audit30.
This is **41.3% shorter functional time / 38.4% shorter job time** than merged
main's one-worker baseline, and 34.5% shorter functional time than the earlier
one-worker PR baseline. Hosted-runner/run variance remains; this is an observed
comparison, not a guaranteed speedup. No CI peak-memory figure is claimed.

## CI Screenshot Failure Investigation

Candidate [39173589065](https://github.com/YijunYuan-Work/ApplyTrack/actions/runs/39173589065)
failed before functional execution: unchanged one-worker Auth had 11 passed,
one failed at `page.screenshot` for 390px Sign In, with CDP
`Page.captureScreenshot: Unable to capture screenshot`. The functional and build
steps were not run; this is **not** a two-worker measurement. The original job
uploaded no trace artifacts, so the screenshot failure's root cause is unconfirmed.
It is not dismissed as flaky or attributed to the worker change.

To retain diagnostic evidence, the existing quality job now uses the official
[upload-artifact action](https://github.com/actions/upload-artifact#usage) only
on failure, uploading `test-results/` for three days. No permission escalation,
new job, browser flag, animation override, test retry, screenshot removal or
assertion change is introduced. The subsequent complete CI run above passed;
that does not establish the original failure's cause. Its failure-only upload
step was correctly skipped on success; an actual upload is not yet exercised.
The original twelve Auth tests also passed two additional complete local runs
(24/24 in 49.403s, zero retries/skips/flaky results). This did not reproduce the
CI protocol error and does not establish its root cause.

## Checks And Reproduction

Auth12, Unit207, Audit30, lint and production build passed after the config change.
The existing large-chunk build warning remains outside this task's scope.

```powershell
npm run test:audit-ui -- --project=chromium --workers=1
npm run test:audit-ui -- --project=chromium --workers=2
npm run test:auth-ui
npm test
npm run test:audit
npm run lint
npm run build
```

Ignored evidence is under `tmp/final-03.local/`: discovery inventories, protected
source hashes, Playwright JSON reports, browser/Vite logs, process samples and
CI logs/timings. Local wrappers only isolate evidence/cache paths, pin the Vite
entry to `index.html`, and exclude ignored toolchain directories from watching;
they do not alter test discovery, assertions, timeouts or browser options.

## Stability And Remaining Limits

Two complete local two-worker runs plus the actual two-worker GitHub run passed
all 237 tests, with no observed concurrency-specific failure. The local control
also passed all 237. Keep the bounded CI-only two-worker setting; do not enable
within-file parallelism. No sharding, additional jobs, retries, npm dependencies
or coverage reduction is introduced. The final report update changes no tested
execution configuration, application or test code.

The functional suite remains the dominant cost; browser installation, Auth,
Vite/browser startup, full-page axe/screenshots and long file-level groups impose
overhead or a scheduling tail. The measured local two-worker final tails were
20.790s/25.514s after the other worker finished; individual axe/screenshot costs
were not separately profiled. No claim is made for more than two workers or
simultaneous multi-engine CI. Background load and runner hardware vary. CI peak
RAM is not sampled, and the Auth screenshot root cause remains unconfirmed.

No application/UI, Auth policy, database, Supabase, Edge Function or deployment
configuration changes. No production operation, manual deployment or merge.
