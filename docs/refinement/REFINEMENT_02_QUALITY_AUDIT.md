# ApplyTrack Refinement 02 — Comprehensive Functional & Codebase Quality Audit

## 1. Executive Summary

Audit baseline: `72987da00942a823b23b2f9b17102050ef5beb77` (`origin/main`,
Refinement 01 merged). Branch: `audit/refinement-02-quality`. Audit performed
2026-10-09/10 (America/Toronto/UTC). The initial working tree was clean.

**16 Confirmed Functional Bugs, 8 Confirmed Code Quality Issues, 8 Potential
Risks, 7 Test Coverage Gaps and 3 Optional Improvements.** No Critical finding.
Functional severity: 5 High, 10 Medium, 1 Low. These are preliminary priorities
for ChatGPT review, not authorization to implement fixes.

The highest-impact findings are cross-owner lead/application association, note
loss during mapping/editing, a nullable-notes load failure, out-of-order status
responses, and ingestion overwriting a concurrently applied lead. Ordinary CRUD,
import retry, public demo navigation, basic ownership RLS and atomic concurrent
conversion work in the tested fixtures. This is not a production certification.

Only tests, test configuration, two test-only dependency additions (axe wrapper
and its dependency), CI test steps and this documentation changed. Application
source, CSS, Supabase schema/migrations/functions and production settings remain
unchanged. No fixes, main commits, PR #6 revival, paid service, deployment, real
email or production database operation occurred. The user confirmed Vercel Git
automatic Preview remains disabled before authorizing push/PR creation.

## 2. Repository and Technology Overview

Single React 19/Vite 8 product SPA (installed Vite 8.3.4), hash routes, Supabase JavaScript SDK, Recharts,
SheetJS Excel ingestion, Resend webhook ingestion and PostgreSQL RLS/RPCs.
`App.jsx` owns real account/session/data orchestration; `DemoWorkspace.jsx` owns
local simulated state. API helpers and normalization modules provide useful
existing boundaries. `App.css` plus `styles/theme.css` supply layered responsive
styles. Authentication uses username-derived internal emails and preserves
optional recovery metadata. Public recovery UI is intentionally hidden.

Baseline CI had lint, 18 Node tests, 12 synthetic Chromium authentication tests,
build and a high-severity dependency-audit gate. Nine historical migrations
depend on a separate application-table baseline. Resume/profile search setup
code remains in the repository although its public workflow was removed.

## 3. Audit Methodology

Evidence levels, used throughout this report:

- **B**: actual React UI and SDK against deterministic stateful HTTP fixtures,
  on local Vite, Chromium/Firefox/WebKit on Windows. All nonlocal requests
  intercepted; no production access. Proves UI/API orchestration, not server RLS.
- **N**: Node tests importing actual normalization/parser/Excel logic. The actual
  application mapper is SSR-loaded with a stubbed Supabase module, not rewritten.
- **E**: real ingestion handler and parser executed in a Node VM with real Svix
  HMAC verification. Supabase and inbound retrieval are mocked; no external fetch.
  Proves handler ordering/error decisions, not hosted Deno or real mail delivery.
- **D**: actual cached Supabase PostgreSQL 17.6 image, isolated no-network tmpfs
  database, synthetic Auth rows, actual application schema/policies/RPC. Minimal
  local Storage contract/default grants are supplied. Eight independent SQL
  sessions test conversion concurrency. Not a full Supabase CLI/API stack.
- **S**: source/zero-caller/query/CSS analysis, dependency audit and build output.

Browser tests have deterministic delays/failures; native confirmation dialogs
are accepted/dismissed explicitly. Responsive paths cover 1440/768/390px.
Boundary tests record actual media-query matches rather than assuming integer
viewport reporting exactly matches a browser's fractional layout viewport.

`tests/refinement-02/README.md` documents reproduction. Test titles below are
stable evidence identifiers. Screenshots/traces/JSON measurements are generated
in ignored `test-results/`, not committed. All fixture identities are synthetic.
No real credentials, users, resets, raw production logs or backup data were read.

## 4. Functional Test Coverage Matrix

