# ApplyTrack — Refinement Master Plan

**Version:** 1.0  
**Status:** Active — Approved (2026-10-10)  
**Baseline:** `main` at `d2ad8718ff8ad68591d6b7ccbfe2cf626bd97650` (Refinement 02 merged)  
**Source:** [Refinement 02 Quality Audit](./REFINEMENT_02_QUALITY_AUDIT.md)  
**Document:** `docs/refinement/REFINEMENT_MASTER_PLAN.md`

## 1. Project Objective

Bring ApplyTrack to a production-quality standard suitable for a professional Software Engineering / QA Engineering portfolio.

The refinement effort focuses on:

- Functional correctness and reliability
- Data integrity and security
- Maintainable architecture and clean code
- Consistent, polished UI/UX
- Accessibility and responsive usability
- Meaningful automated testing
- Clear technical documentation

### Non-negotiable Principles

- No new business features.
- No unnecessary architectural rewrites.
- No paid services or additional monthly costs.
- Existing user data must be preserved.
- Production database changes require explicit approval.
- UI redesigns require a design review, using Claude Design when appropriate.
- ChatGPT owns planning, priorities, acceptance criteria and code review.
- Codex owns implementation, investigation and testing.
- Prefer narrow, independently reviewable PRs.
- No automatic merges.
- Do not reopen PR #6 or restart the abandoned backup-tool project.

## 2. Tracking Rules

Each task must have:

- Stable Task ID
- Priority
- Scope and related audit findings
- Defined acceptance criteria
- Dependencies
- Status
- PR link when available
- Final verification result

### Status Definitions

- `[ ]` Planned — not started
- `[~]` In Progress — implementation underway
- `[?]` Blocked / Decision Required — needs further evidence or approval
- `[x]` Done — approved, merged, and required release checks complete
- `Deferred` — intentionally postponed
- `Not Required` — investigated and closed without implementation

Only one implementation task should normally be active at a time. Independent read-only investigation may be performed when needed.

A task is not complete merely because Codex pushed code or CI passed.

---

# 3. Completed Foundation

