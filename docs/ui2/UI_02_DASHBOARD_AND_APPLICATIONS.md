# UI-02: Dashboard and Applications

Status: implementation and local verification complete. Independent PR review,
merge and user visual acceptance remain separate gates. No deployment is authorized
by this report.

## Authority and Scope

- Base: UI-01 squash `5f28dbfa67656e589f25304d8039d58ad3d132b1`.
- Mandatory merged-main CI [38990287987](https://github.com/YijunYuan-Work/ApplyTrack/actions/runs/38990287987)
  completed successfully before implementation began.
- Canonical source: unchanged `UI_update`, commit
  `8bc43e40a20ab333a4437f8d60a067a3b7338915`,
  `new_design/ApplyTrack Redesign.html`. Its complete decoded template, styles,
  interaction logic and local browser presentation were inspected.
- Dashboard, Board/List, application details and complete create/edit form only.
  UI-01 shell, fonts and tokens are reused; other page interiors are not migrated.

## Implementation

The Dashboard now uses the approved header, four summary cards, Powder Job Agent
strip, pipeline hierarchy, status filters, sliding Board/List thumb and compact
records. Counts use existing application data and interview-round semantics.
Count-up is presentation-only, exposes the canonical value to assistive technology,
cleans up animation frames and respects reduced motion.

Board shows four columns at 1040px+, two columns at 640-1039px, and one selected
stage below 640px. The selection media query uses exactly the same range syntax
as CSS: tablet Select All includes all four displayed stages; phone Select All
includes only the active stage; List still selects only its current page.
Selected IDs, filtering, sorting, pagination and confirmed deletion retain their
existing ownership and lifecycle logic.

Cards and list rows open one shared native dialog: right drawer on desktop/tablet,
bottom sheet on phone. It reads the current application by ID, not a stale copied
record. It includes all details, literal escaped Notes, known rejection date,
canonical status buttons, Edit, Open job and confirmed Delete. Native modality,
explicit Tab/Shift+Tab wrapping, Escape/backdrop closing, scroll locking and focus
restoration are covered. Deletion errors remain inside the open drawer for retry.
Closing/removing a record or changing sessions releases the modal and private data.

Quick status selects retain RF-07's pending intent and error handling; chip colors
and drawer pressed states reflect canonical data only. Notifications derive from
confirmed/reconciled record changes, never an optimistic pending selection.
Original native destructive confirmation is deliberately retained, not replaced
with the prototype's unconfirmed delayed mock deletion.

The full form remains route-based with all existing fields, validation, literal
Notes, dirty confirmation, disabled fields during save, and normal global
navigation during saving. RF-07/RF-08 handlers and data contracts are unchanged.
Its controls use the approved visual language; mobile actions flow after the
fields instead of covering them with the former sticky footer.

## CSS Cleanup and Preservation

`src/styles/applications.css` owns migrated presentation. Removed 663 obsolete
selector branches from `App.css`/`theme.css`, including the unused StatusBadge,
old company logos, card expansion, old colored status pills, competing Dashboard
breakpoints and mobile overrides. Shared selector groups retain their unrelated
branches. A PostCSS comparison verified all 160 retained App.css and 449 retained
theme.css selector/declaration/media-context sequences against the base.

App.jsx changes only by importing this stylesheet after the legacy theme.
Supabase, API helpers, application models/mappers, Demo mutation logic, shared
shell and font/token files remain unchanged. No runtime dependencies were added.
Temporary formatter/browser/inspection artifacts are not committed.

## Visual Evidence and Deliberate Differences

Comparison captures use Chromium, DPR 1, exact CSS widths 1440/768/390 and 900px
height. Only the prototype's surrounding presentation controls/device bezel were
removed. Source has nine prototype records; the implementation uses the existing
six-record Public Demo. Neither mock records nor hardcoded metrics entered product
code. The comparisons are design-state comparisons, not identical-data pixel tests.

Committed browser evidence (approved source on the left; implementation on the
right, except the labeled baseline/editor views):

- [Before UI-02: three viewports](assets/ui02-before.png)
- [Desktop Board](assets/ui02-board-desktop.png)
- [Tablet Board](assets/ui02-board-tablet.png)
- [Mobile Board](assets/ui02-board-mobile.png)
- [Desktop List](assets/ui02-list-desktop.png)
- [Desktop card detail](assets/ui02-card-comparison.png)
- [Mobile drawer](assets/ui02-drawer-mobile.png)
- [Complete desktop editor](assets/ui02-form-desktop.png)
- [Complete tablet editor](assets/ui02-form-tablet.png)
- [Complete mobile editor, top and scrolled actions](assets/ui02-form-mobile.png)

The full editor's viewport geometry was also checked independently. Chromium
full-page capture can retrigger the existing shell's margin-left transition and
temporarily capture content under the sidebar. Stable form evidence finishes
animations in the capture only; product motion is not disabled. The mobile editor
evidence uses two real viewports rather than a full-page image that would paint
fixed bottom navigation over a middle section of the stitched page.

Meaningful, intentional differences:

- Public Demo is explicitly labeled and has no fake account Sign Out.
- Buttons retain 44px touch targets; zero letter spacing follows UI-01. The tablet
  header may wrap instead of squeezing its actions beside a long title.
- The real Select control and direct quick-status/Edit/Open/Delete affordances
  remain available, unlike the abbreviated prototype. Touch rows/cards are taller.
- Status filters preserve the established switch-to-List behavior; List retains
  pagination rather than rendering every matching record without a page limit.
- Short date-only labels keep full ISO values in semantic attributes/tooltips;
  the drawer preserves full dates and additionally exposes known rejection history.
- Complete forms are pages, not the four-field prototype modal. Existing native
  confirmation and explicit failure states replace prototype mock success behavior.

Visual iteration corrected stylesheet ordering/transparent button contrast,
mobile heading alignment, unnecessary tablet toolbar rows, banner-label contrast,
and the mobile form footer overlap. Focused card/drawer comparisons supplement
the full-view evidence; no unresolved material redesign is proposed.

## Verification

Tests use only synthetic local backends or Public Demo. Existing Notes/data
assertions now open the real detail
drawer rather than assuming inline expansion; assertions were not removed.
Additional tests cover seven viewport widths, fractional boundaries, canonical
status pending/failure/retry, confirmed deletion, session isolation, dialog focus,
reduced motion, field reachability and scoped accessibility.

| Check | Result |
| --- | --- |
| `npm test` | 204 passed |
| `npm run test:audit` | 30 passed |
| UI-02 + Dashboard selection + UI-01 navigation, Chromium/Firefox/WebKit | 111 passed, 37 per browser |
| Final Chromium CRUD/save/status/delete regression run | 99 passed |
| Authentication UI regression run | 12 passed |
| `npm run lint` | Passed |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| Unmigrated CSS declaration/context preservation | 609 retained selector branches unchanged |
| Protected API/model/Supabase/Demo mutation/shell/dependency paths | No diff |

Cross-browser tests cover 390, 640, 768, 900, 1039, 1040 and 1440px, additional
639/641px selection boundaries, and fractional iframe widths 639.5, 640.5, 767.5,
899.5, 1039.5, 1040.5 and 1180.5px. Firefox's requested 640px can evaluate to
639.98 CSS pixels: selection uses the actual media-query result, not rounded
`innerWidth`. Focused form fields are checked with `elementFromPoint`, not just
DOM visibility. Scoped Axe checks report no WCAG A/AA violations for the migrated
Dashboard, drawer and editor at all seven geometry widths.

The prior zero-round interview characterization now targets the visible summary
instead of removed hidden copy, retaining both numeric expectations: Dashboard's
round-based reached-interview helper is zero; Progress's existing status-aware
count is one. This presentation task does not change those analytics semantics.

Focused functional commands:

```powershell
npm run test:audit-ui -- dashboard-ui2.spec.js dashboard-selection.spec.js navigation-shell.spec.js --workers=1
npm run test:audit-ui -- form-save.spec.js status-mutations.spec.js delete-mutations.spec.js audit.spec.js --project=chromium --workers=1
npm run test:auth-ui
```

During iteration, tests exposed a native-dialog Tab escape, mid-animation contrast
sampling, a covered phone form field, and an insufficient 30-second budget for a
long multi-workflow case with motion. Focus wrapping, animation-aware checks,
editor-only scroll padding and a 60-second comprehensive-case budget addressed
these. Cold or interrupted diagnostic runs are not counted as passing evidence.
The final test runs retain normal product motion except explicitly reduced-motion
cases; no CRUD or concurrency assertions were weakened.

## Review and Release Boundary

This is a frontend-only PR. No database migration, Edge Function release, production
write or configuration change is needed. No Supabase synchronization setting was
changed or enabled, and no production or Preview deployment was manually triggered.
Production performance,
physical-device safe areas and real assistive-technology certification are not
claimed by local browser tests. ChatGPT review and user UI acceptance are required
before any human-approved merge. Progress, Agent, Profile and Import interiors
remain for their respective UI 2.0 phases.

The existing broad accessibility evidence test still records
`aria-valid-attr-value` on Progress and `color-contrast` in Job Agent. These are
outside the migrated surfaces; this report does not claim whole-application AA
conformance. The focused Dashboard/drawer/editor checks above pass independently.
