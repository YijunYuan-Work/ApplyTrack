# RF-12: Historical Analytics Correctness

Status: Done. Approved migration and frontend release completed; user acceptance complete.
G03 investigation: [PR #24](https://github.com/YijunYuan-Work/ApplyTrack/pull/24),
squash `c1c3a5de5bfa578a05bef94f5d3fca37314960be` (F08 implementation baseline).
F08 implementation: [PR #25](https://github.com/YijunYuan-Work/ApplyTrack/pull/25),
squash `8e72507a3345ee7819960ad76f7baaaf1894da85`.

## Production Closure (2026-10-14)

- Authorized CLI release registered `20261014033558_application_rejection_date.sql`
  as version `20261014033558`, name `application_rejection_date`, before frontend
  release. All 12 historical migrations matched and it was the only pending file.
- Migration-time verification: nullable DATE, no default; 420 applications before
  and after, identical old-row/historical-date aggregate checksums, all new dates
  NULL. RLS, policies, existing ACLs, RPCs and triggers were unchanged. A zero-row
  Data API probe selected the column successfully (HTTP 200); project healthy.
  These are the prior authorized release results, not new production SQL in RF-13.
- Merged-main CI [38513271988](https://github.com/YijunYuan-Work/ApplyTrack/actions/runs/38513271988)
  completed successfully on `8e72507a3345ee7819960ad76f7baaaf1894da85`.
- Vercel Production `dpl_E9AcyAUnAFh9sdLoRJNmRraWn9jg` is READY on that exact SHA.
  CI and deployment metadata were independently rechecked read-only during RF-13.
- User functional acceptance is complete, as reported by the user. No additional
  production-user mutation test was performed during RF-13.
- Remaining data/client limitations are retained below. Tablet Calendar clipping
  is investigated in [RF-13](RF_13_RESPONSIVE_NAVIGATION.md), not retroactively
  claimed fixed by RF-12. Supabase automatic production synchronization remains OFF.

## F08 Investigation

Progress previously took `lastUpdated` as the Rejected event date and as a candidate
for its initial calendar week. This field means record modification, not rejection.
Notes edits therefore move an event without a status transition. It is not possible
to recover the actual rejection day reliably from existing metadata.

The following table records the pre-F08 behavior investigated in PR #24.

| Path | Pre-F08 behavior / implication |
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

Transitions away from Rejected previously removed its calendar event. A later return
uses the new Last Updated day. Duplicate Rejected selections are ordinarily ignored
by RF-07; notes/full saves still move the event. A failed HTTP response can follow a
committed write, so a future date must be read back with canonical status, not stamped
optimistically in React. The fix must not rewrite unknown historical dates.

## Approved Contract and Implementation

`20261014033558_application_rejection_date.sql` adds one nullable `date` column,
`rejected_date`, with no default, backfill, new trigger or permission change. Canonical
schema/defaults/mappers expose `rejectedDate`, normalizing absent/invalid values to
NULL, never another record date. The old F08 characterization is replaced by a
desired-behavior regression.

- An existing non-Rejected -> Rejected transition writes the local operation day
  atomically with status. It describes when the transition was recorded, not when
  the employer actually decided. Repeated Rejected updates preserve date or NULL.
- Notes, Salary and unrelated edits never change it. Leaving Rejected retains the
  date/event. Re-entering replaces it; this is latest-known history, not an event log.
- New Rejected snapshots and legacy/imported records remain NULL unless a valid
  explicit date is supplied. No inference from applied/updated/import dates.
- Calendar uses only `rejectedDate`, regardless of current status. Unknown dates
  still contribute to current-status counts, not dated events. G03 pipeline metrics,
  date validation, local calendar navigation and presentation are preserved.

Quick writes pass each fresh canonical status to the existing partial-payload mapper.
Full saves derive the date from canonical status plus merged intent inside every
`updated_at` guarded attempt. The form's stale `rejectedDate` is excluded from edit
intent. Its freshly prepared Last Updated is the operation-day input, NOT the stored
metadata value. The pure transition helper is reused in Demo. Invalid operation days
fail before a transition write instead of inventing a date.

RF-07's status response/reconciliation projection now includes the date; RF-08's full
row reads/merge remain canonical. Lost acknowledgments and later retries re-read the
already-Rejected row and omit a new date. Existing response/session fences, bounded
contention, queues, navigation, form locks and RF-09 deletion behavior are unchanged.
No manual date-entry or new UI is introduced.

Excel optionally accepts `Rejected Date`, `Rejection Date`, `Date Rejected` or
`Rejected On`: strict ISO date-only strings, valid Excel dates or serial dates.
Missing/invalid values stay NULL; typed dates use local calendar components.
Existing Applied/Follow-up/Last Updated parsing is untouched. Synthetic Demo fixtures
now explicitly declare their known dates; this is not a user-data backfill.

## Independent G03 Findings and Corrections

Two independent defects reproduced from the baseline source under Node:
`getWeekRangeLabel(getWeekKey(getDateFromKey('zzzz')))` throws RangeError;
`interviewCount: Infinity` produces an infinite interview total. Invalid calendar
days could normalize to another day/week while their original invalid key had no
renderable event, causing a phantom latest week. Real DB date/integer columns normally
exclude these inputs, but frontend analytics should not crash on malformed datasets.

PR #24 moved existing pure Progress calculations into `src/data/progress.js` so tests
exercise the actual page logic without JSX/source emulation. Progress UI, colors,
labels and CSS remain unchanged. Its metric and date-validation fixes are retained.

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

## G03 Verification (PR #24)

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

## F08 Verification

New unit cases cover row/null/explicit mappings, transitions, stale form intent,
reopen/re-enter, unknown calendar dates and explicit/absent/invalid XLS/XLSX imports.
Nineteen focused Playwright cases cover local midnight, both save paths, failed and
ambiguous commits, next-day retries, canonical conflicts, concurrent notes/status in
both orders, delayed full/quick responses, old-session fencing, create/import and
Real/Demo workflows at 1440/390px. G03 responsive/calendar regressions are retained.

PostgreSQL 17 runner: fresh schema and migration replay both passed. The exact new
migration preserved legacy rows (including a rejected fixture with unrelated dates),
RLS, ACLs, RPCs and triggers, leaving all old rejection dates NULL. Owner operations,
invalid Gregorian dates and cross-owner denial passed in both databases, alongside
existing RF-04/05/06 SQL/concurrency/real-handler tests. This is synthetic PostgreSQL,
not a hosted Auth/PostgREST integration or production history-registration claim.
The first run failed in the image's pre-existing GraphQL schema hook before the new
migration; the unchanged runner passed on retry. No image/schema workaround was added.

Initial new browser tests were corrected for Dashboard remounts, form-route readiness,
ambiguous Status labels, required Real ID/version fixtures and import confirmation.
The first full Chromium run passed 170 cases and exposed one old RF-07 expectation
of NULL after Interview -> Rejected -> Offer. That assertion now checks the approved
retained date, and the final full run passed all 171 cases without automatic retries.
All artifacts use synthetic records and stay Git-ignored inside the workspace.

Final local gates (2026-10-14, America/Toronto):

- `npm test`: 60 passed.
- `npm run test:audit`: 28 passed.
- `npm run test:audit-ui -- --project chromium`: 171 passed.
- `npm run test:audit-ui -- rejection-dates.spec.js progress-analytics.spec.js
  --project firefox --project webkit`: 52 passed (26 per browser: 19 F08 and 7 G03).
- `npm run test:auth-ui`: 12 passed with the synthetic backend.
- `npm run test:audit-db`: fresh schema and migration replay passed, including
  RF-04/05/06 compatibility and 26 real-handler SQL tests in each database.
- Lint, build and `git diff --check` passed. Progress presentation JSX, CSS, Auth,
  Edge Functions, integration configuration and dependencies are unchanged.
- Desktop/tablet/phone Calendar screenshots were inspected; inherited tablet
  clipping remains a separately documented limitation, not a claimed fix.

Browser runs used no automatic retries. Vite emitted nonfatal EBUSY warnings while
watching workspace-local Firefox profile locks; those tests passed.

## Reviewed Production Release Procedure (Historical)

This records the reviewed migration-first procedure followed for the completed
release above. Do not rerun it as part of RF-13. Vercel main merges may deploy the
frontend automatically; database verification preceded the separately authorized
merge. Supabase Git automatic production synchronization remains OFF.

1. Gate A: independent code/migration review and explicit production migration
   authorization. Use the approved PR revision, not an unreviewed working copy.
2. Verify the linked project is `qotipygmwlovxklkexjb`. Use the reviewed Supabase CLI;
   list history and dry-run. STOP unless every historical version matches and the
   ONLY pending file is `20261014033558_application_rejection_date.sql`.
3. Apply that migration through the version-preserving CLI only after Gate A. Do not
   repair history, include unrelated migrations/seeds/roles or update shared secrets.
   CLI 2.120.0 help shows Vault updates are otherwise included, so use `--skip-vault`:

```powershell
npx --no-install supabase migration list --linked
npx --no-install supabase db push --linked --dry-run --skip-vault
# Prior authorized release used cached supabase.exe 2.120.0 with these flags:
npx --no-install supabase db push --linked --skip-vault
```

4. Read-only verification must confirm exact history version/name, nullable date with
   no default, preserved row counts/security and no historical backfill. STOP on any
   discrepancy or partial error; no unreviewed repairs.

```sql
select version, name from supabase_migrations.schema_migrations
where version = '20261014033558';
select data_type, is_nullable, column_default from information_schema.columns
where table_schema = 'public' and table_name = 'applications'
  and column_name = 'rejected_date';
select count(*) as applications, count(rejected_date) as known_rejection_dates
from public.applications;
```

5. Confirm the Data API schema cache exposes the new column using an authorized
   owner read. Gate B: separately authorize merge/application release ONLY after
   database verification. No Edge Function deployment is needed. Keep auto-sync OFF.
6. Verify Vercel Production READY on the approved merge SHA. With an independently
   authorized operator-owned test record, verify rejection, notes edit, reopening,
   re-entry, reload and Calendar. Do not mutate real records or create live test data
   without explicit permission. No production smoke mutations occurred in this task.

Rollback: stop the frontend rollout or restore the approved prior frontend through
the normal separately authorized process. Leave the additive column, recorded values
and migration history intact. Do not DROP the column, null dates or undo history.
Old clients do not provide the new historical semantics; do not claim they do.

## Remaining Limitations

- Historical unknown dates cannot be reconstructed; no inference/backfill is allowed.
- First-party CAS handles supported writers. Direct SQL/third-party writers and old
  already-open browser clients do not automatically record transitions. Require users
  to reload into the approved frontend for supported behavior; old writers may leave
  NULL or a retained older date. Database universal enforcement is not implemented.
- Selection/analytics cover the currently loaded dataset; R02's Applications API cap
  risk remains separate. No completeness claim for an unbounded server dataset.
- Existing date parsing/defaults outside the new explicit rejection column remain unchanged.
- RF-12 screenshot inspection found the tablet calendar can clip its Next control and
  inner calendar content despite passing document-overflow checks. Progress JSX
  presentation and CSS were unchanged by RF-12; clipping was not fixed or claimed
  resolved by the analytics PR. The separately scoped RF-13 correction
  and verification are documented in its implementation report.
- RF-12's authorized additive migration and frontend release are complete. No
  historical backfill or unrelated Auth, Edge Function, secret or integration change
  was part of that release. RF-13 performs no new production Supabase operation.
