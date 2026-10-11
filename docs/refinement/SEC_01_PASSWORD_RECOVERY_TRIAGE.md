# SEC-01: Password Recovery Endpoint Security Triage

Date: 2026-10-10. Status: **In Progress / Awaiting Security Review**.

Scope: R01 in [Refinement 02](REFINEMENT_02_QUALITY_AUDIT.md#7-potential-risks-and-unverified-findings), not remediation. Baseline: `origin/main` at `b49d6179b49a9746ddf5f98dc766bdc6d892e023`. Branch: `audit/sec-01-password-recovery-triage`.

## 1. Executive Summary

**Recommend Option A: authorize a separate, narrowly scoped task to deactivate/remove only the legacy `request-password-reset` function.** Public recovery is intentionally unavailable in the product. Keeping its privileged request handler deployed adds risk without a current required workflow. No replacement recovery service or paid infrastructure is recommended.

The unchanged source permits unauthenticated callers to initiate administrative user scans and, for matching recovery metadata, link generation and email delivery. Its five-attempt limiter is only per worker and per IP/email pair. Local tests establish conditional response differences, ambiguous duplicate-email selection and missing metadata validation. They do not establish production exploitation, compromise, working delivery or successful external invocation.

Already-issued token consumption and authenticated password updates use Supabase Auth and retained frontend code, not this request handler. Source review, official documentation and mocked browser tests support preserving these flows during a future deactivation; actual production token validity was not tested.

This PR changes only this report, isolated tests and Master Plan tracking. **No application code, Edge Function source, production configuration, schema or data has been changed.** SEC-01 is not Done; implementation and production actions need separate decisions and approvals.

## 2. Confirmed Deployment Context

The following metadata was supplied in the task after ChatGPT's independent inspection; this investigation did not re-query the production project:

| Property | Supplied fact |
| --- | --- |
| Project | ApplyTrack |
| Function | `request-password-reset` |
| Status / version | ACTIVE / 44 |
| Gateway JWT verification | `verify_jwt=false` |
| Deployed source | Matches GitHub main exactly |

The reviewed [source](../../supabase/functions/request-password-reset/index.ts) has Git blob `30cf679c83089b505fbe4bd09fbde75e44d396cd`. [Repository configuration](../../supabase/config.toml) also declares `verify_jwt=false` for this function. These facts establish deployment and lack of gateway JWT enforcement, **not** observed external reachability or execution. There was no endpoint probing.

Production secret presence/values, delivery readiness, actual user metadata, Auth redirect settings, gateway header normalization, worker topology, invocation quotas and billing controls remain unknown. No secrets, account records or live recovery tokens were read. Prior user confirmation that automatic Vercel Preview deployments remain disabled is the publication prerequisite; this investigation does not change cloud deployment settings.

## 3. Threat Model

Assets: account recovery authority, internal Auth identity data, recovery links, mail delivery credentials, service credentials, runtime capacity and free-service quotas.

Trust boundaries:

- An unauthenticated requester supplies JSON, an email, a redirect and forwarded headers. No handler-level identity/ownership check authenticates that requester.
- A server credential authorizes `auth.admin.listUsers()` and `auth.admin.generateLink()`. Supabase checks the server's authority; the custom handler alone decides which account to target and where to mail its link.
- `user_metadata.profileEmail` is a separate destination, not the generated internal Auth email and not evidence of mailbox ownership.
- Configured redirect origins and `APP_URL` are operator-trusted inputs. The SDK/Auth redirect policy is a further boundary, not modeled by the mocked admin API.
- Token redemption and ordinary password updates are Supabase Auth operations requiring a valid token/session. They are not authorized by possession of an arbitrary recovery email string.

Potential actors include unauthenticated callers and authenticated owners editing their own metadata. There is no evidence here that an attacker can edit another user's metadata. Mailbox compromise, misconfigured gateways and malicious operator configuration are conditional assumptions, not confirmed facts.

## 4. Security Findings

### S01: Public privileged handler remains available by design

**Confirmed unsafe design property; High review priority.** [Handler lines 137-191](../../supabase/functions/request-password-reset/index.ts#L137) inspect methods/body but do not authenticate the requester or check an Authorization header. [Lines 18-26](../../supabase/functions/request-password-reset/index.ts#L18) select the service-role credential or first secret-key value. A nonempty email can trigger administrative lookup; a match can trigger privileged recovery-link generation and delivery, without a caller session. The local unauthenticated fixture proves this control flow, not gateway reachability.

Administrative use is server-side, as required by the [Supabase listUsers documentation](https://supabase.com/docs/reference/javascript/auth-admin-listusers). No admin credential is returned in the tested HTTP responses. Nevertheless, hiding the UI does not remove this handler's authority or deployment.

### S02: Limiter is neither distributed nor an independent IP/email quota

**Confirmed implementation limitation; abuse magnitude is conditional.** [Lines 7-54](../../supabase/functions/request-password-reset/index.ts#L7) store five attempts per 15 minutes in an isolate-local Map keyed by the first forwarded value plus normalized email. New workers/restarts have new counters. Changing either part creates a new budget; there is no independent IP ceiling or email ceiling.

Local evidence: one worker admits five identical pairs and rejects the sixth; eight concurrent calls admit five and reject three. Two workers/reinitialization have independent budgets. Twelve different emails from one synthetic IP plus twelve IPs targeting one synthetic matching email admit all 24 scans and 12 mocked link/mail operations. **There is no same-worker counter race in this synchronous implementation.** These tests do not quantify real worker distribution or feasible production throughput.

[Lines 29-33](../../supabase/functions/request-password-reset/index.ts#L29) trust the first `x-forwarded-for` value. Whether a production caller can influence that value depends on gateway behavior and was not tested. Absent headers share an `unknown` bucket. Header spoofing is not established.

### S03: Retained keys and expensive user scans create avoidable resource risk

**Confirmed unbounded-by-code key retention; practical denial of service is not demonstrated.** Expired entries are replaced only when the same key is revisited; there is no global cleanup/cap. A bounded fixture retains 256 expired keys after adding a fresh 257th key. This is not a memory-exhaustion benchmark; runtime limits and isolate lifetimes may constrain growth.

[Lookup lines 81-107](../../supabase/functions/request-password-reset/index.ts#L81) can request ten pages of 1,000 users for each admitted nonempty unknown email. No format or length check precedes lookup. Synthetic pagination confirms the 10,000-user cap and first-match early exit; an intended user on an eleventh full-result page is not found. Actual account count/load is deliberately unknown. Repeated scans, admin operations and delivery may consume shared capacity or quotas even within a nominal zero-cost plan.

### S04: Matching-email failures have a distinct public response

**Confirmed conditional enumeration signal, not confirmed practical production enumeration.** [Lines 175-200](../../supabase/functions/request-password-reset/index.ts#L175) return neutral 200 for an unknown email before redirect/link/delivery work. A matching email returns generic 500 when one of those later steps fails. Missing delivery settings are checked only after link generation ([lines 181-191](../../supabase/functions/request-password-reset/index.ts#L181)).

| Synthetic condition | Unknown email | Matching email | Interpretation |
| --- | --- | --- | --- |
| Healthy admin, redirect and delivery | 200, neutral message | 200, same message | Equal normal public status/body |
| Missing Resend key or sender | 200, neutral | 500, unavailable | Local conditional distinction; link generation already attempted |
| Mail rejected or transport throws | 200, neutral | 500, unavailable | Local conditional distinction |
| Link generation error/no action link | 200, neutral | 500, unavailable | Local conditional distinction |
| Missing APP_URL with no usable requested origin | 200, neutral | 500, unavailable | Local conditional distinction |
| Missing admin credentials or listUsers failure | 500, unavailable | 500, unavailable | Global failure, not an email-specific signal in this fixture |
| Sixth request for one worker/pair | 429 | 429 | Budget state, not inherently account existence |
| Malformed JSON or top-level null | 500, unavailable | Not applicable | Parser error, not inherently account existence |
| Empty/non-string email, first attempts | 200, neutral, no scan | Not applicable | No account-dependent operation |

Normal known-email requests also perform more external operations than unknown-email requests. A timing signal is plausible, but no latency benchmark or practical classifier was measured. No production delivery failures/configuration were checked. The report does not claim that a real account can currently be enumerated reliably.

### S05: Recovery destination has no demonstrated ownership or uniqueness guarantee

**Confirmed trust/selection deficiency; takeover is conditional and unproven.** [Lines 97-104](../../supabase/functions/request-password-reset/index.ts#L97) compare trimmed/lowercased `profileEmail` and take the first returned user. They do not check mailbox verification, a unique binding or all matching users.

Historical `src/api/auth.js` at `72987da^` wrote `profileEmail` during signup and through `auth.updateUser({data: {profileEmail}})` without a verification challenge. History was inspected locally; no production metadata was read. This establishes absence of a repository-enforced verification flow, not that every production mailbox was never verified through another process. Supabase permits authenticated users to update their own metadata ([updateUser documentation](https://supabase.com/docs/reference/javascript/auth-updateuser)); removing an input is not a server-side restriction on that API.

Synthetic users with the same normalized destination select different internal Auth emails when returned order is reversed. Link generation correctly targets the **selected account's internal Auth email**, while delivery targets the shared metadata address. That is not a guarantee that the selected account is the account the requester intended. Ordinary Auth email uniqueness does not establish custom metadata uniqueness.

Duplicating one's own metadata alone is not proof of arbitrary victim takeover: delivery still goes to the destination string. Unauthorized access would require additional facts such as a victim's metadata pointing to an attacker-controlled mailbox. Such facts were not observed. Wrong-account recovery, ambiguity and recovery availability are established design concerns; actual collisions/ownership are unknown.

A non-string non-null `profileEmail` can throw on `.trim()` and break a scan for another account. A synthetic object-valued metadata entry reproduces generic 500 without link generation. This is a robustness/availability defect, not proof that malformed metadata currently exists.

### S06: Redirect safety depends on trusted configuration

**Verified safe exact-origin matching locally; configuration-dependent residual risk.** [Lines 57-78](../../supabase/functions/request-password-reset/index.ts#L57) parse a URL and compare exact origins. Requested suffix lookalikes, attacker origins and malformed/javascript URLs fall back to APP_URL in the tested configuration. Accepted URLs are reduced to `origin/?recovery=1`; supplied path/query/hash are discarded. No arbitrary request-controlled open redirect was established under that configuration.

The code has no HTTPS-only rule and accepts an explicitly configured localhost HTTP origin. APP_URL fallback is trusted without checking membership in an explicit ALLOWED_REDIRECT_ORIGINS list. Tests show those local decisions, **not** that Supabase would honor every generated redirect or production has unsafe origins. README's development-origin examples do not prove production configuration. Supabase's independent [Auth redirect allowlist](https://supabase.com/docs/guides/auth/redirect-urls) and actual deployed configuration were not read.

### S07: Error/delivery handling has bounded positive properties and residual unknowns

[Lines 110-134](../../supabase/functions/request-password-reset/index.ts#L110) send a text-only link to a fixed Resend destination using server credentials. The handler has no explicit fetch timeout or retry policy; platform timeouts remain outside this test. [Lines 192-197](../../supabase/functions/request-password-reset/index.ts#L192) return a generic error, not a raw exception. Tested HTTP bodies contain neither tokens nor credentials and unknown-email success is neutral. OPTIONS/unsupported methods do not reach admin or mail operations.

The catch logs whole error objects. No explicit action-link/credential logging statement was found, but exception redaction is not enforced, and production log contents were not inspected. Sensitive-log exposure is a potential risk, not an observed leak. CORS is not authorization; the tests replace SDK CORS headers and do not assert actual gateway/browser CORS behavior.

## 5. Isolated Test Evidence

New test: [tests/sec-01/request-password-reset.test.mjs](../../tests/sec-01/request-password-reset.test.mjs).

The suite loads the actual unchanged TypeScript handler with Node's type stripping and VM modules. SDK imports, admin APIs, Deno environment/serve, mail delivery, clock and worker initialization are isolated. Map behavior is observed without changing its counter algorithm. All identities, credentials and action links are synthetic (`example.invalid`, never-valid token). The fetch mock never invokes native network fetch and rejects unexpected destinations; import linking rejects unexpected modules. No production environment files are loaded.

Coverage: unauthenticated server-key use; normal response equivalence; seven matching-only failure cases; global admin failures; secret-key selection/malformed JSON; method handling; invalid/empty email; malformed body; window boundary; same-worker concurrency; independent workers/restart; IP/email pair budgets; forwarded-header assumptions; expired-key retention; duplicate ordering; malformed metadata; bounded pagination; exact-origin fallback; configured HTTP/localhost.

Run from the project root with Node supporting `stripTypeScriptTypes`:

```powershell
node --experimental-vm-modules --test tests/sec-01/request-password-reset.test.mjs
npm test
npm run test:audit
npm run test:auth-ui -- --output test-results/sec01-auth
npm run lint
npm run build
git diff --check
```

| Validation run in this investigation | Result |
| --- | --- |
| New SEC-01 handler characterizations | 25 passed, 0 failed |
| Existing unit tests | 34 passed, 0 failed |
| Existing audit logic/Edge tests | 14 passed, 0 failed |
| Existing authentication browser tests | 12 passed, 0 failed |
| ESLint / production build | Passed / passed |

Browser checks cover 1440px, 768px and 390px public Sign In/Sign Up/Demo, no visible recovery UI, signed-in password updates, and synthetic legacy-token reset flows with/without `recovery=1`. HTTP is intercepted; these tests assert no Edge Function requests. They do not validate a real token with GoTrue, real session security or production delivery. This is not a new full application/database integration test run.

The SEC-01 tests intentionally characterize deficiencies and safe behavior; passing is evidence that observations are reproducible, **not** that the handler is secure. They are an explicit standalone command, not a new npm/CI gate: package scripts and workflows remain unchanged under this audit-only scope. Generated browser artifacts stay ignored and are not committed.

## 6. Risk Classification

| Class | Evidence / conclusion |
| --- | --- |
| Confirmed deployed context | Supplied ACTIVE v44, gateway JWT off, source parity; no independent live invocation |
| Confirmed unsafe design/local defects | Unauthenticated privileged paths; per-worker pair-only limiter; retained expired keys; unverified/ambiguous metadata selection; non-string metadata exception; matching-only failure responses |
| Potential security consequences | Abuse/quota exhaustion, delivery floods, timing or failure-based enumeration, misdirected recovery under mailbox/metadata conditions, sensitive exception logs |
| Verified safe within fixtures | Equal healthy responses; same-worker concurrent counter; exact-origin validation under trusted configuration; generic error bodies; link targets selected internal Auth email; method gating; retained frontend compatibility |
| Environment-dependent assumptions | Real credentials/delivery, XFF provenance, runtime quotas/isolate recycling, Auth redirect checks, mailbox ownership, token expiry/session validity |
| Unknown requiring decision or separately approved verification | Live reachability; actual metadata quality/duplicates; production allowlists; real impact/compromise; operational rollback artifacts and rollout process |

Retain original **R01 High security-review priority** because a disabled product capability exposes privileged work with insufficient trust/abuse controls. No Critical rating, CVSS score, actual breach or arbitrary account takeover is established. UI hiding is not risk elimination, and local tests are not a production security certificate.

## 7. Comparison of Remediation Options

| Criterion | A: Deactivate/remove request function | B: Retain and harden | C: Accept existing risk |
| --- | --- | --- | --- |
| Risk reduction | Removes this custom request path and its privileged work | Depends on correctly implemented controls and reliable delivery | None |
| Required functionality | Keeps logged-in updates and existing-token route/Auth intact | Keeps new requests if deliberately restored | Keeps unsupported new-request capability |
| Complexity | Small repository/config/docs retirement plus controlled cloud action | Verified unique recovery binding, reliable limits, neutral failures, input/redirect rules and delivery testing | Small immediate effort, continued security/incident burden |
| Cost | No new service or paid dependency; removes avoidable custom workload | Can target free infrastructure, but requires operations and quota management; no guarantee under abuse | Continues avoidable runtime/mail/admin quota use |
| Regression risk | External/undocumented request consumers must be checked; supported frontend paths can remain | Broad identity, security, migration and delivery behavior changes | Existing recovery ambiguity/failures persist |
| Current refinement fit | Best fit: disabled public UI, CAD $0/month requirement | Poor fit unless product needs new-email recovery and approves scope | Not justified merely by hidden UI |

Option B would require a deliberate policy: logged-out recovery cannot simply require a logged-in JWT. Authentication can protect an operator-only service, but is not a substitute for a trustworthy recovery binding. Reliable limits must cover distributed workers and independent abuse dimensions; verification/duplicate handling and delivery readiness must be designed, not inferred from metadata. Do not resume PR #6 automatically.

Option C needs an accountable owner, explicit assumptions, time limit, monitoring/incident response and quota-risk acceptance. No such acceptance is supplied. Keeping the old deployment is not recommended.

## 8. Recommended Disposition

Approve **Option A for a subsequent remediation task**, preferably complete removal of this exact custom Edge Function deployment and retirement of its source/config/deployment instructions. This triage PR does not carry out those changes.

If an operator requires an intermediate reversible deactivation, a separately approved deny-all stub could return a fixed unavailable response without parsing user input, reading credentials or invoking admin/mail APIs. It still leaves an invocation surface and is not the preferred long-term endpoint disposition. Merely changing `verify_jwt` is not equivalent to disabling all callers or fixing the handler's identity assumptions.

Keep `src/App.jsx` recovery-event/query handling, `ResetPasswordPage`, `auth.updateUser({password})`, session setup and stored `profileEmail` metadata unchanged. Do not add a new public entry, replace recovery infrastructure, change Auth/database settings or rotate shared credentials as incidental cleanup. Removing this custom function does **not** disable Supabase Auth's own recovery/token endpoints.

## 9. Compatibility and Rollback Considerations

Three independent operations:

| Operation | Current dependency | Future Option A implication |
| --- | --- | --- |
| Request new custom recovery email | Legacy admin lookup/link/Resend handler | Intentionally unavailable; currently no product UI caller |
| Consume an already-issued valid token | Supabase Auth verification/session; App recovery event/query; reset page | Preserve without changes to Auth policy, frontend or token lifecycle |
| Update password while authenticated | `src/api/auth.js:64` Auth updateUser and App handler/profile | Preserve unchanged |

[App lines 114-139](../../src/App.jsx#L114) handle PASSWORD_RECOVERY and the recovery query; [lines 240-246](../../src/App.jsx#L240) update the password through the existing auth helper; [lines 456-463](../../src/App.jsx#L456) render the reset page. [ResetPasswordPage](../../src/pages/ResetPasswordPage.jsx) consumes this callback, not the old email requester. Current auth helpers no longer expose request/reset-email metadata setters. Existing [auth browser tests](../../tests/auth-ui/password-recovery.spec.js) exercise synthetic token compatibility and profile updates.

Supabase [generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generatelink) generates links for custom delivery; the [Auth email-template documentation](https://supabase.com/docs/guides/auth/auth-email-templates) shows verification at `/auth/v1/verify`. Thus continued redemption after custom-function removal is an architecture-based inference supported by source/mocked UI checks, **not** an observed production removal experiment. Tokens must still be valid, unconsumed and accepted by Auth; do not promise indefinite link validity.

Before any later cloud deactivation, preserve the supplied **v44**, not an older v39, with reviewed Git baseline/blob, deployment metadata, gateway setting and an operator-owned rollback record. Record configuration requirements without committing values. No snapshot or production credentials were obtained in this audit.

Rollback requires a separately approved cloud redeployment and security-risk acceptance; reverting a Git commit alone cannot restore a removed cloud function. Default to leaving the unsafe request capability off unless a justified regression requires temporary restoration. Do not change account metadata, sessions, Auth keys/policies or databases to roll back endpoint removal.

`RESEND_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are also used by [ingest-job-alert lines 87-88](../../supabase/functions/ingest-job-alert/index.ts#L87). **Do not delete/revoke these shared secrets or alter that function** as part of Option A. Inventory any recovery-only settings before cleanup. No database migration/data rollback is needed for a strictly endpoint-only retirement.

## 10. Implementation Prerequisites

1. ChatGPT reviews the report/isolated evidence and selects a disposition; the user authorizes the next task's exact scope. SEC-01 remains awaiting security review until that decision.
2. For Option A, inventory source/documented and operator-known external consumers. Current frontend has no legacy request caller; absence of undocumented external integrations cannot be proved from repository search.
3. Define endpoint removal versus an intermediate deny-all response, public response semantics, rollback ownership and the minimal repository files to retire. README/AGENTS still describe legacy delivery setup; update those only in authorized remediation. README's blanket no-enumeration claim needs qualification if retaining the handler.
4. Preserve existing-token/reset-page and signed-in password tests. Require new local no-privileged-call checks if a stub is chosen. Define rollback acceptance criteria, not a blanket right to restore insecure behavior.
5. Before production action, separately confirm exact project/function/version, rollback source/settings, deployment-automation state and no impact on shared alert ingestion. This does not authorize secret/account reads now.
6. Obtain explicit user approval for the exact cloud write/deletion/deployment. Keep a separately approved smoke plan that avoids real user emails or real reset-token generation unless those actions receive their own consent.
7. Keep the CAD $0/month constraint: no paid backup/domain/mail service or new recovery platform is a prerequisite for retiring an unused custom handler.

No outstanding prerequisite is permission to perform production probes, enumerate users, inspect secrets or modify cloud settings during this audit.

## 11. Explicit Go/No-Go Decision Required From ChatGPT

**Requested decision: GO to define a separate Option A remediation task; NO-GO for production actions under this audit authorization.**

ChatGPT should explicitly confirm:

- Select A, B or C, with reasons for any departure from A.
- For A, approve preservation of token consumption, logged-in password updates and existing metadata, and choose complete endpoint removal or temporary denial.
- Confirm no shared credentials, alert ingestion, Auth settings, schema, sessions or public recovery UI changes are authorized incidental work.
- State local acceptance tests, rollback prerequisites and the subsequent user production-approval gate.

Until that review and the user's further approval, leave deployed v44, configuration and all production data untouched. Do not mark SEC-01 Done, merge this PR, start RF-04 or revive PR #6.
