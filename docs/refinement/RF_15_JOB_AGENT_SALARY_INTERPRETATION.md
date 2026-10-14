# RF-15: Job Agent Salary Interpretation

Status: In Progress; pending independent review, user acceptance and separately approved release.
Baseline: main `ee5c6f621b4ef6c2c44ad2a1c72db450a6a609e0` (RF-14, PR #27).
Review: [PR #28](https://github.com/YijunYuan-Work/ApplyTrack/pull/28), unmerged.

## Root Cause and Scope

F15: duplicated regular expressions stopped before `k`/`K`, turning thousands
into dollar-sized amounts and losing the range/unit. Both also treated missing
units as annual. The frontend formatted text-derived values as CAD although Job
Lead rows have no currency or compensation-period columns. CQ02's salary-rule
duplication is addressed here; unrelated save/metric duplication is not in scope.

One pure `supabase/functions/_shared/salary.js` module now serves Vite presentation
and the Deno email parser. No dependencies, database contract, UI/CSS or handler
architecture changes. `inferAnnualSalary` only maps a successfully parsed explicit
annual expression to the existing nullable numeric fields.

## Supported Contract

- Positive amounts: plain integers, correctly grouped commas and up to two decimal
  places. `k`/`K` multiplies by 1,000, including `$90.5k` = 90,500.
- Single amounts and ordered ranges separated by `-`, en/em dash or `to`. The
  second currency marker may be omitted. Both bounds must use the same scale;
  mixed shorthand/full-number ranges are declined, not guessed.
- Decimal shorthand expands using integer components, preventing binary
  multiplication noise such as `2.01 * 1000` becoming `2009.9999999999999998`.
- Explicit annual aliases: year/yr/yearly/annual/annually/annum, including
  `a year`, `per year` and `/yr`. Only these populate annual numeric fields.
- Hour/hr/hourly, week/wk/weekly and month/mo/monthly retain their original labels
  but never populate annual fields. No conversion is performed.
- `$100k` and `$90K-$120K` without a period remain valid text labels, with NULL
  annual fields. Neither `$` nor `k` establishes a currency code or annual period.
- Explicit prefix currencies: CAD/USD/AUD/GBP/EUR, CA$/C$/US$/AU$/A$, pound and
  euro symbols. Original currency spelling and units remain in the label. Conflicting
  explicit range currencies are rejected; a bare dollar sign can accompany an
  explicit dollar currency within the same range.
- Malformed/negative/zero/unsafe amounts, reversed/incomplete ranges, unknown
  `a`/`per`/slash units, mixed currencies, alternative/multiple monetary expressions
  and open-ended qualifiers such as `up to` are declined. There is no retry at a
  later range bound. Rejected compensation text is retained in the summary and
  email description, including negative signs and incomplete range punctuation.

Valid structured bounds retain precedence. If the description's parsed bounds
exactly match them, its original label supplies explicit currency/unit context;
otherwise stored numbers are displayed without an invented currency or period.
Invalid structured bounds produce no salary label and do not fall back to a
different textual value. Conflicting/rejected description text is not stripped.
No stored value is repaired or backfilled, including old incorrectly parsed bounds.
Structured numeric zero is a valid explicit bound, not a missing value; text
extraction remains deliberately limited to positive pay expressions.

## Verification

Tests use synthetic data, local request interception and the existing signed
real-handler harness. No production data or live ingestion endpoint is accessed.
Artifacts remain ignored under `tmp/rf15.local/` inside the workspace.

- Replaced the old F15 characterization with corrected expected behavior.
- Shared explicit test vectors exercise frontend and email-parser results,
  including expansion, units, currency, partial matches and malformed ranges.
- LinkedIn/Indeed HTML samples cover explicit currency, annual and hourly pay.
- Signed handler regression verifies expanded annual RPC payloads and NULL fields
  for hourly/unitless/reversed salary text while retaining successful ingestion.
- Browser cases cover labels, omission, structured precedence, search, cancellation
  and conversion, plus card actions and overflow at 1440/768/390px.

Verification gates:

- `npm test`: 204 passed, including frontend/email parity fixtures and 9,801
  deterministic exact-decimal expansion checks inside one regression case.
- `npm run test:audit`: 29 passed, including actual signed handler execution,
  database-failure/retry/idempotency/concurrency and terminal-state preservation.
- `npm run test:audit-ui -- salary-interpretation.spec.js --project chromium
  --project firefox --project webkit`: 9 passed, with no automatic retries.
- `npm run test:audit-ui -- salary-interpretation.spec.js job-queue.spec.js
  audit.spec.js --project chromium`: 56 passed on final code, no automatic retries.
- `npm run lint`, `npm run build` and `git diff --check`: passed. The shared helper
  is bundled by Vite without importing server-side clients or credentials.
- Card screenshots at 1440/768/390px were visually inspected. Existing responsive
  layout, actions and text fit are preserved; no stylesheet or JSX changes.
- Firefox emitted nonfatal Vite EBUSY warnings for workspace-local profile locks;
  corresponding browser tests passed.

Initial unit cases caught summary punctuation cleanup stripping rejected salary
signs. It now preserves compensation text. Additional review/tests caught decimal
scaling noise and inherited unit-map keys; expansion is exact and units require
an own dictionary entry. Browser diagnostics caught a cold lazy
route timeout and an incorrect test expectation that Clear filters was visible
with matching results; tests now wait for queue readiness and clear the search
input. No application interaction or assertion guarantee was weakened.

## Separate Production Release Gate

Affected function: **`ingest-job-alert`** only. Its handler is unchanged, but its
reachable shared dependencies are `jobAlertParser.ts` and the new `salary.js`.
RF-15 is not complete merely because this PR passes or the frontend is released.

1. Obtain separate authorization for the reviewed function revision and frontend
   release. Confirm project `qotipygmwlovxklkexjb`, current ACTIVE function metadata,
   `verify_jwt=false`, and that automatic Supabase production sync remains OFF.
   Check the native Deno/bundled dependency graph locally as a release prerequisite;
   this implementation environment has no available Deno executable.
2. Deploy only `ingest-job-alert` from that approved checkout with its shared files.
   After checking the authenticated CLI's help/flags, the intended command is
   `npx --no-install supabase functions deploy ingest-job-alert --project-ref qotipygmwlovxklkexjb --no-verify-jwt`.
   Do not change secrets, Auth, other functions or database objects. No migration
   is needed. Prefer the approved Edge release first, then approved merge/normal
   frontend release, to stop new legacy-parser errors before frontend rollout.
3. Independently verify ACTIVE status, preserved JWT setting and deployed source
   for all three reachable files. Use read-only metadata and naturally arriving
   alerts for release observation; do not inject live synthetic mail or backfill
   old salaries. Retain the previous function revision for a separately authorized
   rollback if needed; do not attempt an automatic rollback or data repair.

No deploy, merge, production operation or integration toggle was performed here.
Until the Edge release, its old parser can still create inaccurate stored bounds;
frontend structured precedence intentionally does not rewrite them.

## Closure and Limitations

RF-14 is closed with PR #27, squash `ee5c6f621b4ef6c2c44ad2a1c72db450a6a609e0`,
successful merged-main CI `38639551805`, matching Vercel Production READY
`dpl_4TN6RDScDHsnKEJaU6x84q1V3ksc`, and user-reported completed UI acceptance.
CI/deployment metadata were independently rechecked read-only.

This is a bounded English salary grammar, not arbitrary international compensation
understanding. Decimal-comma formats, million suffixes, postfix currencies and
unsupported periods/qualifiers are not inferred. Currency/period metadata cannot
be reconstructed from stored numeric-only rows without reliable source text.
No historical correction, exchange-rate conversion or annualization is performed.
Native Deno runtime/type-check and production deployment are not exercised; Node
executes the actual parser/shared module and handler harness, and Vite bundles the
shared dependency. Emulated browser checks are not physical-device certification.
