# RF-14: Public Demo Interaction Accuracy

Status: In Progress; implementation pending independent review, acceptance and release.
Baseline: main `187125a1ea3d0483574664d5fbaf137d6d7a1774` (RF-13, PR #26).
Review: PR link pending creation.

## Root Cause and Correction

F12: `DemoWorkspace` passed an async no-op password callback to `ProfilePage`.
The shared form interpreted its resolved promise as a successful password update,
cleared the inputs and announced success, even though no personal account existed.

- `ProfilePage` now renders a named, static Password section in Demo mode instead
  of a form. It explains: "Password changes are unavailable in Demo mode because
  this workspace does not use a personal account." The Demo header also avoids
  implying that the user is managing personal account security.
- Removed the unnecessary Demo callback. No password inputs, visibility toggles,
  update action or password-success feedback are rendered in Demo Profile.
- The authenticated form, validation, submit handler and callback contract are
  unchanged (form source parity checked ignoring indentation). `App.jsx`, Auth API,
  session handling, recovery flows and stylesheets are unchanged.
- Reused the existing Profile panel classes, heading and responsive layout. No new
  navigation, visual redesign, simulated credential storage or backend was added.

## Verification

Browser tests use synthetic backend responses and intercept all non-local
requests. Demo assertions require zero authentication/persistence requests and
zero blocked external attempts. No real account or production data is used.
Generated screenshots/traces stay ignored inside `tmp/rf14.local/`.

- Replaced F12's false-success characterization with a regression for the
  explanation, absent form/actions/success and preservation of local application
  changes across Profile navigation.
- Updated the existing responsive Demo and authentication regressions to assert
  the corrected contract rather than continuing to expect password controls.
- Added six focused cases per browser: Demo and authenticated Profile at 1440,
  768 and 390px. They cover direct Demo routes/reload, named region semantics,
  scoped WCAG A/AA axe checks, keyboard-operated navigation across all main pages,
  absence of overflow, real password minimum length/mismatch validation, failed
  write feedback and retry/success, cleared inputs and unchanged user metadata.
- Removed an obsolete tablet-to-desktop test workaround: RF-13 already restored
  tablet Sign Out, which is now exercised at the actual tablet width.

Final gate results:

- `npm test`: 60 passed; `npm run test:audit`: 28 passed.
- `npm run test:audit-ui -- demo-profile.spec.js audit.spec.js --grep
  'RF-14|responsive public demo workflows' --project chromium --project firefox
  --project webkit`: 30 passed (10 per browser), no automatic retries.
- `npm run test:audit-ui -- --project chromium`: 198 passed, no automatic
  retries, including prior mutation/selection/queue/date/navigation regressions
  and Demo edit, delete, import, inbox pause/rotate and lead conversion workflows.
- `npm run test:auth-ui`: 12 passed, no automatic retries, including sign-in,
  sign-up, real password update/Sign Out at all three widths, preserved metadata
  and session cookies, errors/validation and supported legacy recovery links.
- `npm run lint`, `npm run build` and `git diff --check`: passed.
- Desktop/tablet/phone Demo Profile screenshots were visually inspected; existing
  panel styling/navigation are retained and the explanation wraps without overlap.

Initial focused/authentication runs exposed test assumptions, not application defects:
Supabase SDK requests include null PKCE fields, and the first cold Progress module
load exceeded the default assertion timeout. A request-isolation assertion also
needed to recognize existing read-only HEAD count requests. Tests now assert
password values and
absence of metadata/email writes without assuming the SDK's entire wire shape;
navigation waits for the actual lazy-loaded heading with a bounded timeout.
Final gates passed after correcting these assertions. Vite emitted nonfatal EBUSY
warnings while watching workspace-local Firefox profile locks; Firefox tests passed.

## RF-13 Closure

Master Plan and RF-13 report now record PR #26, squash merge
`187125a1ea3d0483574664d5fbaf137d6d7a1774`, successful merged-main CI
`38598273428`, matching Vercel Production READY deployment
`dpl_kNnEuA8jq1g5BBAbGCpr5LBYQ1kA` and completed user UI acceptance.
CI/deployment metadata were independently checked read-only; UI acceptance is
reported by the user. Existing RF-13 limitations remain documented.

## Boundaries and Remaining Limitations

No database migration, Edge Function change, production operation, dependency,
integration toggle, manual deployment or merge. Supabase automatic production
synchronization remains OFF; no setting is modified by this task. No backend
release is required. After independent review and user acceptance, this is a
frontend-only release through the normal approved merge process.

Synthetic authentication tests validate the real client/UI contract, not live
Supabase password delivery or account policy. Emulated browser checks and scoped
axe results are not physical-device or screen-reader certification. Demo data
continues to be local, simulated and non-persistent across full reloads. Other
audit findings are not closed by this fix.
