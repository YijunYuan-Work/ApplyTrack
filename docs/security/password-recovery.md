# Password recovery: deployment and security review

The username login system currently uses a synthetic Supabase Auth email, while
the actual recovery address is stored in the signed-in user's editable
`user_metadata.profileEmail` field. This change preserves existing accounts;
it does **not** introduce a verified email-identity model. Treat any profile
email as an unverified recovery contact until a future verification migration.

## Changes

- Replace the 10-page `auth.admin.listUsers()` scan with a service-role-only
  database RPC. A duplicate metadata recovery address is deliberately treated
  as no match.
- Replace process-memory throttling with a PostgreSQL-backed atomic quota:
  5 requests per normalized email and 30 per best-effort network address per
  15-minute fixed window. Quota rows contain SHA-256 hashes, not raw emails
  or IP addresses. They are hidden from anonymous and user clients by RLS
  and grants; old rows are cleaned up probabilistically.
- Cap request bodies at 2 KiB and validate email shape and redirect origin.
- Keep identical public responses for nonexistent accounts and throttled
  requests, including account-specific Auth/mail failures, to reduce account
  enumeration. Database/credential failures before a match fail closed with a
  generic unavailable response. Do not log emails or reset links.
- Retain Supabase Auth's signed, expiring recovery links and Resend delivery.

## Deployment sequence

**Do not merge or deploy the updated Edge Function before completing the
database migration**, or password recovery will fail closed.

1. Review and apply
   `supabase/migrations/20261009201500_password_recovery_safety.sql` in a
   disposable test Supabase project first, then on the approved production
   project. The project must enable the Data API for the `public` RPCs.
2. Verify both database functions exist and anonymous/authenticated roles
   have no EXECUTE privileges. Verify the table has RLS and those roles cannot
   read its rows.
3. Check Edge Function secrets `APP_URL`, `ALLOWED_REDIRECT_ORIGINS`,
   `PASSWORD_RESET_FROM_EMAIL`, `RESEND_API_KEY`, and the Supabase
   service-role key. Do not print secret values in logs.
4. Deploy `request-password-reset` after the migration.
5. Smoke test a valid recovery email, an unknown email, malformed payloads,
   an unapproved redirect, concurrent repeated requests, and link expiration.
   Confirm the frontend password-update form works for an existing account.
6. Keep the old Edge Function available for rollback if a deployment fails.
   The migration is additive; no user-data backfill or deletion is needed.

## Test matrix

| Scenario | Expected behavior |
| --- | --- |
| Existing username/password login | Unchanged |
| Existing legitimate recovery email | Mail sent to recovery inbox |
| Unknown or malformed email | Generic response, no account exposure |
| More than 5 requests to same email in 15 min | Generic response, no further mail |
| More than 30 requests from same network bucket | Generic response, no further mail |
| Two accounts with same recovery metadata | No link generated (ambiguous) |
| Unapproved preview or attacker redirect origin | Falls back to configured APP_URL |
| Concurrent Edge instances | Shared counters via Postgres |
| Non-service-role RPC call | Rejected by EXECUTE grants |
| Resend rejection or transport failure for a known account | Same public reply as unknown account |
| Control/invisible characters in email | No lookup, quota row, or delivery |
| Unsafe APP_URL protocol or embedded credentials | No recovery link generated |
| Expired or previously consumed recovery token | No new session |

## Repeatable local integration tests

Requirements: Node.js 24, npm, and a running local Docker engine. The test
runner obtains the pinned Supabase CLI 2.120.0 through `npx`; the first run
needs network access to download CLI packages, Docker images, and Edge imports.
No Supabase login, linked project, production secrets, or Resend account is
needed.

```powershell
npm ci
npm test
npm run test:integration:recovery
npm run lint
npm run build
```

The integration command builds an **unlinked**, disposable Supabase project in
`.temp/recovery-sandbox` inside the current checkout. The project ID includes a
checkout-path hash; ports are selected from free blocks starting at 18320. It
checks Docker project/workdir labels before operating on existing containers,
resets only that local database, and stops only that project when finished.
Other Supabase projects, containers, and volumes are not stopped or deleted.
The database volumes are retained for inspection; generated config, logs, local
credentials, and Sandbox files are ignored by Git. Run this command only for
disposable test data, not a local development database you want to preserve.

Because `applications` predates the repository's migration history, the runner
first generates a test-only bootstrap from the applications portion of
`supabase/schema.sql`, then applies **every repository migration**, including
the recovery migration. That bootstrap is not a production migration.

The suite uses real PostgreSQL, PostgREST, Supabase Auth, and Deno Edge workers.
It checks grants and RLS (including existing application ownership), RPC
validation and idempotence, duplicate email ambiguity, atomic rollback, expiry,
5/email and 30/network quotas, 48-way database concurrency, and 12 simultaneous
Edge requests. Real recovery tokens change a password; reuse and expiration
are rejected. Invalid bodies, redirects, and mail-provider failures are covered.

The deployed entrypoint is smoke-tested locally for methods and an unknown
account. Known-account delivery tests use a test-only entrypoint importing the
**same production handler**, with only the Resend transport replaced by a local
capture server. Production keeps the fixed Resend endpoint and has no test-mode
environment switch. No real mail is sent. GitHub Actions runs this suite in a
separate Docker-backed job as well as unit tests, lint, and build.

## Known limits and follow-up

The recovery address is **not ownership-verified**; changing it currently uses
`auth.updateUser({ data: { profileEmail } })`. Username and recovery-email
uniqueness guarantees are not equivalent. A follow-up must introduce verified
email ownership and a safe account migration, rather than silently replacing
synthetic Auth emails.

Network address is extracted from proxy-supplied request headers and must be
considered a best-effort throttle (some forwarding headers can be spoofed).
The per-email bucket still enforces shared, durable limits; add platform WAF or
trusted-proxy-aware network limiting for larger deployments.

These SQL changes have not been applied to the live Supabase project by this
PR. Local integration/CI tests do not prove production secrets, Resend domain
verification, real inbox delivery, proxy/WAF behavior, or frontend recovery
flow correctness against a deployed project. Those remain deployment-time
manual checks, after approval and the migration-first deployment sequence.
