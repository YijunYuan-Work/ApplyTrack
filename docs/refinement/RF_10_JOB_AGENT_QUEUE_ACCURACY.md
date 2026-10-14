# RF-10: Job Agent Queue Accuracy

Status: Completed; PR #22 merged and matching Vercel Production release verified.
Baseline: `a74a8afe324b9b9d333e6e9742fb187ab6d01069` (origin/main).

Changed files: `src/api/jobAgent.js`, `src/App.jsx`,
`src/components/JobMatches.jsx`, `src/pages/JobAgentPage.jsx`,
`src/pages/DemoWorkspace.jsx`, `src/pages/DashboardPage.jsx`,
`tests/refinement-02/edge.test.mjs`, `tests/refinement-02/ui/fixtures.js`,
`tests/refinement-02/ui/audit.spec.js`, `tests/refinement-02/ui/job-queue.spec.js`,
`docs/refinement/REFINEMENT_MASTER_PLAN.md` and this report.

## Corrections

F07 counted/deleted the first 500 fetched Leads, while Dashboard counted an
unpaginated response subject to PostgREST row caps. F16 used the same empty state
for an empty queue and a nonempty queue with no matching search results.

- Waiting is exactly `state = 'new'`; the schema allows New, Applied and Expired.
  All queries are explicitly owner-scoped in addition to unchanged user RLS.
