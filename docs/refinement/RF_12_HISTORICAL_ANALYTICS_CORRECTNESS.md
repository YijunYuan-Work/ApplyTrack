# RF-12: Historical Analytics Correctness

Status: In Progress. F08 historical-date persistence requires ChatGPT/user approval.
Baseline: `99dfb56000aa52b3d94231e83a1bab19b94ada08` (latest origin/main).
This slice implements only independent G03 calculations/tests; no schema change.

## F08 Investigation

Progress previously took `lastUpdated` as the Rejected event date and as a candidate
for its initial calendar week. This field means record modification, not rejection.
Notes edits therefore move an event without a status transition. It is not possible
to recover the actual rejection day reliably from existing metadata.

| Path | Current behavior / implication |
| --- | --- |
| Quick status, `src/App.jsx`, `src/api/applications.js` | RF-07 queues per record, captures local request day, reads canonical status/version, performs guarded partial update, reconciles ambiguous outcomes. `last_updated` changes on a successful status write, including leaving/re-entering Rejected. |
| Full saves, `src/data/applicationForm.js`, `src/api/applications.js` | RF-08 always advances Last Updated on edits. Changed-field intent is merged into a fresh row and guarded by `updated_at`; a note edit does not need to include status. |
| Creation, `src/pages/ApplicationFormPage.jsx`, row mapper | Can create an already-Rejected record; applied date and Last Updated do not prove when it was rejected. |
| Excel, `src/utils/excelImport.js` | Has Applied Date and Last Updated, no rejection-date column. Missing Last Updated defaults to import day; historical Rejected status does not imply import-day rejection. |
| Row mapping / normalization | `fromApplicationRow` reads Last Updated; missing values normalize to applied date or local today. This fallback also must NOT be repurposed into a historical-date backfill. |
| Schema, `supabase/schema.sql` | `applied_date` and `last_updated` are nullable dates; `updated_at` is a trigger-maintained timestamp used for mutation fencing. No rejection-event field/history exists. |
| Job Agent conversion | Creates Applied records; no rejection transition. RF-04/05/06 linkage and ingestion remain unrelated and unchanged. |
| Demo, `src/pages/DemoWorkspace.jsx` | Uses the same form helpers and Progress component. Quick status changes advance local Last Updated, preserving the same F08 defect. |
| Calendar / pipeline | Calendar shows an Applied event regardless of current status and a Rejected event only for currently-Rejected records. Pipeline is a current snapshot, not a transition history. |

Transitions away from Rejected currently remove its calendar event. A later return
uses the new Last Updated day. Duplicate Rejected selections are ordinarily ignored
by RF-07; notes/full saves still move the event. A failed HTTP response can follow a
committed write, so a future date must be read back with canonical status, not stamped
optimistically in React. No existing rows or metadata were rewritten here.

## Options and Recommended Contract (NOT Implemented)

1. Freeze or copy Last Updated: insufficient. It already mixes imports, notes,
   status changes and normalization fallbacks; copying it would invent history.
2. One nullable persisted `rejected_date` / frontend `rejectedDate`: smallest useful
   correction; represents the latest known confirmed transition, not a full log.
3. Append-only transition history: preserves every rejection/reopening event, but
   adds storage, permissions and product rules unnecessary for this approved slice.

Recommend option 2, subject to explicit approval of ALL following semantics:

- Existing legacy rows: NULL, with no automatic backfill from any existing date.
- Existing non-Rejected -> Rejected: persist the local request day with the confirmed
  status mutation. Notes/unrelated updates and Rejected -> Rejected retries preserve
  the existing value, including unknown NULL. Retry must not manufacture a new day.
- Rejected -> another status: retain the latest known date. Recommend retaining its
  dated calendar event as historical evidence even while the pipeline is reopened.
  This differs from today's current-status-only calendar and needs approval.
- A later confirmed transition back into Rejected replaces the single latest date.
  Earlier rejection occurrences are not retained. If all events must remain visible,
  reject this recommendation and explicitly approve option 3 instead.