| Area | Verified behavior and evidence | Limits / remaining coverage |
| --- | --- | --- |
| Applications | B create/edit/delete/reload; latest applied/updated sorting; status/search filter; list pagination; canceled/failed bulk deletion; ordered-response race; pending-save navigation; N mapping; D owner isolation | Real PostgREST errors, simultaneous devices and all date/number permutations not covered |
| Excel | Existing N plus audit N first sheet, aliases, unknown headers, incomplete rows, dates/year boundary, missing headers, random bytes, empty sheet, invalid status/count; B duplicate selection, failure/retry and notes persistence | No exhaustive corrupt XLS variants, huge workbook stress, arbitrary timezone matrix or actual SQL batch insert fault |
| Progress | B independently asserted interview count for one zero-round record; rejection-history mutation across year boundary; demo after import/delete; responsive rendering | All chart series/status distributions and calendar empty/leap-day cases lack independent numeric assertions |
| Job Agent | N/E LinkedIn/Indeed parser logic, valid/forged signatures, repeat delivery, failure/retry, state race; B conversion/remove/remove-all/source data/search/pagination top scroll; D conversion/ownership/concurrency | No live provider email formats or inbox delivery; source selector not exhaustively asserted; real transport retries/crash not exercised |
| Demo | B create/edit/delete/bulk/import/pause/resume/address replacement/conversion/navigation/password feedback; backend request count zero | Browser restart persistence is not a promise of the in-memory demo |
| Auth/Profile | Existing 12 B tests: username sign-up/in/out, errors, password update/metadata, token route compatibility; audit tablet sign-out; recovery UI stays hidden | Real GoTrue/session expiry/browser-close lifecycle and delivery unverified |
| Responsive | B seven view paths at 1440/768/390 in all three engines, document overflow, Profile keyboard/focus; logout boundaries | Emulated viewports, not real iOS/Android devices; all dialogs/touch targets not measured |
| Accessibility/performance | axe WCAG A/AA tags on five desktop pages in all engines; 1000-row board/list timing | Automated scan and focused keyboard checks, not screen-reader compliance or production performance |
| Database | D actual RLS/RPC checks, eight concurrent sessions, nine historical migration replays with baseline | Fixture grants/Storage contract; no production permissions proof, GoTrue/PostgREST/Storage HTTP or production migration apply |

## 5. Confirmed Functional Bugs

All entries are **Confirmed Functional Bug**. Unless otherwise noted B findings
reproduced in each of Chromium, Firefox and WebKit using the synthetic local
backend; frequency is every controlled reproduction (not a production incidence
estimate). Source references refer to the unchanged baseline. Evidence paths are
repository-relative; line numbers are starting anchors, not whole-file claims.

### F01: Owned lead can reference another user's application

- **Severity / module:** High / database authorization and integrity.
- **Preconditions:** User A owns lead 203; user B owns application 102; authenticated role.
- **Reproduce:** Set A's JWT subject in SQL; update A's lead `application_id=102`.
- **Expected:** Reject an association with a different owner's application.
- **Actual:** Update succeeds despite B's application being invisible to A.
  This does not grant cross-user application SELECT access.
- **Frequency / environment:** Every D reproduction, PostgreSQL 17.6 fixture.
- **Evidence:** `database/assertions.sql`, `BUG: owned lead accepts cross-owner application_id`.
- **Source:** `supabase/schema.sql:214`, `:305`, `:342` (also deployed-definition migration sources).
- **Direction:** Enforce association ownership at the database boundary; review
  column grant and conversion contract together. Do not rely on frontend checks.

### F02: Legitimate notes are silently stripped and then persisted without content

- **Severity / module:** High / application mapping/editing.
- **Preconditions:** Structured fields already exist; notes contain `Cover letter: Yes`,
  `Referral: No`, or `Last updated: interview pending` as legitimate user prose.
- **Reproduce:** Fetch/edit the record; change only role and save.
- **Expected:** Preserve original notes unless the user edits them.
- **Actual:** Legacy extraction removes these matching phrases/lines even on
  modern rows; saving persists the shortened note.
- **Frequency / environment:** Every matching fixture; N and B all engines.
- **Evidence:** `logic.test.js` mapper test; UI `API note labels disappear...`.
- **Source:** `src/api/applications.js:18`, `:37`, `:54`, `:74`.
- **Direction:** Narrow legacy compatibility to proven legacy records; preserve raw notes.

### F03: A valid nullable notes row prevents the whole dashboard loading

- **Severity / module:** High / application API and dashboard.
- **Preconditions:** One application has `notes=NULL`, permitted by the schema.
- **Reproduce:** Load/reload Dashboard with that record.
- **Expected:** Treat absent notes as empty and render all records.
- **Actual:** `notes.match` throws; the entire mapped fetch fails and zero cards load.
- **Frequency / environment:** Every null fixture; N, B all engines; D confirms nullable data legal.
- **Evidence:** Same mapper/UI test as F02, plus database null-notes assertion.
- **Source:** `src/api/applications.js:18`, `:37`, `:78`; `supabase/schema.sql:17`.
- **Direction:** Make mapper null-safe, add desired-behavior regression test without losing legacy compatibility.

### F04: Out-of-order status responses overwrite newer UI state

- **Severity / module:** High / status mutations/state synchronization.
- **Preconditions:** One Applied card; overlapping PATCH requests allowed.
- **Reproduce:** Select Interview then Rejected; persist both in that order,
  deliver Rejected response first and Interview response second.
