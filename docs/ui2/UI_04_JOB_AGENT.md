# UI-04: Job Agent

Status: implementation and local verification complete. Independent
ChatGPT review and user visual acceptance are required before merge.

## Authority

- Base main: `c278bcb378faa9a9233255aec8ee20a138475706` (UI-03 PR #31).
- Required [CI 39073539038](https://github.com/YijunYuan-Work/ApplyTrack/actions/runs/39073539038)
  verified completed/success at that SHA before branch creation.
- Branch: `codex/ui2-job-agent`.
- Canonical: unchanged `UI_update`, commit
  `c3a18b349adff6ed54e4608cd11dd2bde3fa3bed`,
  `new_design/ApplyTrack Version B - Teal Terracotta.html`.
  Full Job Agent markup, styles, breakpoints and interactions were inspected;
  screenshot source was byte-verified against that Git artifact.

## Implementation

Setup and Matches reuse the existing Version B tokens, Figtree/JetBrains Mono,
navigation shell and `ui-button` controls. Matches follows the prototype's inbox
strip, separated search/source toolbar and unframed opportunity list. Cards use
three columns at 1040px+, two at 640-1039px and one below 640px. Titles, companies,
locations and compensation wrap rather than overflow. Tablet/phone actions have
44px minimum targets; secondary actions use intrinsic minimum widths to avoid
Firefox clipping. Open links explicitly participate in the Tab sequence, including
WebKit's default link-skipping mode. Actual keyboard focus remains visible.

Setup retains address creation, forwarding instructions, readiness, provider
states, pause/resume and confirmed rotation. A shared address component copies
the complete address, handles clipboard rejection, prevents duplicate in-flight
copies and ignores stale completion after replacement/unmount. The visible
address can ellipsize; its complete accessible text and title are retained.
Unavailable setup has an explicit retry. Queue read failures without an error
message receive a fallback error, not a false empty-result state (HEAD errors can
have empty messages in Firefox).

Existing conversion/removal mutation handlers are byte-identical to base main.
Opening the original external link never invokes conversion. Finished applying
still requires explicit confirmation and the existing RPC/canonical reconciliation.
Single/bulk removal preserves confirmations, snapshot scope, pending locks,
partial outcomes, safe retry, session guards and authoritative counts. Search,
server pagination and source filtering retain their existing contracts. Demo
continues to use only its local simulated workspace.

Card entrance is 400ms with a bounded stagger. Status, view/filter and loading
feedback use existing motion primitives and reduced-motion overrides. No fake
delay, optimistic success or animated premature removal is introduced.

## Deliberate Reference Differences

- The source has only the queue. Real Setup/Matches navigation and connection
  management remain, adding vertical space; Setup adopts the same visual language.
- Existing Demo has three leads, not five prototype records. Dates/statuses are
  actual available metadata, not fixed prototype strings. Unknown found dates
  are omitted; the existing explicit missing-location fallback remains.
- `getJobLeadPresentation()` is unchanged and is the sole salary presentation
  authority. Unsupported/unknown compensation is omitted. Structured bounds
  without known currency/units remain unitless. Explicit hourly/currency strings
  are preserved. No fixed salary benchmark bar, annualization, invented dollars
  or historical backfill reproduces the prototype's mock calculations.
- Finished applying retains the established wording and confirmation instead of
  the prototype's optimistic Mark applied timer. Open uses the original URL and
  keeps its full accessible source-specific name. Remove has a named icon button.
- Provider readiness uses truthful pending/error/paused states. Errors/warnings
  retain semantic colors rather than becoming decorative palette accents.
- Native button groups expose pressed state; the page has one main landmark and
  correctly ordered headings. Scoped Axe AA checks cover both views and errors.
  Larger mobile targets and full metadata can increase row height.

## CSS Ownership and Preservation

`src/styles/job-agent.css` owns Job Agent presentation. The replaced 213 Job
Agent selector branches were removed from `theme.css`, including obsolete
resume/profile/search controls. All 116 retained theme rules and 85 retained
App.css rules preserve declarations and media contexts. App.css itself has no
diff. Dashboard Job Agent summary selectors were deliberately retained.

The preservation check also verifies unchanged APIs, data/salary parsers,
Supabase files, dependencies, Auth/Demo contracts, shared foundations/navigation,
Dashboard, Progress, Profile, Import and Application form interiors. Test fixtures
add opt-in held conversion responses; old default behavior is preserved. Existing
tests only adapt source-control/heading locators; functional assertions remain.

## Verification

- `npm test`: 207 passed.
- `npm run test:audit`: 30 passed, including real Edge-handler synthetic tests,
  salary/parser parity, inbox concurrency and Excel parsing.
- Three-engine queue/salary/UI-04 regression run: 156 passed (52 per engine,
  including 19 new UI-04 cases per engine).
- Additional Chromium audit/navigation/Demo regressions: 63 passed.
- Lint, production build and diff-check passed.

```powershell
npm test
npm run test:audit
npm run test:audit-ui -- job-queue.spec.js salary-interpretation.spec.js job-agent-ui2.spec.js --workers=2 --max-failures=1
npm run test:audit-ui -- audit.spec.js navigation-shell.spec.js responsive-navigation.spec.js demo-profile.spec.js --project=chromium --workers=2 --max-failures=1
npm run lint
npm run build
git diff --check
```

New UI-04 cases exercise actual external popup navigation, creation failure and
retry, clipboard failures/stale responses, inbox session changes, confirmed
conversion success/failure/lost responses, duplicate prevention, cancellation,
Demo isolation, normal/reduced motion, long/missing data, focus and scoped Axe AA.
Geometry checks cover 390/640/768/900/1039/1040/1440px and live fractional iframe
widths 639.5/640.5/1039.5/1040.5px. Existing queue tests retain counts above server
caps, paging, delayed reads, partial deletion, concurrent conversion, session
changes and reload recovery. No test calls production ingestion or mutates real
account data.

## Visual Evidence

Chromium, DPR 1, 900px viewport height. Comparisons show approved source on the
left and actual existing Demo on the right at the same CSS width. Only the
reference export's presentation controls/bezel are removed. Full mobile card and
scrolled controls supplement first-viewport captures to show reachable actions.

| View | Desktop 1440px | Tablet 768px | Mobile 390px |
| --- | --- | --- | --- |
| Matches: source / implementation | [Compare](assets/ui04-matches-desktop.png) | [Compare](assets/ui04-matches-tablet.png) | [Compare](assets/ui04-matches-mobile.png) |
| Setup: implementation | [Setup](assets/ui04-setup-desktop.png) | [Setup](assets/ui04-setup-tablet.png) | [Setup](assets/ui04-setup-mobile.png) |

Mobile: [complete card](assets/ui04-card-mobile.png),
[scrolled queue actions](assets/ui04-actions-mobile.png),
[scrolled connection controls](assets/ui04-setup-controls-mobile.png).

Synthetic interaction states: [paused/import attention](assets/ui04-setup-attention.png),
[filtered empty](assets/ui04-filtered-empty.png),
[pending conversion](assets/ui04-pending.png), [failed conversion](assets/ui04-error.png),
[confirmed conversion](assets/ui04-confirmed.png), [confirmed empty queue](assets/ui04-empty.png).

Machine-readable evidence: [protected source](assets/ui04-preservation.json),
[CSS cleanup](assets/ui04-css-preservation.json),
[synthetic state checks](assets/ui04-state-checks.json).

## Limits and Release

These are synthetic/local browser tests, not live inbox delivery, real clipboard
permission certification, physical-device testing or assistive-technology
certification. Scoped zero-violation checks do not certify all legacy page
interiors. Independent review and final user visual acceptance remain pending.

No database migration, Edge Function release, dependency change or Supabase
configuration change is required. No production operation was performed; automatic
Supabase production synchronization must remain disabled. This PR is not merged
and no manual production deployment is authorized.
