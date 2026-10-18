# UI-05: Profile and Remaining Pages

Status: ready for independent review; local verification complete; not merged.
Independent ChatGPT review and user visual acceptance are required before merge.

## Authority

- Base main: `303ddb5b6f5a74d9b4be9853648facb0127370b1` (UI-04 PR #32).
- [Merged-main CI 39084098898](https://github.com/YijunYuan-Work/ApplyTrack/actions/runs/39084098898)
  verified completed/success at that exact SHA.
- Branch: `codex/ui2-remaining-pages`.
- Profile: unchanged `UI_update` artifact
  `new_design/ApplyTrack Version B - Teal Terracotta.html`, commit
  `c3a18b349adff6ed54e4608cd11dd2bde3fa3bed`.
- Import/Auth/Reset: unchanged `UI_update` artifact
  `new_design/ApplyTrack UI 2.0 - Remaining Screens.html`, commit
  `63394fae41fbd5ad989d5ce01749b41041b626ee`.

Both complete exports, responsive rendering logic and state controls were read.
Captured source files were byte-verified against their canonical Git artifacts.
Review controls, simulated responses and fabricated account data are not shipped.

## Implementation

Profile uses the Version B identity/security layout with actual available account
metadata, existing password validation and confirmed update handling. Shared
`PasswordField` and `PasswordGuidance` components provide independent visibility
toggles, a four-segment informational strength meter and accessible requirement
states. The actual password policy remains unchanged. Demo has no password inputs
or no-op update callback. Exactly one real Sign Out remains reachable: the existing
sidebar on desktop/tablet and the Session action on phone.

`AuthLayout` owns the approved split desktop/centered tablet/unframed phone shell
for Sign In, Sign Up and recovered-session Reset Password. Existing username
mapping, Auth APIs, session/recovery routing and confirmed-success semantics are
unchanged. The existing parent-owned Auth loading screen remains authoritative;
password forms lock their controls while a real update is pending.
There is no email registration field or public password-recovery requester.

`ExcelImportPanel` continues to use the existing parser, template generator,
duplicate key and import callbacks. File picking and drag/drop share the actual
`.xlsx`/`.xls`, 5 MB validation path. Preview uses native table semantics and
single-column phone rows; long real values wrap. Recommended selection excludes
existing and within-file duplicates; explicit selections and counts are retained
on failure. The guide includes the parser's supported optional fields, including
Rejected Date. Literal notes, aliases, date-only values and unknown rejection
dates retain their existing data contracts.

The new native confirmation dialog captures the selected rows before import,
focuses Cancel, traps Tab, supports Escape/backdrop cancellation, locks background
scroll and restores focus. A synchronous pending guard prevents duplicate confirm
events. No write occurs before confirmation; success appears only after the
existing callback resolves. Unmounted file reads/import feedback cannot replace a
new page/session. Navigation is not blocked or presented as cancelling a request.
The trigger explicitly receives focus before opening, so Safari's pointer-focus
behavior cannot break focus restoration after cancellation.

## Intentional Reference Differences

- Profile never exposes internal Auth email or relabels historical recovery-email
  metadata as verified identity. No fake email/member-since date is generated.
- The reference duplicates Sign Out inside Profile on desktop/tablet; RF-13's
  single visible exit is preserved instead. Demo remains account-free.
- Password requirement icons communicate actual met/not-met state. A six-character
  matching password remains valid even when the meter is not Strong. Reset also
  retains an independent confirmation-field visibility toggle.
- Touch buttons are at least 44px on tablet/phone. Larger controls can shift the
  reference's vertical rhythm slightly; established UI-01 shell spacing is retained.
- Actual parsed data replaces prototype rows/counts. Preview dates remain literal
  date-only values. Long metadata wraps, so phone rows may be taller. The real
  supported-column guide includes fields absent from the rendered source example.
- Import uses the approved sticky confirmation footer above mobile navigation;
  no prototype timer or optimistic import success is reproduced.
- Existing user-facing copy and practical server/parse errors remain where they
  express actual behavior more accurately than simulated prototype responses.

## CSS Ownership and Whole-App Audit

`account.css` owns Profile/Auth/Reset; `import.css` owns Import and its dialog.
Shared tokens, Figtree/JetBrains Mono, motion and controls are reused. Old page
selectors were removed rather than layered underneath new overrides. The unused
`TagInput` component and zero-caller tag/button/score/error-indicator selectors
were removed. The existing lazy-page loading heading and three inherited eyebrow
color declarations now use the Teal token. This also corrects the old blue-on-Cream
contrast warning seen while lazy pages are loading, without changing their layout.

Preservation evidence verifies 77 protected Git blobs (Windows line endings
normalized by Git), unchanged password-handler and duplicate-helper ASTs, and
retained CSS declarations/media contexts. Cleanup removes 60 selector branches
from App.css and 108 from theme.css; the loading-heading and fallback eyebrow
colors are the only intentional retained-rule changes. APIs, parsers, data normalization, Auth/session
logic, Supabase files, dependencies and migrated UI-01 through UI-04 files remain
unchanged. Shared generic input/button/feedback fallbacks remain: removing those
would require a separate cascade-wide change, not a safe zero-caller cleanup.

Whole-app checks cover Dashboard, Progress, Job Agent Setup/Matches, Profile,
Import and the application editor at desktop/tablet/phone widths, checking Teal
heading tokens, local fonts, reduced motion, navigation and document overflow.

## Verification

All final checks passed:

| Check | Result |
| --- | --- |
| `npm test` | 207 passed |
| `npm run test:audit` | 30 passed |
| Complete Chromium functional suite | 300 passed, no retries/skips |
| UI-05 + existing Demo/Profile + responsive-navigation suites | Firefox 56 passed; WebKit 56 passed |
| Post-cleanup whole-app route/motion checks | Firefox 3 + WebKit 3 passed |
| Existing authentication/recovery UI suite | 12 passed |
| `npm run lint` | Passed |
| `npm run build` | Passed; 2426 modules; initial JS 503.54 kB / 142.82 kB gzip |
| `git diff --check` | Passed |
| Preservation/canonical artifact checks | Passed; evidence linked below |

The final full Chromium run includes UI-01 through UI-05, RF-07/RF-08 mutation
and reconciliation, RF-09 destructive operations, RF-10/RF-11 queue/selection,
historical rejection dates, analytics and the unchanged salary contract. Its
whole-app Axe evidence reports no violations for the inspected Dashboard,
Profile, Progress, Import and Job Agent fixtures. New scoped Axe checks also pass.
This is not a claim of complete WCAG certification.

Cross-browser Profile/preview/modal tests exercise 390, 640, 768, 1039, 1040 and
1440px, long unbroken data, native focus/Tab/Escape, confirmed writes, pending
controls, rejected requests, safe retry, stale file reads and session changes.
The final shared-color cleanup was additionally checked across all main routes
at 390/768/1440px in Firefox and WebKit. Authentication covers successful and
failed Sign In/Sign Up/password changes and both legacy recovery-link variants.

Final local browser commands (single worker inherited from the base configs):

```powershell
npx playwright test --config tmp/ui5.local/playwright-test.config.mjs --project chromium --timeout=60000
npx playwright test --config playwright.audit.config.js tests/refinement-02/ui/remaining-pages-ui2.spec.js tests/refinement-02/ui/demo-profile.spec.js tests/refinement-02/ui/responsive-navigation.spec.js --timeout=60000
npx playwright test --config tmp/ui5.local/playwright-test.config.mjs tests/refinement-02/ui/remaining-pages-ui2.spec.js --project firefox --project webkit --grep 'whole-app visual' --timeout=60000
npx playwright test --config tmp/ui5.local/playwright-auth.config.mjs
```

The first broad cross-browser invocation exposed a new whole-app test readiness
race in WebKit; after correcting that test, its complete 56-case WebKit subset
passed. The original Chromium/Firefox subsets passed before the small fallback
color cleanup; final Chromium and post-cleanup cross-browser results above cover
that cleanup. Earlier interrupted/timeout attempts are not counted as passes.
PR CI has not yet run at the time this report is committed; it remains a separate
required review gate using the committed default configuration on a clean runner.

Local environment note: earlier broad runs encountered slow cold-module loading.
The test Vite process reached roughly 2.2 GB while this checkout contained old
Git-ignored toolchains, design exports and generated artifacts under `tmp/`.
Final local full-suite runs use a Git-ignored wrapper importing the unchanged
committed Vite/Playwright configs. Its only Vite overrides are
`optimizeDeps.entries: ['index.html']` and
`server.watch.ignored: ['**/tmp/**', '**/.temp/**']`. The application entry,
plugins, browser fixtures and assertions are unchanged; the overall local test
timeout is 60 seconds (existing explicit per-test timeouts still apply).
This reduced the first CRUD case from about 25 to 7 seconds and the sampled Vite
memory to about 139 MB. These observations are not a production performance claim.
No dev-server or CI configuration change is included in this PR.

The new whole-app audit explicitly waits for each target heading before measuring
the accessible main landmark. This prevents React Suspense's temporary hidden
previous page from producing an ambiguous locator or a stale screenshot. Existing
authentication, import, data-integrity and concurrency assertions are retained.

## Visual Evidence

Chromium, DPR 1, 900px viewport height. Each comparison places the approved source
on the left and the actual React implementation on the right at the same CSS width.
The differing records are synthetic; no production account or application data is
used. Full comparisons were opened, with additional phone/password/dialog views
for details below the first viewport.

| View | Desktop 1440px | Tablet 768px | Mobile 390px |
| --- | --- | --- | --- |
| Profile | [Compare](assets/ui05-profile-desktop.png) | [Compare](assets/ui05-profile-tablet.png) | [Compare](assets/ui05-profile-mobile.png) |
| Import empty | [Compare](assets/ui05-import-empty-desktop.png) | [Compare](assets/ui05-import-empty-tablet.png) | [Compare](assets/ui05-import-empty-mobile.png) |
| Import preview | [Compare](assets/ui05-import-preview-desktop.png) | [Compare](assets/ui05-import-preview-tablet.png) | [Compare](assets/ui05-import-preview-mobile.png) |
| Sign In | [Compare](assets/ui05-sign-in-desktop.png) | [Compare](assets/ui05-sign-in-tablet.png) | [Compare](assets/ui05-sign-in-mobile.png) |
| Sign Up | [Compare](assets/ui05-sign-up-desktop.png) | [Compare](assets/ui05-sign-up-tablet.png) | [Compare](assets/ui05-sign-up-mobile.png) |
| Reset Password | [Compare](assets/ui05-reset-desktop.png) | [Compare](assets/ui05-reset-tablet.png) | [Compare](assets/ui05-reset-mobile.png) |

Details: [phone password tool](assets/ui05-profile-password-mobile.png),
[scrolled password controls](assets/ui05-profile-controls-mobile.png),
[scrolled real preview](assets/ui05-import-scrolled-mobile.png),
[desktop confirmation](assets/ui05-confirm-desktop.png),
[tablet confirmation](assets/ui05-confirm-tablet.png),
[phone confirmation](assets/ui05-confirm-mobile.png).

Synthetic interaction states: [password pending](assets/ui05-profile-pending-mobile.png),
[password failure](assets/ui05-profile-error-mobile.png),
[reading spreadsheet](assets/ui05-import-reading-mobile.png),
[empty selection](assets/ui05-import-zero-mobile.png),
[import pending](assets/ui05-import-pending-mobile.png),
[import failure](assets/ui05-import-error-mobile.png),
[confirmed import](assets/ui05-import-success-mobile.png),
[confirmed recovered password](assets/ui05-reset-success-mobile.png).

Machine-readable evidence: [source/CSS preservation](assets/ui05-preservation.json),
[synthetic state capture checks](assets/ui05-state-checks.json).

## Limits and Release

All network behavior tests use the real frontend with synthetic local backend
fixtures, not real account creation/password changes or production persistence.
These checks are not physical-device or assistive-technology certification.
Existing ambiguous import outcomes are not made idempotent by this presentation
change: check Dashboard before retrying an uncertain commit. No automatic retry
or new import transaction contract is introduced.

The production build succeeds but the initial JS chunk (503.54 kB) is just over Vite's
500 kB advisory threshold. No warning suppression, dependency change or unrelated
code-splitting rewrite is included.

No database migration, Edge Function release or Supabase configuration change is
required or performed. Automatic production synchronization must remain OFF.
No manual deployment or merge is authorized. PR CI and final user UI acceptance
are separate from local verification.