- Newly created Rejected records and historical Excel imports: NULL unless a valid,
  explicit rejection date is supplied. Creating/importing a current snapshot is not
  proof of a transition that occurred today. Never infer from Applied/Last Updated.
- Optional explicit historical-date entry/import and date correction rules need a
  separately approved minimal UI/import contract. No new visible field is added now.
- Unknown dates contribute to snapshot rejection counts, but not dated calendar
  events. No fallback to Last Updated. Any new unknown-date indicator requires design
  approval; no such UI is invented by this PR.
- Preserve date-only local-calendar semantics; do not silently switch to UTC days.
  Document operation day versus actual employer decision day (which may be unknown).

### Next Implementation Slice After Approval

Add only a nullable date column with no default/backfill in a reviewed migration;
update schema, defaults, row mappings and status-select/reconciliation fields.
Reuse RF-07/RF-08's canonical read + `updated_at` compare-and-swap: compute date
changes from the freshly read stored status and the merged intended status inside
each guarded attempt. Do not compute a transition from an old form snapshot.
Reuse a small pure transition helper in Real and Demo instead of new queues.
Late responses, lost acknowledgments and retries must return/reconcile the stored
date with status. Never alter application date or the existing timestamp fence.

This proposed client-write approach covers all first-party writers; it would NOT
automatically enforce transitions for arbitrary direct SQL/third-party writers.
If universal database enforcement is required, separately review a trigger/RPC and
its local-date input contract, rather than defaulting to server UTC `current_date`.
Do not add both competing implementations. SQL/schema code is deliberately absent.
Older already-open browser clients would also remain date-unaware until reloaded;
rollout must accept resulting unknown dates or approve database enforcement before
claiming every writer is covered. No historical backfill can compensate safely.

Future tests must cover legacy NULL, note edits, duplicate/lost-response retries,
leave/re-enter, first-party create/import with explicit/absent dates, concurrent form
and status writes, session changes and canonical reconciliation, with Real/Demo parity.
The existing F08 `BUG` characterization remains intentionally unchanged until that
slice. A green test suite in this PR does NOT claim F08 has been fixed.

## Independent G03 Findings and Corrections

Two independent defects reproduced from the baseline source under Node:
`getWeekRangeLabel(getWeekKey(getDateFromKey('zzzz')))` throws RangeError;
`interviewCount: Infinity` produces an infinite interview total. Invalid calendar
days could normalize to another day/week while their original invalid key had no
renderable event, causing a phantom latest week. Real DB date/integer columns normally
exclude these inputs, but frontend analytics should not crash on malformed datasets.

`src/data/progress.js` now holds the existing pure Progress calculations so unit tests
exercise the actual page logic without JSX/source emulation. Progress UI, colors,
labels, CSS, form/status APIs and persistence are unchanged.

- Validate real Gregorian date keys (including leap/century rules); preserve valid
  ISO timestamp prefix compatibility without converting the key to a UTC day.
- Exclude invalid/missing event dates and choose the initial week from the same valid
  grouped events that the calendar renders; no dates synthesized by analytics.
- Local date construction avoids JavaScript's 1900 offset for years 00-99.
  Internally generated week days can straddle four-digit event-year edges without
  invalidating the week; event keys still require valid four-digit AD dates.
- Ignore non-finite/negative interview rounds in Progress calculations only. No
  stored/user data or global normalization behavior changes; valid counts unchanged.
- Sort grouped events once per day rather than after every insertion.

### Intentional Semantics Preserved

Applications counts all loaded rows. Interviews held sums recorded rounds, not
application count. Reached interview includes positive rounds OR Interview/Offer
status; zero-round Offer/Interview records can therefore increase reached counts
without inventing completed rounds. Offers counts current Offer status.
Positive-round Applied rows remain reached interview/still in progress. Rejections
split before/after interview using the same reached predicate. Zero branches are
omitted; every nonempty branch conserves incoming/outgoing application flow.
Compact bars are percentages of ALL applications, individually rounded. Reached
interview is a parent of its outcome bars, so adding every displayed bar percentage
is not meaningful. Calendar totals count events, not unique records; Applied and
Rejected on one day count twice. Initial week is latest event, not necessarily today.
These are existing semantics, not independent bugs corrected in this slice.