- **Expected:** UI and stored final status remain Rejected.
- **Actual:** Store is Rejected; UI returns to Interview until reload. Each request
  also writes a full snapshot, so other stale fields are at risk, not proven lost here.
- **Frequency / environment:** Every controlled response ordering; B all engines.
- **Evidence:** UI `out-of-order status responses leave UI stale until reload`.
- **Source:** `src/App.jsx:300`; `src/api/applications.js:120`.
- **Direction:** Serialize/version per-record updates and scope writes; test overlapping edits.

### F05: Ingestion can return an applied lead to the waiting queue

- **Severity / module:** High / webhook and conversion state consistency.
- **Preconditions:** Handler reads lead state New; user conversion commits Applied before upsert.
- **Reproduce:** Inject conversion after prior-state read, before real handler's upsert;
  separately retry actual RPC against a New lead with an existing application ID.
- **Expected:** Metadata refresh preserves Applied; conversion retry repairs inconsistent state.
- **Actual:** Stale upsert writes New while application ID remains; existing-ID
  RPC returns application without repairing lead state.
- **Frequency / environment:** Every injected E race; every D stale-state retry.
  No live simultaneous HTTP/Deno test claimed.
- **Evidence:** Edge `ingestion upsert overwrites concurrently applied state`; SQL runner stale-state check.
- **Source:** `supabase/functions/ingest-job-alert/index.ts:230`, `:275`;
  `supabase/schema.sql:407`.
- **Direction:** Database-atomic state preservation plus idempotent state repair; retain FOR UPDATE.

### F06: Final database errors are acknowledged as successful ingestion

- **Severity / module:** Medium / ingestion failure and retry.
- **Preconditions:** Valid signed message; final completion update returns a Supabase `{error}`.
- **Reproduce:** Fail the completion write, then clear failure and redeliver message.
- **Expected:** Failed work is reported and safely retryable; status eventually completes.
- **Actual:** Handler returns 200, message stays Processing; retry is skipped as
  duplicate forever. Leads existed in this test; total lead loss is not claimed.
- **Frequency / environment:** Every injected E final-write failure, actual handler.
- **Evidence:** Edge `final database error is acknowledged 200...`.
- **Source:** `supabase/functions/ingest-job-alert/index.ts:158`, `:300`.
- **Direction:** Inspect each result's error and define recoverable message processing states.

### F07: Remove all leaves jobs beyond the fetched 500-row window

- **Severity / module:** Medium / Job Agent queue/bulk removal.
- **Preconditions:** 501 waiting leads in the backend.
- **Reproduce:** Open Matches, Remove all, accept; reload.
- **Expected:** Remove all waiting jobs, or accurately disclose a partial operation.
- **Actual:** UI initially reports empty, but one unseen job remains and returns on reload.
- **Frequency / environment:** Every 501-row fixture; B all engines.
- **Evidence:** UI `remove all uses only fetched 500 leads...`.
- **Source:** `src/api/jobAgent.js:137`, `:153`; `src/pages/JobAgentPage.jsx:293`.
- **Direction:** Explicit server-side waiting scope/pagination and truthful bulk-operation semantics.

### F08: Editing notes changes historical rejection reporting

- **Severity / module:** Medium / Progress calendar.
- **Preconditions:** Rejected on last-updated 2025-12-31; test today 2026-01-09.
- **Reproduce:** Inspect calendar; edit only notes; return to calendar/previous week.
- **Expected:** A note edit does not move the recorded rejection event to another week/year.
- **Actual:** Rejection moves to January 9 because event date uses mutable Last Updated.
- **Frequency / environment:** Every fixture; B all engines with fixed clock.
- **Evidence:** UI `editing a rejected record moves its historical rejection date`.
- **Source:** `src/App.jsx:263`; `src/pages/ProgressPage.jsx:273`, `:309`.
- **Direction:** Review historical-date semantics before changes; do not invent dates for old records.

### F09: Board Select all selects only ten of twenty-five displayed cards

- **Severity / module:** Medium / Dashboard selection.
- **Preconditions:** Board renders 25 filtered applications; default list page size 10.
- **Reproduce:** Enter multi-select, click Select all.
- **Expected:** Selection scope matches the displayed Board or is explicitly labeled narrower.
- **Actual:** Only ten selected; selection derives from hidden list pagination.
- **Frequency / environment:** Every fixture; B all engines.
- **Evidence:** UI `board select-all selects ten of twenty-five...`.
- **Source:** `src/pages/DashboardPage.jsx:101`, `:110`, `:133`, `:497`.
- **Direction:** Make visible selection scope view-specific; preserve paginated List behavior.

### F10: Canceling or failing bulk deletion loses the selection

