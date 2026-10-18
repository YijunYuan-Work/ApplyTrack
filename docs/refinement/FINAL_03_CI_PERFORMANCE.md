# Final-03: CI Performance

Base: main `45de218cb0747524e382e297d58ed303bd490c2c` (Final-02).
Working benchmark report: local one-worker comparison, second two-worker run and
candidate GitHub CI measurements are still in progress. The PR remains Draft.

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
- Download files use test-specific paths or in-memory buffers. No suite-global
  database, account, persistent storage state, server port or output file was
  found that needs an isolation refactor for the proposed scheduling.

All 137 tracked test/application/backend/dependency/workflow/Auth-config files
are SHA256 protected during local benchmarking. No test body or assertion is
changed, including all nine Final-01 Sign Out and twelve Auth cases.

## Measurements

Existing completed one-worker CI baseline:
[39170000004](https://github.com/YijunYuan-Work/ApplyTrack/actions/runs/39170000004),
commit `d68c0d65266ad4685c9e5fd9bf17a44e0d2da919`. Its protected sources/config are
identical to merged main. Chromium237 and Auth12 passed: functional step
**939s (15m39s)**, Auth step 35s, complete job **1022s (17m02s)**.
The new merged-main CI was not awaited before starting this work.

Local Windows benchmark: Node 24.16.0, Playwright 1.62.1, 20 logical CPUs,
31.82 GiB RAM. Each run starts a fresh Vite server and browsers; the Vite cache
is retained. Order: two-worker A (cold cache), one worker, two-worker B.
Identical debug logging and five-second owned-process-tree sampling are used.
No benchmark overlaps another local browser/check run.

| Run | Workers | Playwright elapsed | Passed | Failed/skipped/flaky/retries/timeouts |
| --- | ---: | ---: | ---: | --- |
| Two-worker A | 2 | 367.715s | 237 | 0/0/0/0/0 |
| One-worker comparison | 1 | Pending | Pending | Pending |
| Two-worker B | 2 | Pending | Pending | Pending |

Run A observed two active tests, exactly two worker indices and no runner errors.
Peak summed process-tree RSS was 2.45 GiB, private bytes 2.72 GiB; system available
RAM remained at least 13.58 GiB. Shared RSS can be counted more than once, so this
is a conservative process sum, not unique physical memory consumption.

Native Chromium GPU mailbox diagnostics appeared in debug stderr, without test
failure or browser crash. They are retained for comparison with one worker,
not suppressed or assumed to be caused by concurrency. Application/HTTP failures
deliberately injected by existing tests are not classified as infrastructure
failures. Complete baseline/repeat log analysis is pending.

Local times are not GitHub CI speedup measurements. Candidate CI timing is
pending; no claim of a measured CI improvement is made yet.

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

## Provisional Recommendation And Boundaries

Two CI workers are a candidate, not yet a final stability conclusion. Confirm
the fresh baseline, repeated complete run and real GitHub execution before
marking the PR ready. Scheduling remains file-level; no sharding, additional
jobs, retries, dependencies or coverage reduction is proposed.

No application/UI, Auth policy, database, Supabase, Edge Function or deployment
configuration changes. No production operation, manual deployment or merge.
