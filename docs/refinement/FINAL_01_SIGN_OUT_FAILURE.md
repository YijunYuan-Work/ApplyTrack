# Final-01: Sign Out Failure Handling

Baseline: `90fc8af3e6781297a85c0fa9453ef02e11788ed9`.

## Correction

`App.handleSignOut` previously awaited a throwing authentication helper without
handling failure. A failed logout left the current page visible with no feedback.

- Catch failures without clearing the authenticated workspace or claiming success.
- Show `Could not sign out. Please try again.` using the existing `form-error`
  treatment and an accessible, focused alert in the current page's shared shell.
- Let the existing Sign Out control retry; disable it and expose `aria-busy` while
  pending. A synchronous workspace-owned guard prevents concurrent requests even
  before React renders the disabled state or when a page remounts.
- Reuse the existing workspace identity fence for late success, failure and cleanup.
  A previous operation must not clear a new account, navigate its page, show an old
  error, or unlock a later workspace's pending logout.
- Reset pending/error feedback when the authenticated workspace changes. Demo
  remains account-free and does not receive real account feedback or controls.

The existing Supabase helper, default logout scope, cookie storage, Auth event
handling and route guard remain unchanged. Normal SDK-confirmed logout still
clears the session and enters Sign In. No SDK requests are canceled or replaced.

## Regression Coverage

`tests/refinement-02/ui/sign-out.spec.js` adds nine cases per configured engine:
three responsive success/failure/retry/single-flight cases (1440/768/390px), a
rejected-promise case, navigation between all authenticated page types, and four
late-completion schedules (success/failure, same/different subsequent account).

The cross-session tests hold the App-facing result **after the actual SDK returns
and releases its auth lock**, then create a new session and pending logout. They
test the application's completion fence, not cancellation of a server-side logout.
HTTP failure tests also assert unchanged cookies, user metadata and records, no
uncaught page error, no premature navigation, accessible alert/focus, no overflow,
and the unchanged `global` logout scope.

## Verification

Verified locally on 2026-10-18:

| Check | Result |
| --- | --- |
| New sign-out suite, Chromium / Firefox / WebKit | 27/27 passed (9 per engine) |
| Existing Chromium regression suites | 137/137 passed |
| Existing authentication UI suite | 12/12 passed |
| Unit tests | 207/207 passed |
| Source/Edge audit tests | 30/30 passed |
| ESLint, production build, `git diff --check` | Passed |

The existing Chromium run includes `demo-profile`, `form-save`, `delete-mutations`,
`navigation-shell`, `responsive-navigation`, `remaining-pages-ui2` and
`status-mutations`. No existing tests or assertions were changed. The new suite
also passes axe WCAG A/AA checks for the failed state at all three viewport sizes;
desktop, rail/tablet and phone screenshots were inspected.

Local browser runs use only intercepted synthetic backend responses. The ignored
local Vite wrapper excludes old generated toolchains from watching/HTML scanning;
application sources, existing test assertions and committed CI config are unchanged.
Reports and synthetic screenshots are under `tmp/final-01.local/` (not committed).
The standard configs can run the same tests when their ports are available:

```powershell
npm run test:audit-ui -- sign-out.spec.js --project chromium firefox webkit
npm run test:auth-ui
```

This is targeted browser coverage, not a new full 309-case Chromium run or a live
Supabase authentication test. No production credentials, users or endpoints were used.

## Release Boundary

Frontend-only correction. No SQL, migrations, Edge Functions, Supabase settings,
secrets, authentication policy or deployment configuration changes are required.
No test consolidation or unrelated CSS cleanup. Merge/deployment require separate
review; this task does neither.
