# RF-08: Application Form and Save Lifecycle

Status: In Progress; implementation prepared for ChatGPT review.
Baseline: `14e2e1e` (latest origin/main at task start, 2026-10-12).

## Causes and Correction

F13 trimmed required values only in the parent, then silently returned. CQ01
caught persistence errors without telling the form what happened. F14 navigated
unconditionally from the parent after any successful save. Full edits also wrote
the entire snapshot captured when the form opened, including outdated status and
rounds, and could replace newer local data with a delayed response.

- Shared pure validation/preparation trims Company/Role and optional strings,
  retains literal Notes and local-date rules, and promotes Interview/zero rounds
  to one. Invalid submissions announce an alert, describe invalid fields and
  focus the first invalid input without issuing a database request.
- Real and Demo return `{ status: 'saved' }`, `{ status: 'invalid', errors }`,
  `{ status: 'error', message }`, or `{ status: 'canceled' }` for a stale session.
  The form owns validation/server feedback and input, locks repeated submits,
  and allows a retry after failure. Unknown outcomes are not success.
- Only the still-active originating form navigates on saved. Unmount, route
  change and session-key changes invalidate it, including leaving and returning
  to the same URL. Old save errors never become global Dashboard errors.
  Existing unsaved-change confirmations remain; sidebar navigation during a
  save is still available.
- Full editing remains a complete form, but its persistence intent contains
  only fields changed from the initial normalized values plus Last Updated.
  Untouched status, rounds, Notes, Salary and dates belong to the fresh record.
  Explicitly edited fields win on a successful conditional commit. Interview
  promotion and today's local Last Updated remain the existing save rules;
  historical rejection-date semantics are not changed.
- Full edit GET/PATCH filters include owner and ID. PATCH also requires the fresh
  server `updated_at`, like RF-07. A zero-row conflict re-reads/merges/retries at
  most three times, then reports failure. A missing timestamp fails closed.
  No schema, RLS, RPC, Edge Function or status queue changes are needed.
- If another local mutation replaced this record while a full edit response was
  delayed, a fresh full-record read reconciles rather than applying the stale
  row. A read overlapping another confirmed local mutation retries within a
  bound. RF-07's partial status merge/reconciliation and session epoch remain
  authoritative; no second mutation state system is introduced.

## Verification

The local HTTP fixture separates save arrival, database commit and response
delivery. It retains RF-07's control interface, version matching at commit time,
and abort/ambiguous-status tests. Only synthetic local endpoints are allowed.
F13/F14 characterizations now assert the corrected behavior; RF-07 and unrelated
characterizations are retained.

RF-08 adds four pure unit tests and 22 Chromium regressions: individual trimmed
validation/correction, Real/Demo parity, create/edit failure and retry, duplicate
submits, delayed navigation and new same-route forms, same/different-account
sessions, unsaved-change confirmation, both status/edit commit orders, old full
responses after status/full edits, conflict retries/bounds, fresh-read session
cancellation, missing timestamp, reload and 1440/768/390px overflow/accessibility.

Final local results (2026-10-12):

- `npm test`: 39 passed; `npm run test:audit`: 27 passed.
- `npm run test:audit-ui -- --project chromium`: 68 passed, including all
  24 unchanged RF-07 cases, 22 existing audit cases and 22 RF-08 cases.
- `npm run test:auth-ui`: 12 passed; authentication APIs/settings unchanged.
- Lint, production build and `git diff --check`: passed.
- Validation/server-error screenshots at 1440/768/390px were inspected;
  responsive overflow checks passed. No CSS or visual redesign changes.

Early focused runs found incorrect test label/Notes-container locators and a
missing Dashboard navigation step; those were corrected before the final full
run. The pure preparation helper also handles nullable optional strings.
Final full runs passed without retries. Screenshots/traces/cache and temp files
remain in ignored workspace directories. Browser race evidence is synthetic
Chromium, not a production database concurrency test; Firefox/WebKit untested.

## Boundaries and Limits

Frontend-only release through the normal reviewed main deployment; no SQL,
Edge Function deployment, secret, Auth or permission change is required.
Supabase auto-production-sync and Vercel Preview holds are not changed. No merge,
manual deployment, production write or paid infrastructure is authorized here.

Conditional writes use the existing timestamp trigger and bounded retries,
not global cross-tab/device intent ordering. Unchanged fields preserve current
server values; conflicting explicit edits follow successful commit order.
An already-sent request may commit after sign-out, but its callback cannot alter
the new session. Reload fetches persisted state. Demo remains in-memory.

As before, a lost create response after a real database commit is ambiguous:
this patch prevents simultaneous submits but does not add a durable create
idempotency key. On network ambiguity operators/users should check the tracker
before retrying creation. Full-edit PATCH retries are field-scoped; HTTP failure
is never reported as saved, even if a write may have committed. Failures during
post-save reconciliation report uncertainty rather than claiming confirmation.

RF-09 bulk mutation outcomes, historical-date decisions and unrelated known bugs
remain separate. RF-08 is not marked Done before independent review/release.
