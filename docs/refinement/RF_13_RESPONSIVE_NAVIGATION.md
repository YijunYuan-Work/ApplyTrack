# RF-13: Responsive Navigation and Sign Out

Status: In Progress; local implementation, pending independent PR review/release.
Baseline: main `8e72507a3345ee7819960ad76f7baaaf1894da85` (RF-12 F08, PR #25).
Review PR: pending creation.

## Findings and Fix

F11/CQ05: the theme's compact shell hides the sidebar through 900px, but the
Profile exit was enabled only through 720px. At 721-900px both exits were hidden.
The earlier max-900 top-sidebar rules also tried to style navigation and hide its
footer while later phone/tablet layers hid the entire sidebar. Those superseded
rules made ownership harder to follow without providing visible behavior.

- One max-900 rule now owns sidebar hiding and the existing Profile Sign Out
  control's display. Above that breakpoint the desktop sidebar exit is retained.
  Compact users use the existing Profile navigation item to reach Sign Out; no new
  header action, navigation item, authentication handler or duplicate exit is added.
- Reuse the existing full-width, 48px Profile control and compact navigation focus
  ring. Focus styling now applies to tablet navigation too, not just phones.
- Remove the superseded compact top-sidebar declarations and duplicate hiding
  rules. Keep unrelated desktop/base declarations intact; `src/App.css` is unchanged.
- Tablet presentation uses `720px < width <= 900px`, removing the fractional gap
  between max-720 and min-721. Tests use actual `matchMedia` results rather than
  assuming rounded `innerWidth` or a requested integer selects a particular mode.
- The theme's desktop queries now use `width > 900px` (retaining their existing
  upper bounds), exactly complementing max-900. Firefox reproduced visual widths
  900.133px and 900.850px at requested 900/901px: max-900 and min-901 were both false,
  leaving 38px fallback navigation targets and exposing the old sidebar Add action.
  Continuous queries restore the already-designed desktop rules there rather than
  adding fallback-specific styles. Integer-width Chromium/WebKit appearance is unchanged.

Application layout/Profile JSX, routing, password updates, session handling and
Real/Demo mutations are source-identical to the baseline. Demo exposes no account
Sign Out and its navigation remains local.

## Calendar Investigation

The baseline browser reproduced internal clipping, which document-level overflow
checks alone missed. At 768px, the panel was 684px wide but its calendar grid and
toolbar were 760px wide; Next extended to x=802 beyond the panel's right edge x=726.
`src/App.css` gives the desktop calendar a 760px minimum. The theme switches the
compact grid to one column, but previously removed that minimum only at max-640.
An implicit parent grid track then expanded the toolbar as well.

The narrow correction keeps the existing compact weekly list through 900px:
reset its minimum to zero and hide the desktop-only weekday heading row there.
Give the parent one `minmax(0, 1fr)` track so the desktop grid cannot expand the
toolbar. After the fix, the 768px panel/grid/toolbar are all 684px; Next ends at
x=726. No Calendar JSX, dates, metrics, colors, or new layout design changed.

Above 900px, the existing seven-column grid and its intentional narrow-desktop
horizontal scrolling remain. The toolbar stays within the panel (also verified at
901px), so navigation is no longer clipped by that wider grid. No material redesign
was needed or undertaken.

## Verification

All browser fixtures use synthetic data and intercept non-local requests. No
production account, database, or ingestion endpoint is exercised. Artifacts stay
Git-ignored in `tmp/rf13.local/` and `test-results/` inside the authorized workspace.

- Replaced the F11 known-bug characterization with an exactly-one-visible-exit
  regression at 390, 720, 721, 768, 898, 900, 901 and 1440px.
- Added 21 focused cases: navigation across Dashboard/Profile/Progress/Job Agent/
  Import, actual keyboard Tab/Shift+Tab and Enter, visible focus, successful logout,
  unchanged user metadata/records, 44px relevant targets, navigation hit-testing and
  non-overlap, live resize, fractional iframe viewports, Demo and Calendar geometry.
- Fractional probes cover 719.5, 720.5, 899.5 and 900.5 CSS pixels; attach measured
  media-query/visual viewport evidence, accommodating each engine's rounding.
- Calendar coverage tests Next/Previous keyboard functionality and reversible
  navigation, compact content bounds/internal scroll width and document overflow.
- Baseline/after Chromium PNG hashes match exactly for mobile (390px) and desktop
  (1440px) Dashboard and desktop Profile. These are sampled presentation-preservation
  comparisons, not a claim that every page/state was pixel-diffed. Tablet changes
  are the intended Sign Out restoration and Calendar sizing repair.
- Unit tests: 60 passed; isolated source/Edge audits: 28 passed. Lint/build passed.
- `npm run test:audit-ui -- responsive-navigation.spec.js progress-analytics.spec.js
  --project chromium --project firefox --project webkit`: 84 passed (28 per browser,
  21 RF-13 and 7 G03). No automatic retries.
- `npm run test:audit-ui -- --project chromium`: 192 passed, including prior
  RF-07/08/09/10/11/12 preservation regressions and the corrected F11 case.
- Desktop/tablet Sign Out focus and tablet Calendar screenshots were visually
  inspected against the existing design. Final source checks confirm no changes
  outside the scoped theme, regression tests and refinement documentation.
- `npm run test:auth-ui`: 12 passed, including password updates/Sign Out at
  desktop/tablet/phone widths and supported legacy recovery links.
- `npm run lint`, `npm run build` and `git diff --check`: passed.

Final browser gates used no automatic retries. Vite emitted nonfatal EBUSY warnings
watching workspace-local Firefox profile locks; the corresponding tests passed.

Initial diagnostic probes were corrected to wait for Profile routing before taking
measurements. The first new test run successfully signed out but asserted an
incorrect old Sign In heading; the assertion now uses the existing actual heading.
Tests were not removed or weakened, and no authentication code changed.
The first all-browser run passed 80 cases and caught four Firefox fractional-boundary
failures. Independent browser measurements confirmed the real media-query gap;
the theme queries were corrected, retaining the 44px assertions.

## RF-12 Closure and Boundaries

RF-12 is formally closed in the Master Plan/report: G03 PR #24, F08 PR #25,
authorized production migration `20261014033558`, F08 squash SHA above, successful
merged-main CI `38513271988`, and Vercel Production READY deployment
`dpl_E9AcyAUnAFh9sdLoRJNmRraWn9jg`. CI/deployment metadata were rechecked read-only;
completed functional acceptance is reported by the user. The prior migration
verification is recorded as prior release evidence, not rerun in RF-13.

No Supabase production operation, migration, Edge Function change, new dependency,
integration toggle, manual deployment or merge is part of RF-13. Supabase automatic
production synchronization stays OFF. PR review and normal release remain separate.

## Remaining Limitations

- Emulated browser viewports are not physical-device, screen-reader or OS text-scale
  certification. No blanket accessibility certification is claimed.
- Compact Sign Out remains in Profile, preserving the existing mobile pattern.
- Narrow desktop Calendar horizontal scrolling is retained, not redesigned.
- Unrelated historical CSS layers remain; this is bounded ownership cleanup, not a
  full stylesheet consolidation. RF-12 data/client limitations and other audit findings
  remain separately documented and are not silently closed by RF-13.
