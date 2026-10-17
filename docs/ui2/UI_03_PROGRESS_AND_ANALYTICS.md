# UI-03: Progress and Analytics

Status: implementation and local verification complete.
Independent ChatGPT review and user visual acceptance remain required. No merge or
production deployment is authorized by this report.

## Authority

- Base: latest main `3551363d0c578beea1ffc98cb89a77fa1b4dd34c` (UI-02 PR #30).
- Required merged-main [CI 39049015751](https://github.com/YijunYuan-Work/ApplyTrack/actions/runs/39049015751)
  independently verified **completed / success** before branch creation.
- Branch: `codex/ui2-progress-analytics`.
- Canonical: unchanged `UI_update` at `c3a18b349adff6ed54e4608cd11dd2bde3fa3bed`,
  `new_design/ApplyTrack Version B - Teal Terracotta.html`. Actual Progress markup,
  responsive values, Sankey construction, Calendar, weekly buckets, conversion
  definitions and motion logic were inspected. The exported reference used for
  screenshots was byte-verified against that Git artifact.

## Implementation

Progress reuses the existing Version B tokens, bundled Figtree/JetBrains Mono and
navigation shell. The page has a dark primary metric, three supporting metrics,
sliding Map/Calendar switch, flow legend, weekly activity and conversion indicators.
`progress.css` owns this presentation; no other page interior is migrated.

The existing metric counter is reused through a named component export; its body,
600ms timing, canonical accessible label and reduced-motion handling are unchanged.
Nodes reveal progressively, links fade, bars grow from their real dimensions and
Calendar days reveal on week changes. Global reduced-motion overrides remain in
force. There is no artificial loading or optimistic success state.

Recharts remains responsible for layout, proportional node heights and ribbon
widths. Small custom node/link renderers supply semantic colors, readable labels,
keyboard focus and an actual-value inspection caption shared with hover. Left
alignment keeps first-stage terminal outcomes in the middle column. Existing
branch order is preserved; no duplicate graph engine or chart dependency was added.
The outer flow is an accessible group, not an opaque image hiding focusable
branches. Inspection stores branch identity and derives its count from current
canonical data, including an outstanding deletion completing on this page.

Map switches to six explicit stage bars below 640px. Desktop begins at 1040px;
tablet is 640-1039px. Calendar uses seven/four/one columns respectively, without
a minimum-width scrolling grid. Arrows remain reachable at 44px on tablet/phone.
The mobile three-event day preview, expansion, week total and day counts remain.
Both controlled panel IDs exist while inactive content is not rendered; this
also resolves the old Progress `aria-controls` accessibility observation.

## Analytical Contracts

`buildProgressData`, date parsing, week arithmetic and Calendar event construction
retain their exact calculation bodies. Only chart color assignments changed.
API mapping, RF-07/RF-08 reconciliation, rejection persistence, Demo mutations,
Supabase, dependencies and shared foundation/shell files have no diff.

| Display | Preserved definition |
| --- | --- |
| Applications | All tracker applications, even if undated |
| Interviews held | Sum of finite nonnegative recorded interview rounds |
| Reached interview | Recorded rounds > 0, or current Interview/Offer stage |
| Offers | Current Offer applications within the reached-interview branch |
| Rejected before interview | Current Rejected applications outside that branch |
| Rejected after interview | Current Rejected applications inside that branch |
| Still in progress | The remaining reached-interview applications, not all pending applications |
| No interview yet | Remaining applications outside the reached-interview/rejected-before branches |

Mobile stage bars are **not a mutually exclusive distribution**: the first stage
and its downstream outcomes overlap, as in the prototype. Each percentage uses
all applications as denominator. They are never added into a stacked 100% total.
The interview-round summary accent saturates at 100%; it is not a conversion rate.
Actual round count and application-based interview conversion remain separate.

Three conversion rows derive only from the conserved graph/summary:

- Applied to interview: reached-interview applications / all applications.
- Interview to offer: offers / reached-interview applications.
- Interview or decision: (reached interview + rejected before interview) / all
  applications. This deliberately replaces the prototype's **Response rate**
  label: ApplyTrack does not record every employer response.

Zero denominators display 0%, with zero-width bars. Weekly activity counts valid
**applied dates only**, including multiple applications on one date. Six Sunday
buckets end at the latest valid applied-date week (or local current week if all
dates are unknown); the visible endpoint makes the range explicit. A real zero
week has no painted bar, unlike the prototype's minimum-height zero placeholder.

Calendar includes Applied events and **known valid `rejectedDate` events only**.
It never derives an event from Last Updated, current status, follow-up or an
interview count. Reopened records retain their known rejection event. The original
company/role/type ordering, date-only timezone contract, latest-event initial week,
year/month/leap boundaries and week navigation are unchanged.

## Visual Evidence

Actual Chromium captures use matching CSS widths, 900px height, DPR 1. Only the
reference's outer presentation controls/device bezel are removed. Source has nine
mock records; implementation has the existing six-record Demo. No source sample
records or fixed metrics entered application code. These are design-state
comparisons, not identical-data pixel tests.

| Width | Pipeline Map | Calendar |
| --- | --- | --- |
| 1440px | [Desktop](assets/ui03-map-desktop.png) | [Desktop](assets/ui03-calendar-desktop.png) |
| 768px | [Tablet](assets/ui03-map-tablet.png) | [Tablet](assets/ui03-calendar-tablet.png) |
| 390px | [Phone](assets/ui03-map-mobile.png) | [Phone](assets/ui03-calendar-mobile.png) |

Focused implementation captures: [desktop statistics](assets/ui03-statistics-desktop.png),
[tablet statistics](assets/ui03-statistics-tablet.png),
[phone statistics](assets/ui03-statistics-mobile.png).

Visual iteration corrected summary line-height/rhythm, an excessively tall tablet
canvas, heading colors and unnecessary phone navigation wrapping. The final
comparison retains intentional differences:

- Recharts places the original branches using conserved values; source hand-built
  coordinates and terminal-branch order are not copied. Labels have safe margins,
  rather than reproducing the reference's clipped reached-interview label.
- Tablet labels remain readable (12px minimum), with some extra chart height;
  mobile/tablet tab and arrow targets remain 44px rather than 34/40px.
- Full date ranges retain both years across a boundary; event badges and mobile
  expansion remain. Only reliably dated events are rendered, so default weeks and
  event types intentionally differ from the prototype's inferred history.
- Supporting text uses existing AA-safe tokens, including the primary metric and
  empty Calendar cells, rather than the reference's faint cream/gray. Existing
  heading punctuation and honest Demo identity are retained.

WebKit also caught a real 4.4:1 contrast failure on the hovered day-expansion
button. A Calendar-only darker hover text token corrects it; shared button styles
outside Progress were not changed. Final scoped Axe assertions pass in all three
browsers without excluding that control or disabling the rule.

## CSS Cleanup and Preservation

Removed 120 obsolete Progress selector branches: 45 from `App.css`, 75 from
`theme.css`. Mixed selector groups retain unrelated branches. A PostCSS comparison
verifies all remaining 85/288 rules, declarations and media contexts against the
base. See [cleanup summary](assets/ui03-css-preservation.json). A protected diff
and source comparison also verify unchanged calculations/Calendar helpers,
counter behavior, foundation tokens, shell, Dashboard styles and persistence code.

## Verification

All browser/auth/backend fixtures are synthetic local data; Demo sends no backend
requests. No production endpoint, database or configuration was accessed.

| Check | Result |
| --- | --- |
| `npm test` | 207 passed, including 3 new presentation cases and existing G03/F08 matrix/timezone tests |
| `npm run test:audit` | 30 passed |
| Progress analytics + UI-03, Chromium/Firefox/WebKit | 63 passed (21 per browser), including final accessibility/canonical-inspection corrections |
| Additional historical mutation / shell / Dashboard / Calendar regressions (Chromium) | 70 passed |
| Lint and production build | Passed |
| `git diff --check` | Passed |
| Non-Progress CSS and protected-source checks | Passed |
| Native Chromium accessibility tree | Branch names exposed and Tab focus named correctly; [evidence](assets/ui03-native-accessibility.json) |

The focused suite checks metrics, conserved branch counts and rendered ribbon
widths, zero/sparse datasets, known/unknown rejection dates, multi-event ordering,
expansion, week boundaries, focus/hover captions, final counter values, reduced
motion, a late canonical deletion updating the inspected count, and Real/Demo parity.
Geometry and scoped Axe cover 390, 640, 768, 900,
1039, 1040 and 1440px; live fractional checks include 639.5/640.5/1039.5/1040.5px.
Firefox's effective width can be fractional: expected layout follows its actual
media query, not the rounded requested viewport. Existing numeric/date assertions
remain; only mobile presentation labels/order changed to match Version B.

```powershell
npm test
npm run test:audit
npm run test:audit-ui -- progress-analytics.spec.js progress-ui2.spec.js --workers=1
npm run test:audit-ui -- rejection-dates.spec.js responsive-navigation.spec.js dashboard-ui2.spec.js navigation-shell.spec.js palette-version-b.spec.js --project=chromium --workers=1
npm run lint
npm run build
```

## Boundaries and Limitations

No database migration, historical backfill, Edge Function release, backend-contract
change, production operation or new dependency is required. Supabase synchronization
was not changed/enabled. No manual Preview/production deployment or automatic merge.
Independent review and user acceptance are pending. Physical-device safe areas and
real assistive-technology certification are not claimed by local browser tests.
Profile, Job Agent and Import interiors remain for later phases; whole-application
AA conformance is not asserted.