- **Severity / module:** Medium / destructive action feedback/accessibility.
- **Preconditions:** Selected records; confirmation dismissed or backend DELETE fails.
- **Reproduce:** Delete selected; cancel, or accept with injected failure.
- **Expected:** No deletion and selection preserved for retry; failure announced.
- **Actual:** Records remain but selection clears; Dashboard error is a plain
  paragraph without alert/live semantics (no screen-reader announcement test claimed).
- **Frequency / environment:** Both paths every fixture; B all engines.
- **Evidence:** UI board cancel case and `failed bulk delete clears selection...`.
- **Source:** `src/App.jsx:362`; `src/pages/DashboardPage.jsx:171`, `:473`.
- **Direction:** Explicit mutation outcomes; clear selection only on success; announce errors.

### F11: Tablet layout has no visible Sign out control

- **Severity / module:** Medium / authenticated navigation/Profile responsive CSS.
- **Preconditions:** Signed in; Profile visible; compact non-phone layout.
- **Reproduce:** Set viewport 768x900; find visible Sign out buttons.
- **Expected:** At least one reachable account exit.
- **Actual:** Both sidebar and Profile controls hidden. Verified 722, 768 and
  898px in all engines. Chromium/WebKit also hide at exact 721 and 900px and
  show at 720/901. Firefox's fractional viewport differs at exact boundaries:
  requested 720 gives visual width 720.25 and hides; 900 gives 900.133 and shows.
- **Frequency / environment:** Every interior-width fixture; B all engines.
- **Evidence:** UI `both Sign out controls...`, `tablet-no-sign-out.png`,
  `breakpoint-observations` attachment. Screenshots are regenerated locally.
- **Source:** `src/styles/theme.css:1127`, `:2892`, `:3504`, `:3755`.
- **Direction:** Ensure one exit across all responsive intervals and test CSS-media boundaries.

### F12: Demo password update reports a real success for a no-op

- **Severity / module:** Medium / Public Demo Profile.
- **Preconditions:** Demo mode, matching passwords meeting minimum length.
- **Reproduce:** Update password.
- **Expected:** Describe unsupported/simulated behavior accurately.
- **Actual:** Displays `Password updated successfully.` although callback is empty.
- **Frequency / environment:** Every fixture; B all engines, no backend request.
- **Evidence:** UI `demo password succeeds without persistence...`.
- **Source:** `src/pages/DemoWorkspace.jsx:207`; `src/pages/ProfilePage.jsx:44`.
- **Direction:** Honest demo feedback without adding an authentication backend to demo.

### F13: Whitespace-only required fields silently do nothing

- **Severity / module:** Medium / application form validation.
- **Preconditions:** Company and Role contain spaces, satisfying native required checks.
- **Reproduce:** Submit new application.
- **Expected:** Actionable validation error and focus on invalid field.
- **Actual:** Handler trims then returns; no request, save or error indication.
- **Frequency / environment:** Every fixture; B all engines.
- **Evidence:** UI `whitespace required fields silently return...`.
- **Source:** `src/App.jsx:245`, `:269`; `src/pages/ApplicationFormPage.jsx:29`.
- **Direction:** Explicit trimmed-field validation consistent in real/demo flows.

### F14: Late save response forces navigation away from the user's chosen page

- **Severity / module:** Medium / application save/navigation lifecycle.
- **Preconditions:** POST pending while navigation remains enabled.
- **Reproduce:** Submit application, navigate Progress, then release response.
- **Expected:** Persist the save without overriding subsequent deliberate navigation.
- **Actual:** Success handler unconditionally sends user back to Dashboard.
- **Frequency / environment:** Every delayed fixture; B all engines.
- **Evidence:** UI `save response navigates away from the page chosen...`.
- **Source:** `src/App.jsx:294`; `src/pages/ApplicationFormPage.jsx:29`.
- **Direction:** Scope post-save navigation to the originating view/operation lifecycle.

### F15: Salary shorthand is interpreted as dollars rather than thousands

- **Severity / module:** Medium / Job Agent salary interpretation.
- **Preconditions:** Description `$90k - $120k a year`; no structured salary.
- **Reproduce:** Run actual `getJobLeadPresentation` on the description.
- **Expected:** Correctly interpret thousands or omit unsupported extraction.
- **Actual:** Shows a salary based on 90, not 90,000; range/unit extraction stops at k.
- **Frequency / environment:** Every N fixture; backend regex has the same omission
  by S inspection, but no separate production parser salary claim.
- **Evidence:** N `Job salary characterization: shorthand $90k...`.
- **Source:** `src/data/jobAgent.js:191`; `supabase/functions/_shared/jobAlertParser.ts:166`.
- **Direction:** Shared tested salary contract or safely decline ambiguous extraction.

### F16: Empty search claims the entire application queue is empty

