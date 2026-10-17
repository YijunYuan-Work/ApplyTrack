# UI-02: Dashboard and Applications

Status: implementation and local verification complete. Independent PR review,
merge and user visual acceptance remain separate gates. No deployment is authorized
by this report.

## Authority and Scope

- Base: UI-01 squash `5f28dbfa67656e589f25304d8039d58ad3d132b1`.
- Mandatory merged-main CI [38990287987](https://github.com/YijunYuan-Work/ApplyTrack/actions/runs/38990287987)
  completed successfully before implementation began.
- Canonical source: unchanged `UI_update`, commit
  `c3a18b349adff6ed54e4608cd11dd2bde3fa3bed`,
  `new_design/ApplyTrack Version B - Teal Terracotta.html`. Its complete decoded
  template, styles, interaction logic and local browser presentation were inspected.
  Actual colors and usage supersede its stale Version A palette labels.
- Dashboard, Board/List, application details and complete create/edit form only.
  The UI-01 shell and shared color tokens also adopt Version B; other page interiors
  are not migrated. The accepted UI-02 layout/functionality baseline is
  `f5314af51dc991b00c9092aae079f91ea53dc7d8`.

## Implementation

The Dashboard now uses the approved header, four summary cards, Sea Glass Job Agent
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
Supabase, API helpers, application models/mappers and Demo mutation logic remain
unchanged. The Version B follow-up changes only colors in `index.css`,
`AppLayout.css` and `applications.css`; fonts and all non-color foundation values
remain unchanged. No runtime dependencies were added.
Temporary formatter/browser/inspection artifacts are not committed.

## Version B Color-Only Follow-Up

The complete Version B prototype was inspected before selecting semantic tokens,
not treated as a five-value HEX replacement. Canvas is Cream Sand `#F1DEBA`;
surfaces are warm white `#FFFDF8`, fields/details white `#FFFFFF`, and Board/Notes
use `#F7EDDA`. Text, warm borders, hover fills, backdrop and shadow colors follow
the source's supporting palette. Navigation is Deep Teal `#286A73` with Sea Glass
`#8DBFC2` accents. The sidebar Add action uses Peach Sorbet `#F3B59D` and dark text;
Dashboard/mobile Add uses the source's deeper Terracotta `#A05A43`. General primary
actions remain Deep Teal; secondary actions use the Sea Glass tint `#D7EAEA`.

| Status | Marker | Label background / foreground |
| --- | --- | --- |
| Applied | Sea Glass `#8DBFC2` | `#D7EAEA` / `#286A73` |
| Interview | Terracotta `#B66D55` | `#A05A43` / `#FFFDF8` |
| Offer | Deep Teal `#286A73` | `#286A73` / `#FFFDF8` |
| Rejected | Peach Sorbet `#F3B59D` | `#FBE3D8` / `#8A4A35` |

These distinctions reproduce the actual source: using base Terracotta behind
small white status text would not preserve its contrast decision. Existing
danger/warning/success tokens and their backgrounds are unchanged; actual failures
are not recolored as decorative statuses. Compatibility aliases support page
interiors awaiting later phases without migrating their layouts.

Two deliberate accessibility differences from Version B remain. The prototype's
sidebar subtitle `#A9CFD1` and small footer label `#9CC6C9` have only 3.68:1 and
3.33:1 contrast on Deep Teal. Existing shell Axe tests caught these; both now reuse
sidebar text `#CDE3E4` (4.62:1). The existing solid 3px focus geometry is retained
in Terracotta rather than replacing it with the prototype's faint focus glow.
Neither adjustment changes sizing, typography or interactions.

Color-only preservation was independently checked against `f5314af` with PostCSS
declaration/context comparison: all **978 non-color declarations** remain identical
(54 foundation, 218 shell, 706 application). A protected-source diff confirms no
other `src/` file changed. Matched Board/List/drawer/form captures at 1440/768/390px
also have identical element geometry, font metrics and motion values across
**12 rendered states**. See the [machine-readable summary](assets/ui02-version-b-preservation.json).
The images below were refreshed from real rendered Version B pages after the
contrast correction; the initial UI-01 baseline image is historical only.

## Visual Evidence and Deliberate Differences

Comparison captures use Chromium, DPR 1, exact CSS widths 1440/768/390 and 900px
height. Only the prototype's surrounding presentation controls/device bezel were
removed. Source has nine prototype records; the implementation uses the existing
six-record Public Demo. Neither mock records nor hardcoded metrics entered product
code. The comparisons are design-state comparisons, not identical-data pixel tests.

Reference captures render the original standalone bundle directly with Chromium
(`file://`). Serving that export through Vite reports a parse5 warning about a
`div` inside `head > noscript`; this is a source-export compatibility issue, not
an application build error. Neither the canonical artifact nor product code was
changed to accommodate it.

Committed browser evidence (approved source on the left; implementation on the
right, except the labeled baseline/editor views):

- [Historical UI-01 / Version A baseline: three viewports](assets/ui02-before.png)
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

Initial UI-02 visual iteration corrected stylesheet ordering/transparent button contrast,
mobile heading alignment, unnecessary tablet toolbar rows, banner-label contrast,
and the mobile form footer overlap. Focused card/drawer comparisons supplement
the full-view evidence; no unresolved material redesign is proposed.

## Version B Verification

All requests use synthetic local services or Public Demo, not production. The new
palette regression covers 1440/768/390px in Chromium, Firefox and WebKit, verifies
status/button/sidebar text contrast, focus and hover colors, drawer/field surfaces,
unchanged error/warning/success semantics, overflow and zero Demo network writes.
It also rejects known legacy-blue computed colors on visible migrated elements.
The existing navigation test changes only its two expected palette values.

| Check | Result |
| --- | --- |
| `npm test` | 204 passed |
| `npm run test:audit` | 30 passed |
| Version B + navigation, Chromium/Firefox/WebKit | 24 passed |
| Existing Dashboard + selection, Chromium/Firefox/WebKit | 96 passed |
| Authentication UI | 12 passed |
| `npm run lint`, `npm run build`, `git diff --check` | Passed |
| Color-only source preservation | 978 non-color declarations unchanged; all other `src/` files unchanged |
| Rendered preservation | 12 matched states; geometry, typography and motion unchanged |

```powershell
npm run test:audit-ui -- palette-version-b.spec.js navigation-shell.spec.js --workers=1
npm run test:audit-ui -- dashboard-ui2.spec.js dashboard-selection.spec.js --workers=1
npm run test:auth-ui
```

An initial source-faithful run stopped at the two sidebar contrast failures above.
Those were corrected, not suppressed. Only completed passing final runs are counted.

## Initial Implementation Verification

The following evidence belongs to the accepted `f5314af` implementation before the
color-only follow-up, including successful CI
[39008897447](https://github.com/YijunYuan-Work/ApplyTrack/actions/runs/39008897447).
The 99-case CRUD run below was not rerun for this palette change; its application
code is byte-unchanged. Current follow-up results are above.

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