- [x] **BASE-01 — Excel Import Security & CI** — [PR #4](https://github.com/YijunYuan-Work/ApplyTrack/pull/4)
- [x] **BASE-02 — Dependency Security Hardening** — [PR #5](https://github.com/YijunYuan-Work/ApplyTrack/pull/5)
- [x] **BASE-03 — Hide Public Password Recovery UI** — [PR #7](https://github.com/YijunYuan-Work/ApplyTrack/pull/7)
- [x] **BASE-04 — Comprehensive Functional & Codebase Quality Audit** — [PR #8](https://github.com/YijunYuan-Work/ApplyTrack/pull/8)

**Closed / Not Merged:** [PR #6 — Account Recovery Hardening](https://github.com/YijunYuan-Work/ApplyTrack/pull/6).

The abandoned password-recovery and database-backup development initiatives are not part of the active roadmap.

---

# Phase A — Data Integrity & Security

**Priority: Highest**

The objective is to eliminate issues that can corrupt user data, compromise account boundaries or leave the application in an inconsistent state.

## RF-03 — Application Notes Data Integrity

**Priority:** P0  
**Size:** Small  
**Findings:** F02, F03, CQ07, G01  
**Status:** [x] Done — merged and production deployment verified  
**PR:** [#9](https://github.com/YijunYuan-Work/ApplyTrack/pull/9)  
**Merge commit:** `a311d7e00ccf08abc208756a9d4347e4b2b30ac8`  
**Completed:** 2026-10-10 (America/Toronto)  
**Release verification:** GitHub CI/security checks passed; Vercel Production deployment READY for merge commit. No live-account end-to-end test claimed.

Implementation and validation: [RF-03 technical report](./RF_03_APPLICATION_NOTES_INTEGRITY.md).

Scope:

- Prevent legacy metadata extraction from removing legitimate Notes.
- Handle `NULL` and missing Notes safely.
- Preserve existing application data across fetch, edit and save.
- Retain documented legacy compatibility without destructive assumptions.
- Improve mapper testability where justified.

Acceptance:

- Notes content is preserved exactly where appropriate.
- Dashboard loads successfully with nullable Notes records.
- Role-only edits do not modify Notes.
- Existing legacy behavior is documented and regression-tested.
- No schema changes or production data mutation.

## RF-04 — Job Lead Ownership Integrity

**Priority:** P0  
**Size:** Medium  
**Findings:** F01; SQL-boundary portion of G02  
**Dependency:** RF-03 sequencing only  
**Status:** [x] Done — production migration deployed and independently verified (2026-10-11 America/Toronto)  
**Implementation PR:** [#12](https://github.com/YijunYuan-Work/ApplyTrack/pull/12), merged as `7cd120dbf07b8f59abe088efe5092937bf77f264`  
**Migration:** `20261011042500_job_lead_ownership_integrity.sql`  
**Production project:** `qotipygmwlovxklkexjb` (ApplyTrack; PostgreSQL 17.6)  
**Production history:** Version `20261011042500`, name `job_lead_ownership_integrity`, registered; nine earlier versions retained.  
**Migration runbook and completion evidence:** [RF-04 Ownership Migration Runbook](RF_04_OWNERSHIP_MIGRATION_RUNBOOK.md)

Production completion (independently read-only verified by ChatGPT):
- Validated `UNIQUE (user_id, id)` on Applications and composite same-owner `job_leads_application_owner_fkey`; original single-column FK absent.
- New FK uses `ON DELETE SET NULL (application_id)`; Lead owner `user_id` remains NOT NULL. Existing one-to-one Lead association uniqueness remains intact.
- Applications: **420**; Job Leads: **629**; linked Leads: **31**; missing references: **0**; cross-owner links: **0**; duplicate associations: **0**.
- Applications and Job Leads RLS remain enabled; existing policies, column permissions and `complete_job_lead_application(bigint,date)` RPC were not changed by this release.
- The user explicitly accepted executing this migration **without a production backup**. The CLI release succeeded, production history matches the repository filename, and post-release catalog/data checks passed.
- Supabase automatic production synchronization remains under its existing **OFF** hold; do not re-enable it as part of RF-04.

F01 is **closed at the production database constraint boundary**. G02's complete hosted HTTP/Auth/Edge integration remains a separate, unverified scope, not evidence that the owner-FK fix failed. The previously identified broad anonymous Applications grants remain a **separate least-privilege improvement**; the proposed permission-hardening SQL was **not applied**.

**Release outcome:** RF-04 is complete. No standalone backup platform, further backup readiness program or additional production action is required to close RF-04.

## RF-05 — Job Alert Processing Reliability

**Priority:** P0  
**Size:** Medium  
**Findings:** F06, R07  
**Status:** [x] Done — production SQL and Edge Function v22 independently verified (2026-10-11 America/Toronto)  
**Implementation PR:** [#17](https://github.com/YijunYuan-Work/ApplyTrack/pull/17) — merged as `5981fc5d5d56ee3e44411f272578553be9d8f2d2`  
**Migration:** `20261012005112_job_alert_processing_reliability.sql` — production history version `20261012005112` registered  
**Production Edge Function:** `ingest-job-alert` v22, ACTIVE, `verify_jwt=false` (existing signed webhook setting)  
**Evidence:** [RF-05 Implementation and Production Release](RF_05_ALERT_PROCESSING_RELIABILITY.md)

Production verification (ChatGPT read-only inspection after user-authorized release):
- Both `claim_job_alert_message` and `finish_job_alert_message` exist and are SECURITY INVOKER with an empty search path; `anon` and `authenticated` cannot EXECUTE, while `service_role` can. Message claim/lease columns exist.
- The deployed v22 `index.ts` and shared `jobAlertParser.ts` exactly match reviewed GitHub `main` after newline normalization. No unrelated Edge Functions were deployed.
- 342 message records, all terminal (`completed`/`partial`/`ignored`); 0 `processing`/`failed`/`received`, 0 processing tokens and 0 duplicate Resend message IDs.
- 629 Job Leads, 420 Applications, 31 linked Leads; 0 cross-owner links, missing Applications or duplicate Lead keys. RF-04 ownership FK remains validated; RLS remains enabled.
- GitHub CI passed, including 34 unit, 27 audit, 12 authentication UI and 22 Chromium UI checks. Codex separately reported successful local PostgreSQL 17 concurrency/fault-injection/handler tests.
- No synthetic email or live end-to-end Resend request was sent to production. Runtime ingestion should continue to be observed through normal usage; production deployment and static/data verification do not certify live webhook delivery.
- Supabase automatic production synchronization remains under its existing OFF hold; do not re-enable it as part of RF-05.

**Outcome:** F06 and R07 are closed for RF-05. Lease recovery requires webhook redelivery; a separate scheduler was intentionally not added. RF-06's remaining conversion/state consistency work is a distinct task. This release does not authorize future schema/deployment changes.

## RF-06 — Job Lead State Consistency

**Priority:** P0  
**Size:** Medium–Large  
**Findings:** F05 (remaining conversion-retry defect); coordinated with completed RF-05  
**Status:** [x] Done — production migration applied and independently verified (2026-10-12 America/Toronto)  
**Implementation PR:** [#18](https://github.com/YijunYuan-Work/ApplyTrack/pull/18) — Squash merged as `9f361fc25c9d867d20545a58b1ca7fba830fb045`  
**Migration:** `20261012025412_job_lead_state_consistency.sql`; production history registered exact version `20261012025412`, name `job_lead_state_consistency`  
**Evidence:** [RF-06 Job Lead State Consistency](RF_06_JOB_LEAD_STATE_CONSISTENCY.md)

Production verification (ChatGPT independent read-only inspection):
- The deployed `complete_job_lead_application(bigint,date)` function contains the reviewed repair before the existing-Application return: when a same-owner associated Lead is not `applied`, it updates **only** the Lead state to `applied`. The owner-scoped `FOR UPDATE` lock and original Application row/date behavior remain.
- Function remains SECURITY INVOKER with an empty search path. Owner `postgres`; effective EXECUTE: `authenticated` yes, `anon` no, `service_role` yes. Existing ACL and RLS behavior were not intentionally changed by this migration.
- Production: 629 Leads, 420 Applications, 31 linked Leads, 342 alert messages; zero stale linked Leads, zero cross-owner associations, zero duplicate Lead keys or Application links, zero processing messages.
- The RF-04 owner-aware FK is still validated; the RF-05 claim/finish RPCs remain service-only among application roles. All four relevant tables retain RLS.
- Edge `ingest-job-alert` remains ACTIVE at v22; no Edge redeployment was needed. GitHub merge CI passed, Vercel production reached READY.
- Concurrency, repeated conversion, date preservation and stale-state repair were exercised in local PostgreSQL 17 synthetic regression tests; no live conversion was triggered on production user data. Verification of code/permissions/data is not a claim of production end-to-end HTTP testing.

**Outcome:** RF-06 is complete. Application-deletion product semantics and unrelated state UX remain separate potential work; no additional RF-06 release stage or historical data repair is required.

## SEC-01 — Password Recovery Endpoint Risk Triage

**Priority:** Security review before further production backend changes  
**Size:** Small investigation; implementation conditional  
**Finding:** R01  
**Status:** [x] Done — security triage completed; R01 mitigated by SEC-02 retirement  
**PR:** [#10](https://github.com/YijunYuan-Work/ApplyTrack/pull/10) (audit only)  
**Merge commit:** `bf292553a7fa218a7dea9ef75758d978c3964f03`  
**Completed:** 2026-10-10 (America/Toronto)  
**Report:** [SEC-01 Password Recovery Security Triage](SEC_01_PASSWORD_RECOVERY_TRIAGE.md)  
**Disposition:** Option A recommended for separate remediation; no production changes authorized by this audit.

Scope:

- Determine whether the existing production recovery endpoint remains publicly reachable.
- Review the security implications of in-memory rate limiting, unverified recovery metadata and response differences.
- Evaluate the smallest safe response within the zero-cost requirement.
- Do not revive PR #6 automatically.

Acceptance:

- Exposure and risk are documented with evidence.
- Any proposed deactivation preserves necessary compatibility or explicitly documents the trade-off.
- No production change occurs without approval.

## SEC-02 — Retire Legacy Password Reset Request Endpoint

**Priority:** P0 security risk reduction  
**Size:** Small–Medium  
**Findings:** R01; follow-up to SEC-01  
**Status:** [x] Done — retired from production; follow-up automation control remains paused  
**Dependency:** [Approved SEC-01 triage](SEC_01_PASSWORD_RECOVERY_TRIAGE.md)  
**PR:** [#11](https://github.com/YijunYuan-Work/ApplyTrack/pull/11) — merged  
**Merge commit:** `5d95f1c66db0661f90a5ace1e92098f59aaf0796`  
**Completed:** 2026-10-11 (UTC; production deletion independently verified)  
**Runbook:** [SEC-02 Retirement Runbook](SEC_02_RETIREMENT_RUNBOOK.md)  
**R01 disposition:** Mitigated — `request-password-reset` is absent from the live Supabase Edge Function inventory. The `ingest-job-alert` deployment metadata, version v21, function ID, JWT setting, and artifact hash remained unchanged; the project reports `ACTIVE_HEALTHY`. No live-auth/token end-to-end test was performed.  
**Operational hold:** The Supabase GitHub Integration `Deploy to production` setting was disabled by the user before retirement and must remain disabled; its current saved state cannot be independently read via the available connector. Its re-enablement, any pending-writer reconciliation, and future production database/Edge deployments require a separate reviewed release decision. The user explicitly accepted residual uncertainty about the stale historical GitHub check and internal queue; treat unexpected function recreation as a new incident.

Scope:

- Plan a minimal, controlled retirement of the unused custom `request-password-reset` Edge Function and its obsolete repository source/config/documentation.
- Preserve existing valid recovery-token consumption, the reset-password page and authenticated password updates.
- Verify there are no active first-party callers or unexpected dependencies, and document limits of that verification.
- Preserve an operator-owned rollback record of the release-gate handler version (v46 observed during SEC-02; revalidate), without storing secrets in Git.
- Keep shared Supabase/Resend secrets and the `ingest-job-alert` function unchanged.
- Remove or appropriately retire SEC-01 characterization tests that require the deleted handler, while retaining supported-auth regression tests.

Acceptance:

- An approved deployment plan specifies precise cloud actions, preflight, validation and rollback.
- The retired custom request endpoint can no longer invoke admin user enumeration, generate recovery links or send reset emails.
- Existing-token frontend handling and signed-in password changes remain supported.
- No Auth settings, user records, session data, database schemas, shared secrets or Job Agent ingestion are modified.
- CAD $0/month constraint is preserved.

**Production gate:** Separate explicit user authorization is required for the exact Supabase Edge Function delete/deactivation or deployment. Planning or merging a PR does not authorize production writes. SEC-02 is not started or completed by PR #10.

---

# Phase B — Functional Reliability

**Priority: High**

Correct existing workflows without introducing new product capabilities.

## RF-07 — Application Status Mutation Reliability

**Priority:** P0  
**Size:** Medium  
**Findings:** F04, R03  
**Status:** [x] Done — merged CI and Vercel Production independently verified (2026-10-12 America/Toronto)  
**PR:** [#19](https://github.com/YijunYuan-Work/ApplyTrack/pull/19) — Squash merged at `51b49d9283affed471b61d2a7cbc7f607941ae9c`  
**Evidence:** [RF-07 Application Status Mutation Reliability](RF_07_APPLICATION_STATUS_RELIABILITY.md)

Scope and outcome:

- Per-Application FIFO status writes and version-checked, status-only PATCH operations prevent stale status responses from overwriting newer changes or unrelated Application fields.
- New per-record pending/error announcements and bounded reconciliation handle failed and ambiguous responses. Interview count and Last Updated behavior remains.
- Identity/session-scoped loading fences stale authentication refresh and older application snapshots (R03).
- Demo mode and existing Board/List workflows remain supported. No new database migration, Edge Function deployment, dependency or production Supabase write was required.
- GitHub merged-commit CI passed: 35 unit tests, 27 audit tests, 12 authentication UI tests, 46 Chromium functional audit tests; lint and build passed. Vercel Production deployment for the merged commit reported READY; Supabase Preview check was skipped as intended.
- Browser queue is ephemeral; no global cross-tab/device user-intent ordering. Full-form edit concurrency and navigation lifecycle are separate RF-08 work. No live production write/race test was performed.

## RF-08 — Application Form & Save Lifecycle

**Priority:** P1  
**Size:** Medium  
**Findings:** F13, F14, CQ01  
**Status:** [ ] Planned  
**PR:** TBD

Scope:

- Validate whitespace-only required fields.
- Provide actionable submission errors.
- Prevent late save responses from overriding subsequent user navigation.
- Improve explicit mutation outcome handling.

Acceptance:

- Invalid input cannot fail silently.
- Save errors remain visible and actionable.
- User navigation is not unexpectedly reversed by delayed responses.
- Real and Demo behavior remains consistent.

## RF-09 — Destructive Operation Reliability

**Priority:** P1  
**Size:** Small–Medium  
**Findings:** F10, CQ01  
**Status:** [ ] Planned  
**PR:** TBD

Scope:

- Preserve selections when bulk deletion is canceled or fails.
- Only clear selection after successful deletion.
- Improve failure announcements and retry behavior.

Acceptance:

- Cancel leaves records and selection intact.
- API failure leaves records and selection intact.
- Success removes only intended records.
- Errors are accessible and understandable.

## RF-10 — Job Agent Queue Accuracy

**Priority:** P1  
**Size:** Medium  
**Findings:** F07, F16, R04  
**Status:** [ ] Planned  
**PR:** TBD

Scope:

- Correct Remove All behavior beyond the first 500 retrieved leads.
- Make bulk-operation scope explicit.
- Distinguish an empty queue from empty search results.
- Investigate whether removed leads may be recreated by later alerts.

Acceptance:

- Bulk removal accurately reflects its actual scope.
- No false success or false empty-queue messaging.
- Search results and filters are consistent.
- Re-appearing lead behavior is clarified before altering deletion semantics.

## RF-11 — Dashboard Selection Consistency

**Priority:** P1  
**Size:** Small  
**Finding:** F09  
**Status:** [ ] Planned  
**PR:** TBD

Scope:

- Align Select All with the actual Board/List view.
- Preserve existing pagination semantics.
- Verify selected counts, deletion counts and filtering interactions.

Acceptance:

- Board selection matches displayed Board records.
- List selection follows clearly defined page scope.
- Selections remain predictable after filtering and pagination.

## RF-12 — Historical Analytics Correctness

**Priority:** P1  
**Size:** Medium; potentially larger if persistence semantics change  
**Findings:** F08, G03  
**Status:** [?] Product Semantics Required  
**PR:** TBD

Scope:

- Define what date a rejection event represents.
- Prevent unrelated edits from silently rewriting historical meaning.
- Independently verify existing Progress metrics and calendar logic.
- Preserve existing historical data.

Acceptance:

- Historical reporting semantics are documented.
- Editing Notes does not incorrectly change historical rejection reporting.
- Calendar and metrics match deterministic test datasets.
- Any historical-data or schema decision is approved before implementation.

---

# Phase C — UI / UX & Accessibility

**Priority: Medium–High**

Focus on functional usability and visual implementation quality, without adding pages or features.

## RF-13 — Responsive Navigation & Sign Out

**Priority:** P1  
**Size:** Small–Medium  
**Findings:** F11, CQ05, G06  
**Status:** [ ] Planned  
**PR:** TBD

Scope:

- Restore reachable Sign Out controls at tablet widths.
- Simplify conflicting responsive CSS where necessary.
- Verify breakpoint boundaries, keyboard access and navigation.

Acceptance:

- Sign Out remains reachable at desktop, tablet and mobile widths.
- Existing navigation remains functional.
- No unintended layout regressions.
- Chromium, Firefox and WebKit regression coverage.

**Design gate:** Any material visual redesign requires prior design approval.

## RF-14 — Public Demo Interaction Accuracy

**Priority:** P1  
**Size:** Small  
**Finding:** F12  
**Status:** [ ] Planned  
**PR:** TBD

Scope:

- Remove misleading successful password-change behavior in Demo.
- Ensure simulated actions and their feedback accurately represent what happened.
- Verify Demo does not contact real authentication or persistence services.

Acceptance:

- Demo never falsely claims a real password was changed.
- Profile remains clear and professional.
- No new Demo authentication backend.

## RF-15 — Job Agent Salary Interpretation

**Priority:** P1  
**Size:** Small–Medium  
**Findings:** F15, CQ02  
**Status:** [ ] Planned  
**PR:** TBD

Scope:

- Correct supported salary shorthand interpretation.
- Review frontend/backend parsing differences.
- Avoid confident output for ambiguous compensation text.

Acceptance:

- `$90k–$120k` is not interpreted as `$90–$120`.
- Existing numeric and hourly examples remain correct.
- Parser and presentation tests cover common salary formats.

---

# Phase D — Codebase Cleanup

**Priority: After high-impact correctness fixes**

Do not begin a sweeping refactor. Approve individual cleanups only when supported by measurable maintainability value.

## RF-16 — Business Logic & Request Cleanup

**Priority:** P2  
**Size:** Medium  
**Findings:** CQ02, CQ06  
**Status:** [ ] Planned  
**PR:** TBD

Scope:

- Remove proven duplication between Real and Demo business transformations.
- Resolve inconsistent shared metrics.
- Eliminate redundant Job Agent summary requests where safe.
- Improve narrowly related data-flow boundaries.

Acceptance:

- Shared rules have parity regression tests.
- No unnecessary new architecture or dependencies.
- Existing data loading behavior is preserved.
- Repeated requests are reduced without creating stale-state bugs.

## RF-17 — Legacy Client Code Cleanup

**Priority:** P2  
**Size:** Small–Medium  
**Finding:** CQ03  
**Status:** [ ] Planned  
**PR:** TBD

Scope:

- Verify unreachable components, utilities and old resume/client workflows.
- Remove confirmed dead client code only.
- Reassess associated unused dependencies.
- Preserve real user records and Storage content.

Acceptance:

- No reachable feature regresses.
- Unused code is eliminated based on import/caller evidence.
- No schema or stored user data is deleted.
- Dependency changes pass security and regression checks.

## RF-18 — Schema Reproducibility & Validation

**Priority:** P2, with security/data-integrity exceptions prioritized earlier  
**Size:** Medium  
**Findings:** CQ04, CQ08  
**Status:** [?] Review Before Changes  
**PR:** TBD

Scope:

- Document and improve the initial schema/migration bootstrap contract.
- Review field constraints against current application validation.
- Investigate legacy rows before proposing tighter constraints.
- Prevent invalid numeric and status values from corrupting calculations.

Acceptance:

- Fresh setup instructions are reproducible.
- Schema behavior and frontend data contract are documented.
- Existing data remains compatible.
- Migration-history rewriting is avoided.
- Any database changes receive separate approval.

If bootstrap documentation and new schema constraints need different release paths, split them into separate PRs.

---

# Phase E — Final Quality Gate

## RF-19 — Remaining Risk Verification

**Priority:** P1–P2 based on findings  
**Size:** Medium  
**Status:** [ ] Planned  
**PR:** TBD / conditional

Investigate unresolved audit risks:

- R02 — Unpaginated fetches and server row limits.
- R05 — Excel dates and timezone edge cases.
- R06 — Clipboard permission failures.
- R08 — Malformed alert input and external parser assumptions.

R01, R03, R04 and R07 are tracked with their related implementation tasks.

Do not automatically convert every risk into a feature or infrastructure project.

Acceptance:

- Each risk is marked Confirmed, Mitigated, Accepted or Not Applicable.
- Confirmed defects are addressed by narrowly scoped tasks.
- Unverified items are not falsely reported as resolved.
- No unnecessary code is introduced merely to satisfy an audit checklist.

## RF-20 — Final Automated Regression & Engineering Review

**Priority:** P1  
**Size:** Medium–Large  
**Status:** [ ] Planned  
**PR:** TBD

Address coverage gaps G01–G07.

Scope:

- Convert all approved BUG-characterization tests to desired-behavior regression tests.
- Verify corrected Application, Excel, Progress, Job Agent and Authentication workflows.
- Expand targeted database and Edge integration checks where valuable.
- Review cross-browser and responsive behavior.
- Validate error/loading/empty states.
- Verify keyboard and accessibility fundamentals.
- Assess bundle size and performance with repeatable measurements.
- Re-run dependency and security checks.

Acceptance:

- No remaining unresolved Critical or High finding without explicit risk acceptance.
- All required CI checks pass.
- Corrected workflows have regression coverage.
- No regressions in Public Demo.
- Production and mock-only validation are clearly distinguished.
- Known limitations are documented.

## RF-21 — Documentation & Portfolio Readiness

**Priority:** P2  
**Size:** Small–Medium  
**Status:** [ ] Planned  
**PR:** TBD

Scope:

- Update README to match the actual shipped product.
- Remove outdated feature claims and setup guidance.
- Verify installation/development instructions.
- Document testing architecture and important engineering decisions.
- Review screenshots and public demo presentation.
- Ensure public documentation contains no secrets or misleading claims.

Acceptance:

- README accurately reflects current features.
- Setup instructions are repeatable.
- Demo is usable without creating an account.
- Final documentation is concise and professional.
- No new product functionality is added.

---

# 4. Current Execution Queue

SEC-02 retirement was independently verified in the production Supabase function inventory. Supabase GitHub Integration automatic production deployment remains intentionally OFF; do not restore it, apply RF-04 database migrations, or authorize other production Supabase writes without a separate release review. RF-04 is next in planning order, not automatically authorized. Later tasks may be reprioritized if new evidence changes the risk assessment.

| Order | Task | Priority | Status | PR |
| --- | --- | --- | --- | --- |
| 1 | RF-03 — Notes Data Integrity | P0 | Done — merged and deployed | [#9](https://github.com/YijunYuan-Work/ApplyTrack/pull/9) |
| 2 | SEC-01 — Recovery Endpoint Risk Triage | Security | Done — R01 mitigated via SEC-02 | [#10](https://github.com/YijunYuan-Work/ApplyTrack/pull/10) |
| 3 | SEC-02 — Retire Legacy Recovery Endpoint | P0 Security | Done — production absence verified; auto-sync remains OFF | [#11](https://github.com/YijunYuan-Work/ApplyTrack/pull/11); [runbook](SEC_02_RETIREMENT_RUNBOOK.md) |
| 4 | RF-04 — Ownership Integrity | P0 | Done — production migration verified | [#12](https://github.com/YijunYuan-Work/ApplyTrack/pull/12); [runbook](RF_04_OWNERSHIP_MIGRATION_RUNBOOK.md) |
| 5 | RF-05 — Ingestion Failure Handling | P0 | Done — migration and Edge v22 verified | [#17](https://github.com/YijunYuan-Work/ApplyTrack/pull/17); [evidence](RF_05_ALERT_PROCESSING_RELIABILITY.md) |
| 6 | RF-06 — Lead State Consistency | P0 | Done — production conversion RPC verified | [#18](https://github.com/YijunYuan-Work/ApplyTrack/pull/18); [evidence](RF_06_JOB_LEAD_STATE_CONSISTENCY.md) |
| 7 | RF-07 — Status Mutation Reliability | P0 | Done — CI and Vercel Production READY | [#19](https://github.com/YijunYuan-Work/ApplyTrack/pull/19); [evidence](RF_07_APPLICATION_STATUS_RELIABILITY.md) |
| 8 | RF-08 — Form & Save Lifecycle | P1 | Planned | — |
| 9 | RF-09 — Destructive Operations | P1 | Planned | — |
| 10 | RF-10 — Job Agent Queue | P1 | Planned | — |
| 11 | RF-11 — Dashboard Selection | P1 | Planned | — |
| 12 | RF-12 — Historical Analytics | P1 | Decision required | — |
| 13 | RF-13 — Responsive Navigation | P1 | Planned | — |
| 14 | RF-14 — Demo Interaction Accuracy | P1 | Planned | — |
| 15 | RF-15 — Salary Interpretation | P1 | Planned | — |
| 16 | RF-16–18 — Codebase Cleanup | P2 | Planned | — |
| 17 | RF-19–21 — Final Quality Gate | P1–P2 | Planned | — |

The order is a planning baseline, not an authorization to execute all tasks automatically.

---

# 5. Standard Workflow for Every Task

**Step 1 — Planning**

ChatGPT defines exact scope, acceptance criteria, known constraints and relevant audit findings.

**Step 2 — Implementation**

Codex creates a focused branch, implements the approved task, updates affected regression tests and opens a PR.

**Step 3 — Independent Review**

ChatGPT reviews code, architecture, test evidence, scope discipline and CI.

**Step 4 — User Acceptance**

User checks visible behavior when appropriate and confirms the result.

**Step 5 — Merge & Release**

Merge only after approval. Confirm CI and production deployment when applicable. Database migrations and Edge deployments require separately approved operations.

**Step 6 — Update Master Plan**

Update task state, PR link, final commit, completion date, evidence and remaining risks.

Do not mark an issue Done before all applicable acceptance criteria are met.

---

# 6. Project Completion Criteria

Refinement is considered complete when:

- All confirmed Critical/High defects are corrected or explicitly risk-accepted.
- Medium findings are resolved, mitigated or consciously deferred.
- All 16 original functional findings have a recorded disposition.
- All 8 code quality findings have a recorded disposition.
- All 8 potential risks have been investigated or consciously accepted.
- All 7 test coverage gaps have an explicit status.
- No significant known user-data integrity issues remain.
- Core workflows have effective regression protection.
- Desktop, tablet and mobile navigation is functional.
- Public Demo interactions are accurate and polished.
- Codebase architecture is understandable and maintainable.
- Production remains within the CAD $0/month budget.
- README and technical documentation accurately represent the delivered product.

**No additional features are required for completion.**

The final outcome is a stable, clean, well-tested and professionally presented ApplyTrack.