- **Severity / module:** Low / Matches empty state.
- **Preconditions:** Waiting jobs exist; search term matches none.
- **Reproduce:** Search `no-such-job` among 24 waiting leads.
- **Expected:** No search results with a clear way to reset filters.
- **Actual:** Heading says `No applications waiting` despite remaining jobs.
- **Frequency / environment:** Every fixture; B all engines.
- **Evidence:** UI `Job conversion... BUG empty search mislabels queue`.
- **Source:** `src/components/JobMatches.jsx:53`, `:61`, `:275`.
- **Direction:** Distinguish empty dataset from filtered-empty results; no redesign.

## 6. Confirmed Code Quality Issues

All entries are **Confirmed Code Quality Issue**. Severity and scope are
preliminary; no cleanup or refactoring was performed.

| ID / category / severity | Files and starting lines | Current implementation; problem and concrete impact | Recommended direction / scope / regression risk | Verification |
| --- | --- | --- | --- | --- |
| CQ01 / mutation contract / Medium | `src/App.jsx:245`, `:362`; `src/pages/DashboardPage.jsx:171` | Handlers return no distinguishable success/cancel/failure result; caught errors become parent state. Child cannot decide whether to clear selection or continue navigation. Causes F10/F13 and makes failure-path tests indirect. | Narrow explicit outcome contract, not a state-library replacement / Small / Medium | S and B failure/cancel reproductions |
| CQ02 / duplicated business rules / Medium | `src/App.jsx:245`; `src/pages/DemoWorkspace.jsx:29`; `src/components/MetricGrid.jsx:16`; `src/pages/ProgressPage.jsx:164`; `src/data/jobAgent.js:191`; parser `:166` | Real/demo save preparation and frontend/backend salary rules duplicated. Interview-reached formula also differs: Dashboard hidden helper text says zero while Progress says one for Interview with zero rounds. Hidden text is NOT a visible functional bug. | Consolidate only genuinely shared pure rules with parity tests / Medium / Medium | S, N and B hidden-metric characterization |
| CQ03 / obsolete client surface / Low | `src/components/TagInput.jsx:4`; `src/utils/storage.js:8`; `src/api/jobAgent.js:307`, `:352`, `:364`, `:373`; `src/utils/resumeParser.js:62` | Zero active production callers for old storage utility/TagInput/resume upload/edit/download/delete/extraction paths. Removed setup flow leaves maintenance and dormant dependency cost. Data tables/metadata are NOT thereby safe to delete. | Verify reachable import graph and separately approve client-only removal; preserve stored data / Small-Medium / Medium | Targeted rg definition/import/caller checks; resume skill helpers still tested |
| CQ04 / schema reproducibility / Medium | `supabase/schema.sql:1`; `supabase/migrations/20260722050558_job_agent_phase_1_4.sql:1`; `README.md` database setup | Nine migration files assume the application table already exists; replay needs an external baseline. Fresh README schema setup is documented and works; migration history alone is not self-contained. | Document/version an explicit bootstrap contract before changing history / Small docs, Medium code / High for any historical SQL change | D replay succeeds only after supplied baseline; S missing initial create |
| CQ05 / responsive CSS ownership / Medium | `src/styles/theme.css:1072`, `:1127`, `:2892`, `:2896`, `:3755` | Layered max900/max720/min721 overrides hide different exits with no invariant spanning the whole range. Fixes in one interval need understanding distant declarations. F11 supplies impact; length alone is not the complaint. | Bounded selector/breakpoint ownership cleanup after an approved functional fix / Small-Medium / Medium | S computed media queries and B layout assertions |
| CQ06 / duplicate requests / Low | `src/App.jsx:160`, `:199`; `src/api/jobAgent.js:165` | User load fetches summary while Dashboard route effect separately fetches the same three summary datasets. Initial sign-in to Dashboard duplicates queries; errors are silently reduced to null. Not an N+1 pattern. | One coordinated initial fetch and explicit stale/error semantics / Small / Medium | S overlapping effect/query paths; not a production latency benchmark |
| CQ07 / pure transformation coupling / Low | `src/api/applications.js:1`, `:36`; `src/lib/supabase.js` | Exported row mapper lives in SDK-initializing browser module. Testing a pure transformation needs Vite SSR and a Supabase import stub rather than a direct Node import. | Extract only pure mapper if an approved mapping fix warrants it / Small / Low | N actual mapper exercised through documented stub |
| CQ08 / data validation contract / Medium | `supabase/schema.sql:4`, `:7`, `:16`, `:17`; `src/data/applications.js:177` | DB permits blank names, arbitrary statuses and negative rounds; normalizer also retains Infinity. UI normalization and database acceptance diverge, allowing corrupted analytics inputs via direct authenticated writes. No evidence of existing production corruption. | Define non-finite/count/name/status contracts; assess legacy rows before any constraints / Medium / High | N Infinity/negative/invalid-status assertions and D legal malformed-row insertion |

