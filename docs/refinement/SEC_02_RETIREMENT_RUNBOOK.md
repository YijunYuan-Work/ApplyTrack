# SEC-02: Legacy Password Recovery Retirement Runbook

Date: 2026-10-10 (America/Toronto).

Status: **In Progress - Preparation PR / Awaiting Review and Production Approval**.

**Stage 1 repository preparation; not production retirement or release approval.** Supabase branch-push safety is supported by the user-supplied integration screenshot: production branch is main and automatic branching is unavailable/off. The user confirmed Vercel automatic Preview was previously disabled, has not been intentionally re-enabled, and authorized branch Push/PR based on that configuration confirmation and recent deployment history. This is not an independent inspection of the current Vercel setting. Check deployment metadata after publication and stop on an unexpected Preview. No merge, function deletion/deployment, integration change, endpoint invocation or production data/configuration write is authorized or performed.

## A. Preflight

### Repository and scope

- Workspace: `C:\Work\SideProject\ApplyTrack`; initially clean and synchronized with `origin/main`.
- Baseline: `94fba227c987798634c7bcc61933362884cb84c8` (SEC-01 completion/tracking documentation).
- Local preparation branch: `security/sec-02-retire-password-reset`.
- Authority: [Master Plan](REFINEMENT_MASTER_PLAN.md), [approved SEC-01 investigation](SEC_01_PASSWORD_RECOVERY_TRIAGE.md), R01 in [Refinement 02](REFINEMENT_02_QUALITY_AUDIT.md#7-potential-risks-and-unverified-findings), and the SEC-02 Stage 1 task brief.
- SEC-01 is complete as a triage task; R01 remains outstanding until authorized production retirement is verified. Historical reports are unchanged.

### Production identity and read-only observation

Supabase `list_edge_functions` was used only for deployment metadata, not function invocation, users, secrets or configuration changes:

| Function | Function ID | Observed status/version | JWT verification | Last update (UTC) |
| --- | --- | --- | --- | --- |
| `request-password-reset` | `32eb81eb-df1e-4cd5-a3c7-0a981b73f5ff` | ACTIVE / 46 | false | 2026-10-11T01:58:04.856Z |
| `ingest-job-alert` | `d6466f63-f96e-44d9-ae63-b954fa3ff2f8` | ACTIVE / 21 | false | 2026-10-11T01:58:04.856Z |

Project: ApplyTrack, **`qotipygmwlovxklkexjb`**. Versions may change; revalidate at the actual release gate. SEC-01's v44 is historical, not the current rollback target.

The task supplied deployed-source parity with main; source parity was not independently re-downloaded in Stage 1. Local rollback source:

- Recovery file at baseline: `supabase/functions/request-password-reset/index.ts`.
- Recovery Git blob: `30cf679c83089b505fbe4bd09fbde75e44d396cd`.
- Ingestion Git blob (must remain unchanged): `96f3a3cb4d223d231792b4e528b694448b65ca78`.

An operator must preserve the **actual release-gate version**, source reference/hash and non-secret deployment settings before deletion. A later rollback deployment creates a new version; the old version number is an evidence reference, not a CLI restore switch.

### Automatic deployment investigation

Confirmed locally and through GitHub read-only metadata:

- The only repository Actions workflows are `.github/workflows/ci.yml` (tests/lint/build) and `dependency-audit.yml` (npm audit). Neither contains a Supabase/Vercel deploy step. Live workflow names/paths agree with the checkout.
- The repository webhook API returned an empty list. This does **not** rule out GitHub App webhooks or integrations.
- The `supabase` GitHub App created a `Supabase Preview` check on main commit `bf292553a7fa218a7dea9ef75758d978c3964f03`, successful at 2026-10-11T01:57:18Z, and documentation-only main commit `94fba227c987798634c7bcc61933362884cb84c8`, successful at 01:58:05Z.
- The two production function metadata update times coincide with the latest main Supabase check. The supplied recent version increases and this metadata corroborate the GitHub integration deployment mechanism confirmed in the settings screenshot below. They do not establish how the platform reconciles removed functions.
- On previous audit branch commit `eb2c43739825a16b8eada639cc5a36f7b9836773`, the Supabase App check was **skipped** at 01:49:54Z. That branch changed no `supabase/` files. It does not establish the behavior of a new branch deleting function/config files.
- GitHub records Vercel Production deployments for both recent main commits, including documentation-only `94fba22`. Main merge is a deployment-sensitive action. Recent branch deployment history and the user's configuration confirmation support publication, but the current Vercel setting was not independently inspected.
- Supabase's integration settings page redirected the available in-app browser to sign-in. No login credentials were inspected or submitted. Available MCP tools do not expose Git integration settings. The user then supplied non-sensitive screenshots and authorized continuation of Stage 1 only.

Confirmed from the user-supplied **Supabase** settings screenshot:

- Connected repository: `YijunYuan-Work/ApplyTrack`; working directory: `.`.
- Deploy to production: **on**; production branch name: **main**.
- Automatic branching: disabled/unavailable; branch limit shows 0. The page requires a Pro upgrade to enable preview branches. No upgrade or paid branch was created.
- Supabase-changes-only is disabled/unavailable, not a production-deployment filter. A docs-only main push can still initiate the production integration workflow.

The supplied **Vercel** screenshot shows repository connection, PR comments, event/commit-status controls, not a Preview-deployment enable/disable setting. It is not itself proof that automatic Preview is off. In response to the publication gate, the user explicitly confirmed the previously disabled configuration was not intentionally re-enabled, cited recent RF-03/SEC-01 branches without new Preview deployments, and authorized Push/PR with a post-push deployment check. Treat this as user configuration confirmation plus deployment-history corroboration, not independent verification of the current setting. No cloud setting is modified by this task.

The [official GitHub integration guide](https://supabase.com/docs/guides/deployment/branching/github-integration) describes configurable production deployment and automatic branch/PR synchronization. The [deployment overview](https://supabase.com/docs/guides/deployment) distinguishes production Git deployment from optional paid preview branching. General documentation is not proof of ApplyTrack's configured production branch, filters or branch automation.

| Required question | Evidence-based answer / unresolved gate |
| --- | --- |
| What automatically deploys functions? | Supabase GitHub App integration: linked repository, root workdir, production deployment on, main configured. Repository Actions do not deploy. No evidence of an additional writer; external/manual writers cannot be exhaustively excluded. |
| Can a PR branch push trigger deployment/cost? | This branch is not main and Automatic branching is unavailable/off. Under these settings, no Supabase production deployment or paid Preview branch is configured for this PR. A check/status event may still run. Vercel publication is authorized based on user configuration confirmation plus recent deployment history, not an independent current-setting inspection; inspect for an unexpected Preview after Push/PR. No paid environment is created intentionally. |
| Does every main push redeploy all functions? | Main push/merge is an automatic production trigger. Both declared functions updated after a docs-only main commit; docs-only changes are not safe from this integration. Do not generalize observed version changes into a guaranteed all-functions redeploy on every possible event. |
| What happens when source/config are removed? | Cloud deletion, retained deployment or integration failure is not established. Do not equate Git absence with cloud deletion. |
| Can later synchronization recreate a deleted function? | Old source/config, an old rollback checkout or a stale/in-flight deployment can request recreation. Retired main must exclude the slug before deletion, and writers/queues must be controlled. Exact absent-function reconciliation remains unknown. |
| Is temporary automation suspension necessary? | Required by this runbook before main merge/deletion because production auto-deploy is confirmed on and deletion/reconciliation behavior is unverified. An approved operator must turn off Deploy to production and isolate any other writer; no setting was changed in Stage 1. |
| Which sequence is safe? | Review preparation PR, then separately approve writer pause/drain, controlled merge, explicit target deletion, metadata verification and anti-redeployment controls. Section B is conditional; no production execution is authorized now. |

### Remaining operational unknowns

Supabase repository/workdir/main/production/branching settings are now evidenced. The screenshot crop has no project header, so its association with ApplyTrack is user-supplied context, corroborated by the project-linked GitHub checks and function metadata. Remaining unknowns: deleted-function reconciliation (leave deployed, prune or error), stale/queued deployment replay, any external manual writers, effects of re-enabling synchronization, and independent current-setting verification of Vercel Preview policy. The Supabase reconciliation and writer-isolation unknowns are **production-release blockers**, not permission to experiment on production.

Document queue/writer isolation and prior integration state privately at the actual release gate. Screenshots/records must omit credentials, user data and secrets. Do not compensate for missing access by reading tokens, secrets, user records, branch connection strings or live endpoint responses. Do not enable paid branching. The user's explicit publication authorization satisfies the Stage 1 gate with the limitations above; unknown deletion semantics do not block repository review because no merge/cloud deletion is authorized and Section B requires verified writer isolation before those actions.

### Shared dependencies and supported authentication

`ingest-job-alert/index.ts` uses `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY`; it also needs its own webhook/domain settings. Leave these credentials and ingestion behavior untouched. Recovery-specific names are `PASSWORD_RESET_FROM_EMAIL`, `APP_URL`, `ALLOWED_REDIRECT_ORIGINS`; removing their example entries later is not authorization to delete cloud secrets.

Repository search found no active first-party `request-password-reset`, `requestPasswordReset` or `resetPasswordForEmail` caller in `src/`. Retain App's `PASSWORD_RECOVERY` event/query handling, `ResetPasswordPage`, `src/api/auth.js` password update, Auth/session settings and stored metadata. Undocumented external consumers remain unknown; the release operator must confirm intended retirement of those consumers without account enumeration or real mail tests.

Release operator: **not yet designated**. Required approvals: ChatGPT independent review of the complete Stage 1 PR; user approval for the exact production project/function operation, integration controls and any deployment caused by merge. Neither this local assessment nor a future PR approval grants those cloud write permissions.

## B. Safe Execution Order (Conditional; Not Executed)

### Stage 1 preparation and publication

1. Supabase screenshot supports this non-main branch not being a production trigger and paid preview branching not being enabled. Vercel publication is explicitly authorized on the configuration/history evidence above; check deployment metadata after Push/PR. Do not change settings to obtain assurance.
2. Prepared minimal repository retirement: removed only the old handler and its TOML section; removed recovery-only example settings and obsolete README deploy instructions. The pre-existing, Git-ignored local `AGENTS.md` guide was synchronized locally; it is not added to the PR or force-tracked. Shared settings, ingestion source, database, Auth/session and frontend password logic are unchanged.
3. Retired the source-dependent SEC-01 suite; historical report unchanged. Four narrow repository-state checks in `tests/sec-02/password-recovery-retirement.test.mjs` run through `npm run test:audit` and existing CI. Existing webhook/auth tests are unchanged. Historical [handler](https://github.com/YijunYuan-Work/ApplyTrack/blob/94fba227c987798634c7bcc61933362884cb84c8/supabase/functions/request-password-reset/index.ts) and [25 characterizations](https://github.com/YijunYuan-Work/ApplyTrack/blob/94fba227c987798634c7bcc61933362884cb84c8/tests/sec-01/request-password-reset.test.mjs) remain available at the immutable baseline. Old standalone test commands in SEC-01 describe that historical checkout, not this retired state.
4. Run E's matrix against the proposed retired state and verify protected-file parity. Only after the publication confirmation, push and open **SEC-02: Prepare retirement of legacy password reset endpoint** against main. Keep it unmerged for ChatGPT review and explicit production approval. Passing source-absence checks does not establish cloud deletion.

### Stage 2: Requires New Explicit Authorization

1. Identify the operator and approved commit, recheck project/function IDs, release-gate version/source and ingestion metadata, retain a private rollback record, and confirm unknown-consumer disposition. Stop on unexpected version/source/project drift until assessed.
2. Under separately approved cloud-setting authorization, turn **Deploy to production off** for this Supabase GitHub integration, and verifiably isolate any other Supabase deployment writers and drain/cancel queued/in-flight syncs from old source. Record prior integration settings without credentials. Ensure the control itself does not redeploy/reset services. A GitHub check finishing is not proof no older deployment is queued. If queue control/confirmation is unavailable, stop rather than assuming isolation. Control Vercel deployment triggers separately; do not assume a main merge is deployment-free.
3. Under explicit merge/deployment authorization, merge the reviewed repository retirement PR. If Vercel deployments are not authorized, its trigger must already be verifiably paused by an authorized operator. Confirm the resulting main commit contains no recovery source/config or unintended database/Auth/ingestion changes. Keep Supabase synchronization paused; do not run generic deploy or db push.
4. With the exact deletion approval, delete **only** the custom recovery function using the verified CLI syntax below. Cloud deletion is security-sensitive, has no CLI dry-run shown in the inspected help, and is recoverable only via a newly authorized redeployment. No command in this document is execution consent.
5. Verify cloud metadata after deletion, preserving before/after records without private data. Confirm ingestion unchanged, not merely ACTIVE. Complete C's controlled checks. Stop on inconsistent metadata; do not probe the old endpoint without additional approval.
6. Before resuming any Git sync, ensure its source revision is retired main, old jobs cannot replay, and the reviewed deploy set excludes the retired slug and unrelated resources. Resume/reconfigure only with separate approval and known reconciliation behavior. If that cannot be established without redeploying ingestion/database resources, leave writers paused and escalate; do not deploy everything to test the theory.
7. Recheck function metadata after any approved integration resumption and its settling period. If the old function reappears, stop the release and record the incident; do not silently re-delete without authorization. Mark R01/SEC-02 complete only after review accepts verified retirement and the anti-redeployment controls.

### Verified CLI syntax; no write command was run

Local CLI version: **2.120.0**. `functions delete --help`, `deploy --help` and `list --help` were inspected without project arguments or remote writes. Revalidate installed version/help at execution. See [official CLI reference](https://supabase.com/docs/reference/cli/supabase-functions-delete).

Read-only deployment metadata command (operator authentication required; no secret values in output/report):

```powershell
npx --no-install supabase functions list --project-ref qotipygmwlovxklkexjb
```

**Stage 2 deletion only after exact approval:**

```powershell
npx --no-install supabase functions delete request-password-reset --project-ref qotipygmwlovxklkexjb
```

Use an explicit project reference and exact function slug; do not rely on a cached linked project. Do not add `--yes`, `--debug`, a shell loop, or delete other functions. Help shows no dry-run flag for deletion. `deploy --prune` can delete other remotely present functions absent locally and is **not** an acceptable substitute. Generic `functions deploy` can deploy all functions when names are omitted and is also excluded.

## C. Verification and Acceptance

| Check | Approved evidence / acceptance | Limitation or additional approval |
| --- | --- | --- |
| Retired function no longer ACTIVE | Management deployment list no longer contains the target slug/ID; record deletion result and repeat after approved sync settles | Not an HTTP invocation test; address eventual propagation with repeated metadata and operator confirmation, not guessing a delay |
| Custom privileged handler unavailable | Control-plane deletion plus no deploy source/config and no stale automation writer | Empirical gateway non-invocation remains untested without separately approved controlled request; do not claim an observed HTTP 404 |
| No real recovery mail sent by release | No endpoint calls, token generation, mailbox tests or mail API calls in procedure; credentials untouched | No claim about unrelated concurrent external callers during transition |
| Ingestion preserved | Before/after ID, ACTIVE status, version, artifact hash, JWT setting; local source blob parity; unchanged webhook characterizations | A changed version/hash requires assessment even if status remains ACTIVE; real email replay requires separate approval |
| Existing valid-token frontend compatibility | Existing synthetic Auth UI tests with and without `recovery=1` pass; protected frontend/session files unchanged | Does not prove a real token is valid; no real tokens generated/consumed here |
| Authenticated password updates and normal auth | Synthetic sign-in, signup, sign-out and updateUser browser checks pass, including errors | Real password changes need separate user consent; no real-user test required here |
| No database/Auth modification | Approved diff and operation record show only target endpoint retirement/integration controls; no migrations/config push/SQL/Auth writes | Deployed-state attestation by operator; do not query private user/session records to prove it |
| No automatic recreation | Retired main verified, no stale writers, permitted integration settings documented, metadata stable after approved sync | Repository absence alone is insufficient; unknown writer policy blocks completion |

Do not call Supabase Auth's own recovery/verification endpoints disabled: only the custom Edge Function is being retired. Existing tokens retain normal expiry/verification semantics.

## D. Rollback (Not Created or Executed)

Reference currently observed v46 plus baseline commit `94fba227c987798634c7bcc61933362884cb84c8` and recovery blob `30cf679c83089b505fbe4bd09fbde75e44d396cd`. Refresh the version/source reference at deletion approval; do not use historical v44 uncritically.

Required configuration names, never values: `SUPABASE_URL`; existing `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEYS`; `RESEND_API_KEY`; `PASSWORD_RESET_FROM_EMAIL`; `APP_URL`; `ALLOWED_REDIRECT_ORIGINS`. Operator inventory must confirm availability and preserve prior origin/JWT policy privately. Do not delete or rotate shared keys or alter Auth/token settings as part of rollback. Existing settings do not prove delivery works.

Rollback is exceptional: restoring the unauthenticated privileged handler reintroduces SEC-01's security risks and requires **separate user deployment approval and explicit security-risk acceptance**. No automatic rollback on unrelated UI issues.

An approved operator would first isolate synchronization/queued deployments, retrieve the exact approved historical source and function-specific config into a project-local isolated rollback checkout without changing the current working tree/main or copying secrets, verify its hash and target, then deploy **only** this slug. After consent, the locally verified command shape from that approved checkout is:

```powershell
npx --no-install supabase functions deploy request-password-reset --project-ref qotipygmwlovxklkexjb --no-verify-jwt
```

`--no-verify-jwt` deliberately restores the historically observed public setting; it is not a safety improvement and needs explicit risk acceptance. No rollback checkout/function was created in preparation. Operator authentication must use private credential storage, not command-line tokens or committed environment files.

Record the newly deployed version/source and temporary risk acceptance, coordinate automation policy with the rollback source, and agree a deadline to retire it again. Avoid an automatic writer immediately undoing the manual rollback or resurrecting another stale version. Git revert alone cannot restore a deleted cloud artifact; conversely a revert pushed to an active sync branch could trigger additional unwanted deployments. No main reset/rewrite or blanket Supabase deploy is part of rollback.

## E. Validation and Current Completion Limits

The final matrix below was rerun against the proposed retired-source state. Browser HTTP is synthetic and points at local test infrastructure; no production Auth, webhook, email or database requests are made by these tests. Cloud retirement remains unperformed regardless of test success.

| Command | Current result |
| --- | --- |
| `npm test` | 34 passed |
| `npm run test:audit` | 18 passed (14 existing plus 4 retirement checks); Job Agent/Svix characterizations unchanged |
| `npm run test:auth-ui` | 12 passed; 1440/768/390px, legacy synthetic tokens and signed-in password updates |
| `npm run test:audit-ui -- --project chromium` | 22 passed; Chromium only, not Firefox/WebKit |
| `npm run lint` | Passed |
| `npm run build` | Passed; local artifacts only |
| `npm audit --audit-level=high` | Exit 0; no High/Critical, 3 Moderate dependency findings (`sprintf-js` / `argparse` / `mammoth` chain) |
| SEC-01 standalone synthetic handler suite | Historical baseline: 25 passed; now retired with its handler, not an active suite |
| `git diff --check` | Passed; repeated on final staged changes before commit |

Protected-tree parity against `origin/main` passed: `src/`, `tests/auth-ui/`, `tests/refinement-02/`, ingestion and shared Edge source, migrations, schema, `.github/`, lockfile, SEC-01 report and Refinement 02 report are unchanged. The two historical Git blob identifiers in A provide exact source references, not a new independent deployed-source comparison.

Do not run `npm audit fix --force`; the suggested mammoth downgrade is breaking and unrelated to endpoint retirement. Passing audit characterizations can reproduce known defects; they do not mean those defects are fixed. Retired-source checks do not prove deletion, propagation or anti-recreation in production.

## F. Stop Conditions and Explicit Approval Gates

- **Publication gate:** Supabase main deployment/disabled Preview branching evidenced by the user screenshot; user explicitly authorized Push/PR using Vercel configuration confirmation and recent history. Current Vercel setting remains independently unverified. Inspect post-push deployment records and stop/report any unexpected Preview; never treat the comments/events screenshot as the Preview toggle.
- Stage 1 repository cleanup and local validation are complete; publication/review pending. Intended PR title: **SEC-02: Prepare retirement of legacy password reset endpoint**. No PR exists yet.
- Stage 2 integration pause/reconfiguration/resumption, merge-triggered deployments, exact function deletion and any exceptional restore each require explicit authorization. A main merge is not automatically cloud-write approval.
- No endpoint invocation, real reset links/emails, user/secret reads, Auth/database changes, shared-key changes, paid branching or ingestion deploys are authorized here.
- Unexpected project/version/source drift, active old deployment jobs, unknown external consumers, changed ingestion artifact, metadata inconsistencies or missing rollback evidence stop release. Never try to repair them with blanket deploy/prune/reset commands.
- SEC-01 stays complete; SEC-02 is awaiting review/production approval, not Done; R01 remains open and RF-04/subsequent tasks remain Planned.
