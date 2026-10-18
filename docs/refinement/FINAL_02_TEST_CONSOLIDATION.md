# Final-02: Test Suite Consolidation

Base: main `fae90cf684454567adfae7fbac654a4f3bd3fe52` (Final-01, PR #34).
Scope: tests and documentation only. Application sources, dependencies, CI jobs,
worker count, authentication policy and production services are unchanged.

## Coverage Ownership

The local Final Audit proposals were checked against current test bodies, not
applied as an automatic deletion list. Full visual workflows use 390/768/1440px;
lightweight live-resize/iframe probes cover structural and fractional boundaries.

| Removed execution group | Retained owner / assertion transfer |
| --- | --- |
| Audit F09 Board 25 Select All/Unselect All | Dashboard selection: visible Board scope, List paging, union/deduplication and exact deletion IDs; fractional Dashboard scope checks. |
| Audit F10 bulk cancellation and failed deletion | Delete mutations: Board/List cancellation, no DELETE, exact retained checkboxes, accessible alert, failure/retry and refresh persistence. |
| Audit F04 two queued status intents | Status mutations FIFO regression: three queued intents, optimistic Rejected selection (added before removal), exact partial payloads, dates/rounds and refresh. |
| Audit F12 Demo create/navigate/Profile restrictions | Real/Demo literal Notes create/edit test, form-save validation and retained integrated Demo workflow; UI-05 keyboard tour checks all password/account restrictions. |
| Audit Excel duplicate/failure/retry | UI-05 actual drag/drop, duplicate selection, zero-write cancellation, pending/failure/retry, exact multiline label-like Notes in POST **and reopened editor** (transferred), explicit historical rejection date. |
| Audit 501-row Remove All | Job queue retains 0/1/499/500/501/1203 rows, global removal, partial failure, retry, server caps and refresh. |
| Audit three-size Demo navigation | UI-05 three-size whole-app tour now uses keyboard navigation, focus outlines, Setup/Matches, Add form, account restrictions, no Sign Out, zero backend/blocked requests and settled whole-page axe. |
| Audit integer Sign Out probe | Responsive navigation live resizing and fractional shell tests retain one visible exit, active nav, touch bounds/hit tests, session preservation and overflow. |
| Audit 1000-row informational axe/performance | Enforced settled whole-page axe in Dashboard/editor, Progress Map/Calendar, Profile/Import, Agent Setup and Demo route tour; optional rendering diagnostic outside mandatory testDir. |
| Audit Notes create/edit at desktop/tablet | Literal Notes Real/Demo round trips retained at 390px; full editor geometry/fields and CRUD remain at all three representative sizes. |
| Dashboard selection eight-size Board matrix | Three representative sizes; mobile stage semantics, live 640px scope and fractional Board selection remain. Demo selection keeps desktop/mobile plus global three-size Demo tour. |
| Dashboard UI seven-size full drawer/editor workflow | Three sizes; original fractional Board probe additionally checks 1279.5/1280.5 List location/interview visibility and 639.5/640.5/1039.5/1040.5 drawer dimensions. Native dialog focus trap, return focus and axe remain. |
| Demo Profile repeated width matrix | Dedicated phone Demo reload/account restriction and desktop real password validation/failure/retry; global Demo tour and Auth12 retain responsive coverage. |
| Navigation-shell three-size Demo tour | UI-05 tour retains whole-shell reduced motion, keyboard route activation, shell/header accessibility through full-page axe, and no requests. Normal-motion indicator and **768x440 keyboard Sign Out** remain separate. |
| Progress label 1040/1039 distribution permutations | Each of three distributions remains at 768/1440; original live resizing at 768/1039/1040/1440 retains label union bounds, clipping, collision and keyboard/hover inspection. |
| Progress seven-size Map/Calendar journey | Three sizes; integer Calendar bounds loop and fractional Calendar checks retain Next/Previous/day-cell containment, overflow, keyboard Next focus, changed week and exact week restoration. |
| UI-05 six-size Profile/Import journey | Three sizes; new fractional Profile/actual Import preview grid and picker-focus checks at both 640/1040 boundaries. Native confirmation focus, axe, Escape and zero-write cancellation remain. |
| Responsive navigation twelve full journeys | Three representative full keyboard/login/logout journeys; all twelve integer sizes remain in one same-session geometry loop and eight fractional sizes in iframe test. |
| Responsive Demo and twelve Calendar journeys | Global keyboard Demo tour calls the extracted, unchanged navigation geometry helper (five buttons, one current item, hit tests, 44px targets, containment and no overlap). Progress owns representative/fractional Calendar week restoration and integer bounds. |
| Agent Setup/Matches seven-size matrix | Three sizes; existing fractional grid/action bounds probe, long text and salary geometry, focus/touch/axe plus every inbox/conversion/session mutation case remain. |
| Salary eleven-format corpus at three widths | Corpus remains at desktop, Node/shared parser coverage unchanged; representative three-size Agent salary wrapping/omission and fractional actions remain. |

## Deliberately Retained

- All nine Final-01 Sign Out tests and all twelve separate Auth tests, unchanged.
- Entire deletion, form-save, job-queue, rejection-date, analytics and palette
  suites. Status mutation suite only gains an optimistic-state assertion.
- Audit integration checks for conversion-generated Notes (exact reopened
  textarea), 20/5 pagination and scroll reset, combined whitespace validation,
  save completion after deliberate Progress navigation, historical week
  preservation, and the cross-page Demo edit/delete/import/inbox/conversion flow.
  These remain because merging them would obscure distinct end-to-end evidence.
- Node unit, real Edge-handler, inbox and retirement tests remain unchanged.

## Accessibility And Diagnostics

`accessibility.js` waits for the final heading, lazy fallback removal, loaded
fonts, finite animations and two animation frames before asserting zero
WCAG 2 A/AA and 2.1 AA axe violations. Existing scoped/native-dialog checks remain.
It does not suppress rules, ignore violations or alter production animations.

Optional, with the same synthetic backend/server contract:

```powershell
npx playwright test --config playwright.diagnostics.config.js
```

This measures a 1000-row Board and 10-row paginated List, attaches measured
milliseconds and makes no speed claim or unestablished performance-budget assertion.
It is not discovered by the functional testDir and has no new CI job.
The opt-in diagnostic passed 1/1 in 4.160s: Board including synthetic sign-in
2199ms, List switch 560ms. These are observations, not isolated rendering
benchmarks or acceptance thresholds.

## Verification

Playwright discovery on pinned main: **309 functional cases per engine + 12
separate Auth cases**. After consolidation: **237 functional cases per engine +
the same 12 Auth cases**. Mandatory Chromium+Auth discovery falls from 321 to 249
(72 fewer functional executions, 23.3%). The previous audit's approximate target
was 232 functional cases including Final-01; five additional retained/new cases
are justified by the integration and lightweight boundary coverage above.

| Functional file | Before | After |
| --- | ---: | ---: |
| audit | 23 | 9 |
| dashboard-selection | 18 | 12 |
| dashboard-ui2 | 14 | 10 |
| delete-mutations | 26 | 26 |
| demo-profile | 6 | 2 |
| form-save | 26 | 26 |
| job-agent-ui2 | 19 | 15 |
| job-queue | 30 | 30 |
| navigation-shell | 5 | 2 |
| palette-version-b | 3 | 3 |
| progress-analytics | 7 | 7 |
| progress-labels | 13 | 7 |
| progress-ui2 | 14 | 11 |
| rejection-dates | 19 | 19 |
| remaining-pages-ui2 | 21 | 19 |
| responsive-navigation | 29 | 5 |
| salary-interpretation | 3 | 1 |
| sign-out | 9 | 9 |
| status-mutations | 24 | 24 |

Pre-removal donor/recipient run: **132/132 Chromium passed**, no retries, skips or
flaky results; **439.987s** elapsed (test bodies 433.521s). Includes all original
audit/navigation/responsive donors alongside enhanced Dashboard, Progress,
Import/Demo and FIFO recipients. The further Notes navigation and Calendar grid
assertions are verified in the final optimized run.

Auth: **12/12 passed**, unchanged source, **30.139s** elapsed. Node unit **207/207**
and source/real-handler audit **30/30** passed. These are fresh local runs, not
inferred from older CI. The donor run overlapped Auth, so it is not a controlled
performance comparison. No full local pre-change 309-case benchmark is claimed.

Fresh final npm command timings: unit 0.706s, audit 0.579s, lint 2.573s, build
0.702s, all exit 0. Build retains the existing large-chunk warning; no application
bundling/configuration change is part of this task.

SHA256 comparisons confirm the Auth file and complete Final-01, deletion,
form-save, queue, rejection-date, analytics and palette suites are byte-for-byte
unchanged. Git diff confirms no changes to application/database/Edge sources,
dependencies, existing Playwright configs or CI.

The navigation helper body was compared with pinned main using its parsed
function body: exact match after line-ending normalization (SHA256
62985dc99ae32b83b9de162ab0315050029026dc74706259e60673b6ac64cfcb).
The three original Demo navigation donors were also re-run before validating
the enhanced recipient, rather than substituting Real-only geometry evidence.
They passed 3/3 in 5.450s; the enhanced recipient passed **9/9 across three
engines** in 118.844s after the helper extraction.

Final-source full optimized Chromium: **237/237 passed**, **668.031s (11m08s)**
elapsed, 660.482s summed test bodies, one worker, zero retries/skips/flaky results.
This complete run follows all test-mechanic corrections and assertion transfers
described below; its report is `chromium-verified-report.json`.
Local machine time is not a CI speedup measurement.

Cross-engine investigation found two mistakes in newly added test mechanics,
not changes to the application's layout/navigation: an integer clientWidth
expectation rejected Firefox's valid 639.267px drawer; Tab from the last mobile
navigation button escaped the document. The drawer now compares exact resolved
CSS layout widths. The tour uses Shift+Tab then Tab within navigation before
asserting focus, visible outline and Enter activation. This also establishes
keyboard modality after the pointer-operated Matches tab. No tolerance, axe
rule suppression, skipped case or application change was introduced.

A subsequent complete Chromium recheck exposed an existing normal-motion
Sign Out measurement race (236 passed, one failed): the Profile target's
`getBoundingClientRect().height` was 43.999969482421875px during its entrance
animation. A separate synthetic probe reproduced exactly that value while
computed height was 44px and the ancestor animation was running; after natural
settlement the rectangle was exactly 44px. `keyboardSignOut` now reuses
`settlePage` before its original strict focus, hit-test and 44px assertions.
No tolerance, animation override or application change was added. The final
Demo tour also retains the removed informational audit's exact active-route
label and fully visible content assertions.
The final-source targeted check passed **18/18 (six per engine)** in 158.235s,
with no retries, skips or flaky results. The independent animation probe passed
1/1 and retained its before/after measurements in the ignored local evidence.

Focused cross-browser matrix: **76/76 passed (38 Firefox, 38 WebKit)** in
624.268s, test bodies 620.308s, one worker, zero retries/skips/flaky results.
It includes exact imported/conversion Notes, all Final-01 tests, drawer/form/
confirmation focus and axe, full-page Demo accessibility/restrictions, Salary
presentation, label inspection and fractional/Calendar/navigation bounds.
The subsequent 9-case recipient run above rechecks the new shared-helper call
at every representative width in each engine.

Fresh successful pinned-main CI baseline:
[run 39155147345](https://github.com/YijunYuan-Work/ApplyTrack/actions/runs/39155147345):
**309 Chromium + 12 Auth passed**, functional step **1168s (19m28s)**, Auth step
36s, whole job **1248s (20m48s)**. Parsed functional test bodies total 1161.091s.
The older audit's 300-case baseline (run 39145924966) measured a 21m48s functional
step and 23m14s job; differing runners/runs already show timing variation.
Optimized PR CI timing is pending; neither discovery counts nor local wall time
establish a CI speedup.

### Reproduction And Local Evidence

Standard repository commands remain unchanged:

```powershell
npm test
npm run test:audit
npm run test:auth-ui
npm run test:audit-ui -- --project=chromium
npm run lint
npm run build
```

The final targeted three-engine check used:

```powershell
npm run test:audit-ui -- tests/refinement-02/ui/responsive-navigation.spec.js tests/refinement-02/ui/remaining-pages-ui2.spec.js --project chromium firefox webkit --grep 'whole-app|navigation, keyboard focus'
```

The local runs used ignored config wrappers under `tmp/final-02.local/` to
separate JSON reports, output directories and Vite caches. Their Vite optimizer
entry is `index.html`, and the watcher excludes ignored `tmp/` and `.temp/`
toolchain trees. Browser projects, synthetic environment, test timeouts,
assertions and the single-worker setting are inherited unchanged. No wrapper or
generated artifact is included in the PR. The optional diagnostic has its own
committed config and uses the same synthetic server contract.

Machine-readable local evidence: `before-inventory.json`, `after-inventory.json`,
`verification.json`, `navigation-parity.json`, `checks.json`, `baseline-ci.json`,
and individual Playwright JSON reports in `tmp/final-02.local/`. This directory
is Git-ignored. Reports contain synthetic fixtures, not production data.

## Boundaries And Limitations

All browser operations use synthetic fixtures and blocked external requests.
They do not establish live RLS, email ingestion or production health. No database,
Supabase integration, Edge Function, deployment, application source or CSS changed.
One worker remains the default; no regression is deferred to main-only execution.
Some cross-suite integration overlap is intentionally retained for data fidelity
and concurrency; scoped/native-dialog axe checks also intentionally coexist with
settled whole-page checks. Full Firefox/WebKit suites were not run; the focused
matrix and subsequent three-size Demo recipient runs are identified above.
New PR CI performance must be measured separately before
claiming a CI improvement. Manual assistive-technology testing is not covered.