## 7. Potential Risks and Unverified Findings

These eight **Potential Risk** items are not counted as reproduced functional bugs.

| ID / severity | Source-backed concern | Missing proof / safe next verification |
| --- | --- | --- |
| R01 / High | Retained public `request-password-reset/index.ts` uses per-worker in-memory IP/email limits, lists Auth users, accepts unverified profileEmail and first-match duplicates. Delivery/config failure can differ from neutral nonexistent-email responses. Hidden UI does not disable endpoint. | No production probing or real reset mail; isolated worker restart, duplicate metadata and full response-equivalence tests needed. Do not revive PR #6 automatically. |
| R02 / Medium | `src/api/applications.js:78` and `jobAgent.js:165` fetch unpaginated datasets. Server row caps could silently truncate dashboard/summary. Explicit 500-lead cap is separately F07. | Production max_rows not read; inject caps and test paginated retrieval before claiming a production truncation count. |
| R03 / Medium | `[user]` data effects can re-fetch on auth refresh while mutations are in flight; no request-version reconciliation. | Real/token-refresh overlapping GET/PATCH test missing; F04 only proves overlapping status responses. |
| R04 / Medium | Physically removed leads have no tombstone; later alert may recreate them. Application deletion sets lead application_id null but can leave state Applied. | Product semantics need review; no assertion that recurrence or retained historical state is always incorrect. |
| R05 / Low | Excel Date-cell conversion and unusual strings can interact with UTC/local date handling. | Current Toronto/string/year-boundary fixtures pass; positive-offset timezone/Date-cell matrix needed before an off-by-one claim. |
| R06 / Low | `JobAlertConnection.jsx:33` awaits clipboard write without catch/user-facing failure. | Browser permission denial not injected; verify rejected clipboard promise without changing live settings. |
| R07 / Medium | Inbox creation is select-then-insert with a unique user constraint; retrying previously Failed messages lacks an atomic claim for simultaneous deliveries. | Need concurrent inbox creation/retry tests against real SQL/handler combination. Unique constraints may contain duplication but still surface errors. |
| R08 / Medium | Signed webhook shape is consumed before comprehensive validation; sender/provider HTML and URL protocol handling can drift; Edge SDK import `npm:@supabase/supabase-js@2` is not locked to npm lockfile. | Controlled malformed signed events, restricted protocols and sanitized provider-format corpus needed. No malicious production mail or claimed SDK incompatibility. |

## 8. Testing and CI Coverage Gaps

All entries below are **Test Coverage Gap**, with Medium priority unless specified.

1. **G01:** Desired-behavior regressions for F01-F16. This PR characterizes defects
   rather than silently fixing them; current green results preserve known bugs.
2. **G02:** Full local GoTrue/PostgREST/Storage/Edge integration and privilege
   defaults. SQL fixture roles are real, HTTP/session layers are not.
3. **G03:** Independent expected values for every chart/status distribution,
   zero/invalid datasets, leap dates, calendar months and timezone offsets.
4. **G04:** Large/malformed XLS corpus and real atomic SQL import failure. Current
   synthetic failure mock verifies UI feedback, not SQL batch transaction semantics.
5. **G05:** Real session expiration, browser-session-close semantics, valid token
   consumption and username behavior under hosted Auth configuration. Existing
   token tests prove frontend route/SDK compatibility only.
6. **G06:** Screen-reader error/live announcements, modal focus restoration,
   full keyboard paths and 44px touch targets on real mobile devices.
7. **G07 (Low):** Firefox/WebKit and database runner remain local gates. CI adds
   Node handler/logic and Chromium audit cases; does not claim the local browser
   matrix or database assertions are now CI-enforced.

Existing unit/parser fixtures cover useful boundaries but parser-only ancestor
selection differs from the production handler's HTML context builder. The new E
harness exercises the actual builder. Browser mocks cannot replace RLS tests.
No coverage percentage or "all workflows fully verified" claim is made.

## 9. Architecture and Maintainability Assessment

The current small-app architecture is appropriate: hash navigation, centralized
shared state, route pages, API helpers, normalization and row-locking RPC are
understandable without Redux/React Query or a new routing framework. Boundaries
need tightening specifically around transformation, mutation outcomes and async
response ownership, not wholesale replacement.

Schema/RPC conversion provides a good transaction boundary. Ingestion currently
coordinates several separate writes with weaker result/error handling. Real/demo
orchestration duplicates some behavior; pure shared rules should be considered
only where parity evidence supports extraction. Legacy names and file length
alone are not dead-code or architecture findings. Existing user metadata/tables
must be preserved during any later client cleanup.

## 10. Security and Data Integrity Assessment

