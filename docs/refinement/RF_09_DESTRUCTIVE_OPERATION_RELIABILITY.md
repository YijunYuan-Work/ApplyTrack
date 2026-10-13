# RF-09: Destructive Operation Reliability

Status: Done; merged-commit CI and Vercel Production independently verified (2026-10-13 America/Toronto).
Baseline: `fe0822059060ddafc82349ddb19e7ef8f9265276` (latest origin/main).

## Correction

F10 cleared selection after every parent callback because those callbacks returned
no outcome (CQ01). The old DELETE API also discarded the server's affected rows;
an empty RLS-filtered result could therefore look like confirmed deletion.

- Single/bulk outcomes are `deleted` with `deletedIds`, `canceled` (confirmation),
  `error` with an actionable message, or `stale` (invalid/changed session).
  A `pending` no-op protects duplicate callbacks. Empty requests report an error.
- DELETE is scoped to owner and requested IDs and uses `.select('id')` after
  filters. Exact unique-ID confirmation is required for every requested record.
  Zero, partial, malformed, duplicate or unexpected IDs are not success.
  This follows [Supabase's DELETE return-row contract](https://supabase.com/docs/reference/javascript/delete).
  Existing SELECT/DELETE owner RLS policies remain unchanged; no absence-only GET
  is used to turn an unconfirmed/RLS-hidden record into claimed deletion.
- Only confirmed success removes records from canonical application state.
  Dashboard removes confirmed IDs from the *current* selection, preserving new
  selections and unrelated fields. Effective selection also intersects canonical
  IDs, so a confirmed removal after Dashboard remount cannot leave a phantom ID
  in the next delete request. Filters/pagination do not prune live selections.
- Pending deletion locks only deletion actions, not selection, filtering, paging,
  status, editing or navigation. A synchronous Dashboard guard covers repeated
  clicks, and the existing workspace epoch owns a single deletion lock across
  Dashboard unmount/remount. A previous epoch cannot release the new epoch's lock.
- Deletion errors live in the originating Dashboard, with `role="alert"`;
  progress uses `role="status"`. Successful retry clears the error. An old view's
  error cannot leak into another route/new Dashboard; navigation is never forced.
  Session-keyed Dashboard state prevents selection/error leakage across accounts,
  including sign-out and back into the same account.
- Demo returns the same logical outcomes and preserves selections on cancel;
  its deletions remain local. Status/full-edit response paths cannot reinsert a
  deleted ID, and unrelated edits remain available while deletion is pending.

F09's Board Select All scope is deliberately unchanged. The combined audit case
was split into its retained RF-11 characterization and corrected F10 tests.
Job Agent deletion/product semantics, bulk import and historical dates are not
changed. No new mutation framework, dependency, schema or style changes.

## Verification

The existing local synthetic HTTP fixture now separately controls DELETE receipt,
commit and response, including row denial/partial results, unexpected responses,
post-commit HTTP failure and delayed delivery. It checks filters at commit time.
RF-07/RF-08 control interfaces and their tests are retained.

26 focused Chromium cases cover single/bulk cancel/fail/retry/success, checked
records, exact IDs, changed selection, duplicate attempts, filtered/paged List,
Demo, navigation/remount, same/other-account epochs and old success/error,
new-session pending locks, zero/partial/malformed confirmations, ambiguous commits,
status/full-edit overlap, unrelated data and 1440/768/390px error/pending feedback.

Local results (2026-10-13):

- `npm test`: 39 passed; `npm run test:audit`: 27 passed.
- `npm run test:auth-ui`: 12 passed.
- `npm run test:audit-ui -- --project chromium`: 99 passed (26 RF-09,
  26 unchanged RF-08, 24 unchanged RF-07 and 23 audit cases after the F09/F10 split).
- Lint, build and `git diff --check`: passed. Three-width overflow checks passed;
  deletion-error screenshots were inspected. No CSS/redesign changes.

The initial focused run was stopped after custom-checkbox input clicks were
intercepted by their decorative spans. Tests now click the existing labels, the
same control a user operates; no checkbox UI changes were made. The complete
final suites passed without retries. No production data was accessed for testing.

## Production Release and Independent Verification (2026-10-13)

After independent review, the user explicitly approved Squash Merge of
[PR #21](https://github.com/YijunYuan-Work/ApplyTrack/pull/21).
GitHub merged the PR into `main` at
`c1fb3a3f403725928b26af90b15c8dd53822d833`. ChatGPT independently
verified the merged-commit GitHub Actions workflow completed successfully:
39 unit tests, 27 audit tests, 12 authentication UI cases, 99 Chromium
functional tests, lint and build; Supabase Preview was skipped as intended.

Automatic Git-triggered Vercel Production deployment was not observed for this
merge commit even after GitHub CI finished successfully. The user separately
approved one manual Vercel Production trigger. A deployment was created using
the existing project GitHub connection, `main` ref and the exact reviewed
merge SHA. Vercel build logs confirmed it cloned `c1fb3a3`.
Deployment `dpl_8VLNVg9ojF1JSDHqWxEcR16ueX2Q`
(`apply-track-mih2h0ghw-yijun-yuan-s-projects.vercel.app`) reached READY
with `target=production` and matching `githubCommitSha`. Project aliases,
including `apply-track-six.vercel.app`, were confirmed on this deployment.
No other deployment was intentionally triggered for RF-09.

No production Supabase migration/data write or Edge Function redeployment was
required or performed. Existing Supabase auto-production-sync and Vercel Preview
holds were not changed. Production release metadata and deterministic local
synthetic HTTP regressions are not a live production DELETE race test.
The reason for the missing automatic Vercel trigger remains a separate
operational issue to investigate; this manual release must not be taken as
confirmation that automatic deploys are healthy.

## Limits and Release

An HTTP failure can occur after commit, and a partial result can reflect a row
cap, missing row or RLS denial. These are explicit *unconfirmed* errors: records
and selection are retained locally rather than inventing success. Retry is
available without reselection after a normal failure. For ambiguous/partial
outcomes, reload to inspect persisted records before further retry; an already
absent record is not silently acknowledged as deleted by a later zero-row request.
This change does not make partial RLS deletions globally all-or-nothing.

Requests already sent before sign-out may still commit to the original account;
their callbacks cannot mutate the new workspace. Cross-device changes are not
live-polled. The workspace deletion lock is in-memory, not a durable job system.
Browser evidence uses synthetic HTTP, not live production RLS/race probes;
Firefox/WebKit are not included in the required Chromium gate.

Frontend-only release completed through an explicitly approved manual
Vercel Production deployment because the usual Git-triggered deployment was
not observed. No migration, Edge Function deploy, Auth, RLS, permission,
secret or production configuration change was required or performed.
Supabase automatic production sync and Vercel Preview holds were not changed.
Temporary files, cache, screenshots and traces stayed in ignored workspace paths.
RF-09 was marked Done after independent code review, merged-commit CI success
and Vercel Production READY confirmation.
