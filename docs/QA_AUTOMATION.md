# QA Automation

ApplyTrack is both a React application and a quality-engineering portfolio.
The emphasis is on observable, trustworthy outcomes when requests fail, overlap
or return incomplete data, not on accumulating happy-path test counts.

The browser suites run the real React UI and Supabase JavaScript client. A
[per-context HTTP fixture](../tests/refinement-02/ui/fixtures/backend.js#L6-L30)
intercepts a synthetic Supabase origin, records requests and blocks unexpected
external traffic. Tests can separate a simulated database commit from delivery of
its HTTP response. No production account, live email or live database is needed.

The cases below describe existing regression and defensive scenarios, **not
historical production incidents**. They do not claim that every injected ordering
was previously observed in production. Finding IDs record audit traceability.

## A. Concurrent Application Status Updates

**Risk.** A failed request may already have committed. A delayed status response
can overwrite a newer form edit, or a stale write can undo the user's latest
intent. A correct dropdown value alone would miss those data-integrity failures.

**Setup.** Seed an Applied application, sign in through the synthetic Auth route
and set `state.controlStatus = true`. The
[PATCH fixture](../tests/refinement-02/ui/fixtures/backend.js#L100-L125) queues operations
and evaluates version filters at commit time. `commit()`, `respond()`, `fail()` and
`abort()` control state changes and transport outcomes independently; synchronization
uses `expect.poll`, not arbitrary sleeps.

**Execution.** The [FIFO scenario](../tests/refinement-02/ui/status-mutations.spec.js#L18-L40)
selects Interview, Rejected and Offer while the first request is pending, then
releases responses one at a time. The
[late-write scenario](../tests/refinement-02/ui/status-mutations.spec.js#L42-L56)
aborts the first response, completes the newer Rejected request, then attempts
the abandoned write's commit. Its decisive assertions are:

```js
expect(first.commit()).toEqual([])
expect(state.applications[0].status).toBe('Rejected')
await expect(control(page)).toHaveValue('Rejected')
await page.reload()
await expect(control(page)).toHaveValue('Rejected')
```

**Assertions.** The guarded old write affects zero rows; UI and fixture state agree,
including after reload. FIFO checks also inspect partial PATCH payloads, unchanged
notes/salary/contact/follow-up fields, interview rounds and rejection dates. A
[delayed response after a full edit](../tests/refinement-02/ui/status-mutations.spec.js#L91-L110)
must preserve newly saved notes and salary. A
[reverse-response test across two records](../tests/refinement-02/ui/status-mutations.spec.js#L192-L209)
checks that one record's success does not clear another's error.

**Demonstrates.** Risk-based concurrency tests distinguish user intent, simulated
commit and response reconciliation. They catch lost updates and misleading success
states that a select-and-assert smoke test cannot.

**Limits.** HTTP interception models optimistic version checks; it is not a real
PostgreSQL lock scheduler or proof of hosted RLS. Only the explicitly controlled
interleavings are exercised. The separate SQL runner verifies database behavior.

## B. Partial or Failed Deletion

**Risk.** Cancellation must not delete anything. A failed or partial response must
not be reported as complete success, clear the user's selection prematurely, or
delete unrelated applications. A lost response is ambiguous even after a commit.

**Setup.** Seed applications with known IDs and an unrelated row whose notes/salary
must survive. Enable `state.controlDeletes`, select exact records and accept or
dismiss the native confirmation dialog. The
[DELETE fixture](../tests/refinement-02/ui/fixtures/backend.js#L127-L163) can restrict
returned/deleted IDs, fail a request, abort after committing, or return malformed
confirmation data.

**Execution and assertions.**

- [Cancellation](../tests/refinement-02/ui/delete-mutations.spec.js#L32-L46): Board
  and List retain the exact selection and row count; the request log contains no DELETE.
- [Failure then retry](../tests/refinement-02/ui/delete-mutations.spec.js#L48-L76):
  inspect the user filter, requested IDs and `select=id`; hold the request, return
  an error, assert the alert and checked records, then confirm a retry. Only the
  intended IDs disappear, the unrelated row is byte-for-value unchanged in fixture
  state, and reload shows the surviving record.
- [Selection changes while pending](../tests/refinement-02/ui/delete-mutations.spec.js#L99-L124):
  newly selected unrelated IDs stay checked; duplicate click events create only
  one confirmation and one delete operation.
- [Zero/partial and invalid confirmations](../tests/refinement-02/ui/delete-mutations.spec.js#L218-L245):
  show an explicit error and retain selection instead of claiming full success.
- [Committed delete with a lost response](../tests/refinement-02/ui/delete-mutations.spec.js#L247-L265):
  a zero-row retry is still not false success; reload resolves what remains.

**Demonstrates.** Negative tests inspect both visible feedback and the exact set of
records changed. They distinguish confirmed failure, incomplete confirmation and
transport ambiguity rather than treating every HTTP completion as success.

**Limits.** A partial simulated commit can leave rows removed in fixture state while
the UI deliberately retains its unconfirmed selection. These tests do not promise
transactional rollback across HTTP or automatic recovery from every ambiguous
delete. The `RLS-style` test name means a simulated zero/partial result, not a live
RLS execution test; reload/check guidance remains important before retrying.

## C. Job Agent Queue Boundaries

**Risk.** A first-page length can be mistaken for the whole queue. Search beyond a
server cap may miss jobs, filtered bulk removal may target the wrong scope, or a
late response may replace the latest search results.

**Setup.** The [boundary matrix](../tests/refinement-02/ui/job-queue.spec.js#L23-L54)
uses 0, 1, 499, 500, 501 and 1,203 waiting leads, plus Applied, expired and other-owner
leads that must survive. Cap returned rows at 37 independently of exact counts;
the visible page is limited to 20. No large live dataset is needed.

**Execution and assertions.**

- Boundary cases verify Dashboard and queue totals, newest-first order, bounded
  rendering, confirmed bulk removal and persistence after reload. DELETE requests
  target only new, unassociated leads; existing applications and excluded leads remain.
- [Search/source filtering](../tests/refinement-02/ui/job-queue.spec.js#L56-L92)
  finds a rare literal containing punctuation in a 1,101-lead queue, distinguishes
  no matches from an empty queue and resets pagination when filters change.
- [Filtered Remove All](../tests/refinement-02/ui/job-queue.spec.js#L94-L106)
  confirms the whole waiting queue, not just the filtered page; cancellation sends no DELETE.
- [Failure and partial-batch handling](../tests/refinement-02/ui/job-queue.spec.js#L108-L168)
  injects failure, partial, lost and invalid responses. With 201 leads, the first
  batch confirms 100 removals and the next fails: the alert reports partial
  progress, 101 remain, and retry handles those remaining leads. Truncated
  confirmations never become an unqualified success message.
- [Conversion/new-arrival overlap](../tests/refinement-02/ui/job-queue.spec.js#L201-L221)
  preserves a lead converted during deletion and a newly arrived lead beyond the
  deletion snapshot. [Stale search responses](../tests/refinement-02/ui/job-queue.spec.js#L306-L321)
  are returned in reverse order; only the latest result stays visible.

**Demonstrates.** Boundary-value analysis targets the result cap and batch/page
boundaries, while risk-based checks protect counts, deletion scope and concurrent
arrivals. More realistic failure modes matter more than just rendering many cards.

**Limits.** These are deterministic client/HTTP-contract checks, not load tests or
proof of production scale, live provider templates, PostgREST parsing or hosted
authorization. The fixture implements the query subset these tests use.

## Fixture Organization

The compatible [fixture entry point](../tests/refinement-02/ui/fixtures.js) keeps
existing imports stable. [Data builders](../tests/refinement-02/ui/fixtures/data.js),
[HTTP interception/state](../tests/refinement-02/ui/fixtures/backend.js) and
[UI interactions](../tests/refinement-02/ui/fixtures/interactions.js) now have
separate homes. CRUD and Job Agent routing stay together: splitting their small,
shared query/mutation state further would obscure the concurrency contract.

The move preserves delayed commit/response controls, version filters, partial
deletes, query counts, request logs and external blocking. Each backend also clones
its default synthetic user, so metadata cannot leak between instances. The separate
Auth harness and shared navigation/accessibility helpers remain unchanged; there is
no new framework, Page Object Model or dependency.

## Cross-Browser Smoke

The [smoke config](../playwright.smoke.config.js) selects existing `@smoke` cases,
not copies. Exactly **7 Firefox + 7 WebKit** executions run serially with one worker:

| Existing scenario | Selection / risk |
| --- | --- |
| [Core application workflow](../tests/refinement-02/ui/audit.spec.js#L4) | CRUD, details, sorting/filtering, pagination and reload. |
| [Form validation](../tests/refinement-02/ui/form-save.spec.js#L24) | Real mode: required fields, trimmed content and reliable saves. |
| [Job queue filtering](../tests/refinement-02/ui/job-queue.spec.js#L56) | Search beyond the first server page, literal punctuation, source filters and page reset. |
| [Progress analytics](../tests/refinement-02/ui/progress-analytics.spec.js#L10) | 768px: Real/Demo parity, Pipeline Map and Calendar. |
| [Responsive navigation](../tests/refinement-02/ui/responsive-navigation.spec.js#L52) | 390px and 768px: authenticated routes, keyboard interaction and Sign Out. |
| [Sign Out outcomes](../tests/refinement-02/ui/sign-out.spec.js#L23) | 1440px: failure feedback, retry and duplicate-click prevention. |

Each Real case signs in through the synthetic backend. Smoke is an early
cross-engine signal, not the complete functional, concurrency or Auth suite on
those engines. All original cases and assertions still run in Chromium; the full
Firefox/WebKit suite remains an optional local gate. No retries or sleeps were added.

## Evidence and Reproduction

See the [test guide](../tests/refinement-02/README.md) for commands and limitations.
[GitHub Actions](../.github/workflows/ci.yml) runs the complete 241-case Chromium
functional suite with two workers, the separate 12-case Auth suite, 207 Unit and
30 Audit tests, the 7-per-engine Firefox/WebKit smoke gate, lint and build. No
retries or critical-test deferral to main. Native Deno and isolated PostgreSQL
checks remain local gates, separate from the synthetic HTTP tests.

Native HTML reports show each test's status, duration, source and execution steps,
plus attachments when a test produces them. Failure traces support DOM/network
inspection; selected tests supply responsive screenshots and accessibility/geometry
evidence. Automated axe/focus checks are not full WCAG or physical-device certification.

Use a specific run's commit and artifacts as pass/fail evidence; these baseline
counts and source descriptions are not a claim that every future run passes.
Reports are downloadable artifacts with three-day retention, not a hosted public
dashboard. A public repository's artifacts are not a confidentiality boundary:
use synthetic fixtures only and never upload a real session, resume or account data.