- D passes owner-scoped applications/leads SELECT, cross-owner application
  INSERT denial, RPC owner denial, anonymous RPC execution denial, authenticated
  execution, lead descriptive-column update denial and cross-owner DELETE
  preservation. These checks do not negate the association integrity hole F01.
- RPC repeated conversion preserves the initial date and creates one application
  under eight concurrent SQL sessions. State repair remains defective (F05).
- Minimal Storage fixture passes owner-prefix read/insert and rejects another
  prefix; no Storage HTTP/file deletion/upload integration claimed.
- Actual Svix verification rejects forged signatures before retrieval. Valid
  message duplication and failed-retrieval retry work. Final-write handling and
  read/upsert state ordering do not (F05/F06).
- No cross-user SELECT exposure, secret exposure or production account takeover
  was reproduced. R01 requires separate approved local backend investigation.
- npm audit reports **3 moderate package entries, 0 high, 0 critical**. They are
  one underlying `sprintf-js` DoS advisory, GHSA-hp3w-g68c-fv3c, through
  `argparse`/`mammoth`, not three distinct vulnerabilities. Resume UI is inactive,
  so reachable exploitation is unproven. Suggested Mammoth downgrade was not applied.

## 11. Performance and Accessibility Assessment

The 1000-row synthetic Board renders all cards; List renders ten. Tests measure
wall-clock login/load-to-board and list-interaction-to-settlement; these are not
equivalent measurements or controlled production benchmarks. Final-run timings
are recorded in section 14. They justify preserving a reproducible baseline,
not declaring virtualization or memoization mandatory.

Build code splitting keeps Progress and Excel chunks separate from main entry.
SheetJS is a substantial lazy chunk; removing core import functionality to save
bytes is not recommended. Large unpaginated queries (R02) merit correctness
investigation before speculative rendering optimization.

Automated axe scans found zero violations on Dashboard, Profile, Progress,
Import and Job Agent for WCAG 2 A/AA and 2.1 AA tags in all engines. These static
desktop snapshots do not test dynamic error announcements, disabled semantics,
screen readers or every dialog. F10 lacks alert/live semantics; F11 removes an
important account control. Keyboard focus/tab order from password input to its
visibility button is verified. No document horizontal overflow in seven tested
view paths at each required width. Responsive screenshots supplement assertions.

**Optional Improvement** items, not current required fixes:

- **O01 (Low):** Extend performance runs to repeated production-build cold/warm
  measurements before choosing virtualization; current timings are one local sample.
- **O02 (Low):** Capture documented bundle budgets for lazy Excel/Progress chunks
  if future additions increase them; no arbitrary size regression threshold now.
- **O03 (Low):** Expand keyboard/focus/real-device evidence after F10/F11 corrections,
  without a visual redesign or new control framework.

## 12. Cross-Cutting Root Causes

| Root cause | Related issues | Bounded intervention |
| --- | --- | --- |
| Transformation mixes legacy recovery with modern display | F02/F03, CQ07 | Null-safe, provenance-aware mapper with lossless note tests |
| Async outcomes/state ownership not explicit | F04/F10/F13/F14, CQ01, R03 | Per-operation outcome/version contract and navigation lifecycle tests |
| Multi-write ingestion state is not atomic/recoverable | F05/F06, R07 | Preserve terminal lead state; verify writes; durable retry/claim rules |
| Relationship validation differs from row ownership | F01, CQ08 | Database ownership association and validation contract, synthetic migration tests |
| Displayed scope differs from selected/fetched scope | F07/F09/F16, R02 | Explicit selection/query/filter-empty semantics, not separate decorative fixes |
| Mutable metadata reused for historical events | F08 | Decide historical date contract before schema/UI changes |
| Duplicated rules and layered CSS | F11/F12/F15, CQ02/CQ05 | Narrow parity-backed rule/style fixes, preserve existing product design |

## 13. Recommended Refinement Backlog

Ordered proposals only; ChatGPT decides acceptance, priority and implementation scope.

1. **Security/integrity:** F01 owner association constraint/grant review; inspect
   historical association validity using an approved read-only procedure.
2. **Lossless application data:** F02/F03 mapping correction with preserved legacy
   compatibility; separately assess CQ08 validation against old rows.
3. **Reliable ingestion:** F05/F06 terminal-state preservation, RPC repair and
   explicit error/retry outcomes; include R07 concurrency scenarios.
4. **Mutation correctness:** F04/F10/F13/F14 response ordering/outcome/navigation
   contract. Keep field-level write strategy scoped to actual affected operations.
5. **Queue and bulk scope:** F07/F09/F16 pagination, selection and truthful empty
   results. Verify R02 server-limit behavior before choosing server aggregates.
6. **Historical analytics:** F08 date semantics and independent G03 metrics tests.
7. **Usability/accessibility:** F11 logout invariant, F12 honest demo feedback,
   F15 salary parsing; include F10 announcements without redesign.
