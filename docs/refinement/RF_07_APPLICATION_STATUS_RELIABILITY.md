# RF-07: Application Status Mutation Reliability

Status: In Progress; local implementation only, awaiting ChatGPT review.
Baseline: `b7939caec1d2da9ad755a0b35cc3f62d8d8b9828` (origin/main).

## Cause and Correction

F04 submitted captured full rows concurrently and replaced the entire local row
on every response. R03 reloaded applications whenever the auth `user` object
changed, without reconciling successful mutations made after a GET began.

- Each Application has a FIFO status queue within the current user session.
  Different Applications proceed independently. Duplicate current/queued latest
  selections are no-ops, except an explicit retry after a displayed failure.
- Pending selectors show the latest requested value with `Saving status...`.
  Board placement, metrics and confirmed data change only after confirmation.
  Both Board and List retain enabled controls and per-record announced errors.
- Quick writes PATCH only `status` and local-date `last_updated`. A fresh read
  determines whether Interview must promote zero rounds to one; otherwise
  `interview_count` is omitted. Full edit payload/normalization is unchanged.
- Every PATCH filters by Application ID, owner and the fresh server `updated_at`.
  The existing update trigger changes that timestamp. A delayed abandoned write
  cannot match the version after a newer write commits. Zero-row conflicts re-read
  and retry at most three times, never masquerading as success.
- Responses merge only status-related fields. If a full edit completed meanwhile,
  a fresh status read reconciles rather than applying the older response.
  A read delayed across another local edit is discarded and retried (bounded).
- HTTP failures are reported, including failures after a commit. Status-only
  reconciliation checks what actually saved, without discarding unrelated fields.
  Later queued requests continue; a later success clears that record's error.
  If reconciliation fails, the UI explicitly says saved status is unconfirmed.
- Application loading depends on user identity/session epoch, not refreshed
  metadata objects. A successful mutation invalidates an earlier list snapshot;
  loading fetches again instead of replacing it. Session switches clear queues
  and fence old GET/mutation callbacks, including signing back into the same account.
- Initial server user validation remains authoritative over cached startup
  notifications; a delayed initial check cannot restore an older auth identity.
  Recovery handling, cookie storage, password updates and Auth APIs are retained.
- Demo remains synchronous/local and treats same-status changes as no-ops.

## Verification

The existing HTTP fixture now separates receipt, version-checked database commit
and response delivery. Synthetic timestamps advance per committed write; held
reads preserve their original snapshots. No fixture contacts production.
The F04 characterization asserts serialization and final persisted convergence;
unrelated known-bug characterizations remain intact.

Focused regressions cover rapid changes, late aborted commits, bounded conflicts,
partial writes, rounds/date rules, full edit overlap, first/latest/ambiguous
failures, reconciliation failure/retry, independent records/reversed responses,
auth refresh, delayed list/user reads, session changes, reload and Demo.
Cross-tab initial-auth notification injection uses the installed SDK's broadcast
protocol; normal refresh/sign-out/sign-in tests use real SDK calls.

Local results (2026-10-12 America/Toronto):

- `npm test`: 35 passed; `npm run test:audit`: 27 passed.
- `npm run test:audit-ui -- --project chromium`: 46 passed (22 existing
  audit cases, including corrected F04, and 24 new focused RF-07 cases).
- `npm run test:auth-ui`: 12 passed, including legacy reset links, password
  updates, registration, sign-out and public Demo at 1440/768/390px.
- Lint, build and `git diff --check`: passed.
- Pending/error UI at all three widths passed overflow checks; error screenshots
  were visually inspected. Browser evidence is Chromium only.

Initial focused runs exposed two locator mistakes and auth-test scheduling
conflicts with the SDK lock/startup notifications; these were corrected.
The final full suites above passed without retries. Generated files, screenshots,
traces, npm cache and temp files stay within the Git-ignored workspace.

## Release and Limits

Frontend-only release; no SQL migration, Edge deployment, new dependency or
production permission/configuration change. No production operations were run.
Supabase automatic synchronization and Vercel Preview settings were not modified.

The queue is in-memory, not an offline/resumable job system. Closing a page drops
unsent requests; reload displays persisted state. Conditional writes rely on the
existing server timestamp/update trigger. Separate tabs/devices do not acquire
a global user-intent order; conflicts retry within a bound, then surface an error.
Unrelated concurrent edits made outside this workspace are not live-polled.
Database commit ordering is simulated by the HTTP fixture, not tested on production.
RF-08 form/navigation and RF-09 bulk-selection defects remain out of scope.