Dashboard's interviewed-application subtitle counts only positive recorded rounds,
unlike Progress's status-aware reached count. Both preserve current definitions;
unifying wording/semantics is a product decision, not silently changed here.

## Verification

Deterministic Node coverage includes an independently counted mixed dataset, all
4,096 subsets of a 12-record status/count matrix, Sankey conservation at every node,
empty/invalid counts, Applied/Rejected co-occurrence, sorted events, missing/invalid
dates, leap years (including 1900/2000), year/month boundaries, reversible weekly
navigation and Real row-map/Demo parity. Five isolated processes verify UTC,
Toronto, Los Angeles, Kiritimati and Kolkata date-only/midnight behavior and DST weeks.

Seven focused Playwright cases verify rendered map nodes/links or compact counts and
percentages, Real/Demo parity without Demo network writes, invalid dates, empty and
undated sets, year boundaries, leap days, phone expansion and responsive overflow.
Screenshots use only synthetic records and remain Git-ignored in `test-results/`.

Final local gates (2026-10-13, America/Toronto):

- `npm test`: 54 passed, including 15 new Progress tests.
- `npm run test:audit`: 28 passed.
- `npm run test:audit-ui -- --project chromium`: 152 passed in the final full run,
  including RF-07/08/09/10/11 and the deliberately retained F08 characterization.
- `npm run test:audit-ui -- progress-analytics.spec.js --project firefox --project
  webkit`: 14 passed (7 per browser) against the final source.
- Lint, build and diff whitespace check passed. Desktop/tablet/phone screenshots
  were visually inspected. Presentation JSX is source-identical to baseline and
  CSS is untouched; document-level overflow assertions passed. This does not
  claim the inherited tablet internal clipping noted below is resolved.
- `npm run test:auth-ui`: 12 passed. Final browser runs used no automatic retries.

Initial browser assertions were corrected to compare DOM text with DOM text rather
than CSS-transformed innerText, exclude the expansion-control list item from event
counts, and wait explicitly for the cold lazy-loaded Progress panel. The restricted
runner stalled before browser tests; it was stopped and the same localhost-only
fixture was run with subprocess permissions. No production endpoint was tested.
Vite emitted nonfatal workspace-local Firefox profile-lock EBUSY warnings. One
initial full Chromium run exceeded the existing 30-second first CRUD test limit
while reporting `Loading your workspace`; subsequent results are recorded separately,
without removing that test or weakening its assertions.
The final full run passed with the original timeout and no automatic retries.

## Boundaries, Risks and Approval Gate

- F08 remains visible until approved persistence and calendar semantics are implemented.
- Historical rejection dates cannot be reconstructed from the current schema. Accept
  NULL or approve explicit user input; no inference/backfill is authorized.
- Selection/analytics cover the currently loaded dataset; R02's Applications API cap
  risk remains separate. No completeness claim for an unbounded server dataset.
- Excel's existing Date/UTC parsing and missing-date defaults are not changed here.
  Import provenance/date policy needs explicit treatment in the next historical slice.
- Screenshot inspection found the tablet calendar can clip its Next control and
  inner calendar content despite passing document-overflow checks. Progress JSX
  presentation and CSS are unchanged; this inherited responsive issue is not fixed
  or claimed resolved by an analytics PR. It needs a separately scoped UI refinement.
- No Auth, migrations, schema, API writes, Edge Functions, secrets, production data,
  cloud settings, dependencies or presentation redesign changed. Supabase auto-sync
  stays under the existing OFF hold; no manual deploy or merge performed.
- Stop for ChatGPT/user approval of date meaning, legacy/create/import NULL policy,
  leave/re-entry behavior and any explicit-date UI before implementing persistence.