8. **Maintainability:** CQ02/CQ04/CQ05/CQ06/CQ07 focused parity/replay/ownership
   cleanup; then CQ03 zero-caller client cleanup only, no stored-data deletion.
9. **Performance/minor cleanup:** O01-O03 measurements and advisory reachability
   review. No unapproved dependency upgrades or wholesale architecture roadmap.

R01 requires explicit separate local backend security scope; this audit does not
authorize disabling/deploying recovery infrastructure or resuming closed PR #6.

## 14. Validation Results

Recorded results below are from this audit, not inherited CI claims. Tests are intentionally
sequential where Vite shares the dependency cache. Earlier harness selector/timing
failures were investigated; no business code or desired guarantee was weakened.

| Gate | Result |
| --- | --- |
| Existing `npm test` | 18/18 pass |
| New `npm run test:audit` | 14/14 pass (7 logic, 7 real-handler/mocked-service) |
| Existing `npm run test:auth-ui` | 12/12 pass, final isolated execution; an earlier overlapping Vite SSR run experienced one blank-page timeout, resolved on isolated rerun |
| New `npm run test:audit-ui` | Earlier full run 57/57 pass. Final strengthened full run 56 pass / 1 Firefox context-close protocol error, not a failed application assertion. Independent `npm run test:audit-ui -- --project firefox` rerun 19/19 pass (38 seconds). Chromium and WebKit each 19/19 pass. Strengthened responsive-only rerun 9/9 pass. |
| `npm run test:audit-db` | 19 SQL checks pass, eight concurrent calls create one application; nine migration replays pass with application baseline |
| `npm run lint` | Pass |
| `npm run build` | Pass; entry 468.87 kB / gzip 132.14; lazy Excel 492.12 / 160.37; Progress 281.84 / 86.91; CSS 96.35 / 16.69 |
| `npm audit --audit-level=high` | Exit 0; 3 moderate package entries, 0 high/critical |
| Protected paths / secret review / `git diff --check` | Pass; no `src/`, `supabase/` or README business changes; scoped credential-pattern review and manual synthetic-fixture review |

Experimental Node VM/TypeScript stripping and NO_COLOR/FORCE_COLOR messages are
test-runtime warnings, not ignored failing assertions. Characterization assertions
are marked `BUG` and must change alongside approved fixes.

Final full-run local samples: Chromium Board 1407 ms / List 564 ms; Firefox
1727 / 1202 ms; WebKit 2163 / 1363 ms. These timings include different operations
and are not comparable benchmark scores. All five-page axe observations in all
three engines had zero violation IDs. Axe output is recorded evidence, not a
comprehensive compliance gate.

The Firefox teardown exception was `browserContext.close: Protocol error
(Browser.removeBrowserContext)` with `_maybeDontRestoreTabs` on an undefined
window entry. No retry setting was introduced and no assertion was removed.
The test's product assertions completed; this is a test-infrastructure reliability
limitation, not classified as a product defect. Reproduction of the protocol
exception itself is not established.
The independent Firefox rerun also reported zero axe violations; its timing
sample was Board 1936 ms / List 1010 ms, illustrating why single samples should
not be treated as an optimization threshold.

The SQL suite completed successfully before cleanup. A later repeat attempt
could not connect to `dockerDesktopLinuxEngine`; no SQL was executed in that
attempt. The runner now distinguishes an unavailable daemon from a missing image.
Docker Desktop was not restarted, to avoid affecting other projects. Its initial
audit container was already removed after checking its exact label. Rerunning D
requires Docker Desktop to be available; this is an environment gate, not a
failed database assertion.

## 15. Remaining Limitations

No production schema/grants/configuration/data were inspected or changed. No
production emails, reset requests, forwarding or deployment performed. User's
Preview-disabled confirmation is the release-safety precondition, not an API
verification of Vercel settings. PR submission is not a production release approval.

SQL uses a cached Supabase Postgres image, not a complete local Supabase stack.
Bootstrap grants and Storage scaffolding are explicit fixtures. Historical replay
does not prove the production migration history matches source. Browser fixtures
prove client behavior and block external traffic, not true GoTrue/PostgREST/Auth
or network-service reliability. The Edge VM is not hosted Deno.

Tests use synthetic examples, not an exhaustive provider email corpus or all
dates/statuses/workbooks. Real device touch/screen-reader use, session expiry,
multi-client concurrency, safe real-backend import failures and R01-R08 remain
unverified. Timings are local single samples, no universal latency guarantee.

Artifacts are ignored and reproducible; no real tokens or user data should ever
be added to them. The isolated SQL runner removes only its labeled container;
other projects/containers are untouched. No persistent test server or extra
worktree is required. Stop after audit PR submission and await ChatGPT review;
do not implement this backlog or merge the PR automatically.
