# Refinement 01: Hide Password Recovery UI

## Scope

Base: `main` at `3216007b7b952a980099355ae25f46a55ab1d294`.
Branch: `fix/hide-password-recovery-ui`.

- Removed Forgot Password and the recovery request form from Sign In.
- Removed Recovery Email input and explanatory copy from Sign Up.
- Removed Recovery Email settings from Profile, including demo Profile.
- Removed unused frontend recovery-request and email-edit state, handlers,
  props, API helpers, and styles. Registration now submits username/password
  and username metadata without writing an empty recovery email.
- Kept the existing password-update form, username authentication, session
  cookies, logout, and public demo workflows. The remaining Profile form uses
  the existing style in a single, bounded-width column.
- Kept `PASSWORD_RECOVERY`, the legacy `recovery=1` query handling, and
  `ResetPasswordPage`. No new public recovery entry point was added.

## Validation

Local validation:

| Check | Result |
| --- | --- |
| `npm test` | 18 existing unit tests passed |
| `npm run lint` | Passed |
| `npm run build` | Passed |
| `npm run test:auth-ui` | 12 isolated Chromium tests passed |
| Sign In / Sign Up / Profile / demo Profile | Recovery entry points and email inputs absent |
| Username registration | Internal auth email format preserved; recovery metadata not submitted |
| Signed-in password update | Success, mismatch, and backend-error paths verified |
| Existing recovery metadata | Password-update requests contain no metadata or email changes; synthetic stored metadata preserved |
| Session / logout | Session cookies remain session-only; reload retains login; logout clears cookies |
| Legacy reset links | Synthetic token links with and without `recovery=1` reach reset form, update password, and return to dashboard |
| Unauthenticated reset route | Redirects to Sign In without exposing recovery request UI |
| Responsive checks | 1440, 768, and 390px widths; no document-level horizontal overflow |
| Public demo | Dashboard, Profile, Progress, Import, application form, Job Agent setup and queue checked at all three widths |
| Protected code | No changes under `supabase/`, to session-cookie implementation, or to `ResetPasswordPage` |

Screenshots are generated in Git-ignored `test-results/`; desktop and mobile
Profile and authentication screenshots were visually inspected. Test traces,
screenshots, and synthetic tokens are not committed.

### Repeatable Browser Checks

```powershell
npm ci
npx playwright install chromium
npm run test:auth-ui
```

The dedicated config starts its own Vite server on `127.0.0.1:5193` and refuses
to reuse an existing server. Stop only a conflicting server that you own or
select another test port consistently in config and fixtures. Supabase public
environment variables are overridden with a synthetic loopback endpoint.
Every backend request is intercepted; unexpected external origins are blocked
and asserted absent. No real database, Auth account, Edge Function, email, or
production credentials are needed. GitHub CI runs this suite with Chromium.

## Limits And Existing Issues

- These are frontend/SDK integration checks with a synthetic backend, not a
  production email-delivery or token-validity test. Actual existing links still
  depend on Supabase token expiry and server configuration.
- Hiding UI does not disable the existing public recovery Edge Function.
  That backend remains unchanged. No Supabase configuration, schema, user data,
  or recovery metadata was deleted or modified.
- At 768px, the existing theme hides both desktop and mobile sign-out controls.
  This predates the task and is left unchanged to avoid an unrelated navigation
  fix. The tablet test verifies password update/session at 768px, then resizes
  to desktop to exercise the unchanged logout handler. Desktop and phone
  logout are checked at their native widths.
- Public demo password updates remain a local no-op demonstration, as before.
- No production deployment, Vercel Preview trigger, or PR merge was performed.
  PR #6 is not part of this work.