- Matches requests one 20-row page from the server, ordered by discovery timestamp
  descending then ID descending. Search covers company/title/location across the
  whole queue; LinkedIn/Indeed filtering remains. No 500-row display window or
  unbounded browser dataset. Exact counts distinguish matching results from the
  total waiting queue; Dashboard also uses HEAD/exact counts for Applied/New.
  See the [Supabase count contract](https://supabase.com/docs/reference/javascript/select).
- Missing counts, failed requests or a response shorter than the counted page
  produce an explicit reloadable error, never an empty queue. This also detects
  a server row cap below the 20-row page size rather than silently losing records.
  Offset pagination is not a snapshot: incoming/removing jobs can shift pages.
  Reload gives current results; out-of-range pages clamp after changes.
- A filtered-empty queue offers Clear filters. A genuinely empty queue retains
  its existing experience. Changing filters resets pagination to page one.

## Remove All Contract

Remove All ignores search/source/page filters and covers the owned waiting queue.
Before confirmation, one count/max-ID query captures an upper ID boundary and
current count. Cancel performs no DELETE. The operation scans ascending IDs up to
that boundary, in batches of at most 100; after a capped response, it continues
from the last actual returned ID, not an assumed full batch or shifting offset.
Only a bounded batch of IDs is held in memory.

Every DELETE rechecks owner, `state = 'new'` and `application_id IS NULL`. It asks
for affected IDs and an exact affected count, validates unique/requested IDs and
counts only confirmed rows. A count/returned-ID mismatch (including a cap changed
after scanning) is explicitly incomplete confirmation, not full success.
If requested IDs are not returned, a read checks whether any remain waiting;
remaining waiting rows are an explicit failure, not successful removal.
An end-of-operation exact count checks the entire original ID boundary. Associated
Applications are never deleted. Stale New Leads with an association are protected
and reported for reload/retry; RF-06's conversion repair remains unchanged.

These are separate HTTP transactions, not atomic all-or-nothing removal:

- A conversion committed before the DELETE locks/rechecks its row protects the
  Applied Lead. If DELETE wins first, conversion may fail because its Lead is gone;
  the existing RPC transaction prevents an orphan Application. No client can
  guarantee that a simultaneous conversion always wins.
- IDs allocated after the boundary are kept, including a later alert that
  recreates a removed job. Already allocated, lower-ID inserts that become visible
  during removal can fall inside the boundary. This is an ID-bounded operation,
  not a transactionally frozen set of IDs. Final verification detects visible
  waiting rows missed behind the scan; it cannot stop arrivals after that read.
- Earlier confirmed batches stay committed after a later failure. Error feedback
  states confirmed progress and possible ambiguous completion; a new attempt
  captures a fresh boundary and processes remaining jobs. No automatic retry of
  an unconfirmed write and no fabricated deleted count after a lost response.
- Queue/summary are re-read after success or failure. A displayed zero is a server
  count from a fresh read, not subtraction from a capped client snapshot.

An authenticated workspace owns the synchronous mutation lock across navigation
and remounts. Sign-out/re-sign-in creates a different epoch, even for the same
account. Old responses cannot update the new workspace, unlock its operation or
start another batch. An already issued request can still commit for the original
owner; frontend cancellation is not database rollback. Navigation remains usable.
Local notices/errors are restricted to the originating navigation lifecycle.
Demo uses the same waiting/filter/pagination/scope rules with local state only.

## R04: Removal Is Not Permanent Suppression

RF-05 `finish_job_alert_message` inserts absent `(user_id, source, external_id)`
keys and refreshes metadata without changing existing state/associations. DELETE
leaves no tombstone. A later distinct alert can recreate a removed Lead as New.
Redelivery of the already-completed *same message* remains idempotent and does
not recreate it. The real-handler regression tests both cases; its RPC double
models the unchanged SQL, not a new production HTTP/SQL test.

Permanent suppression would require a separate product decision. No tombstone,
blocklist, table, ingestion behavior, RF-05 lease or RF-06 RPC was changed.

## Verification and Boundaries

Focused synthetic HTTP tests model exact count headers, ranges, owner/state/null
filters, stable ordering and capped reads, with separately controlled DELETE
commit/response. They cover queue sizes 0/1/499/500/501/1203, mixed states, protected
associations, global search, source-empty results, reset/clamping, cancellation,
failure/partial/lost/malformed responses, earlier committed batches, retry,
new arrivals, single/bulk conversion overlap, duplicate actions, remounts, same/other-user
epochs, delayed filter responses, Demo and 1440/768/390px overflow/screenshots.
F07/F16 characterizations now assert corrections; unrelated known-bug tests and
RF-07/08/09 regressions are retained.

Local gates (2026-10-13, America/Toronto):

- `npm test`: 39 passed.
- `npm run test:audit`: 28 passed, including the added R04 real-handler case.
- `npm run test:auth-ui`: 12 passed on the final independent run.
- `npm run test:audit-ui -- --project chromium`: 129 passed (30 RF-10,
  26 RF-09, 26 RF-08, 24 RF-07 and 23 existing audit cases).
- Lint, build and `git diff --check`: passed.
- Overflow checks passed at 1440/768/390px in Real and Demo Matches. Desktop and
  phone screenshots were visually inspected. No CSS or design changes.

Early focused runs exposed count headers not readable without the fixture's
`Access-Control-Expose-Headers`, incorrect assumptions about the number of Demo
waiting Leads, and navigation assertions before a route transition completed.
These fixture/test issues were corrected rather than changing product behavior.
One authentication suite run timed out on its first lazy Progress load while
another UI suite was running; the unmodified suite then passed independently.
The final full Chromium run passed without retries. Firefox/WebKit were not run.

Docker's Linux-engine named pipe was unavailable during this task. PostgreSQL
integration/migration replay was not rerun; no production or schema/RPC changes
are proposed. Synthetic tests do not certify live PostgREST concurrency, RLS
configuration or performance under very large queues. Exact counts and substring
search can cost more database work than capped local filtering; no indexes or
new infrastructure are introduced without measured need.

No database migration, Edge deployment or special SQL release step is required.
No production data accessed, no secrets/configuration changed and no deployment
triggered intentionally. Supabase automatic production synchronization and Vercel
Preview stay under their existing OFF hold; read-only branch deployment checks
are evidence of no observed Preview, not an independent saved-toggle verification.
## Production Completion

The user authorized closing RF-10 after independent review and release.
[PR #22](https://github.com/YijunYuan-Work/ApplyTrack/pull/22) was squash merged as
`f7f0d98e8910f12b999488ac119038cc64306bd2`, also confirmed by fetched GitHub main.
During RF-11 preparation, read-only Vercel deployment-list and deployment-detail
queries independently confirmed Production deployment
[`dpl_4BGzdXTx8BTMMYCZLngaFRmGWmMZ`](https://vercel.com/yijun-yuan-s-projects/apply-track/4BGzdXTx8BTMMYCZLngaFRmGWmMZ)
is READY, sourced from GitHub main at that exact SHA. Its assigned aliases include
`apply-track-six.vercel.app`; ready timestamp is 2026-10-13 23:00:19 UTC.
This metadata verification did not deploy anything or access private user data.
No live authenticated ingestion/deletion test or fresh PostgreSQL replay is
claimed. Future releases still require matching the reviewed merge SHA to CI
and Vercel Production; RF-11 remains a separate unmerged task.
