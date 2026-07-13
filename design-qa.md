# Design QA

Desktop source visual: `C:\Users\John\.codex\generated_images\019edc73-e978-7122-9bad-39f88264202b\ig_09d2d8fac4b6fe01016a49de871498819491a7e7c98a9eff86.png`

Mobile source visual: rendered from `applytrack-mobile/` at `390 x 844`.

Production URLs:

- Authenticated app: `http://localhost:5173/#/dashboard`
- Screenshot-safe sample: `http://127.0.0.1:5173/#/demo`

## Mobile Comparison

- Reference and production were captured at the same `390 x 844` viewport.
- Production matches the Stitch hierarchy: fixed white app bar, compact ApplyTrack brand, light canvas, two-by-two metric grid, single-column pipeline, and fixed four-item bottom navigation.
- Headline scale, page gutters, card spacing, rounded white surfaces, status colors, and active-navigation treatment follow the reference closely.
- Stitch mock metrics were replaced with ApplyTrack's Total applications, Interviews, Offers, and Rejected calculations.
- Stitch's hard-coded Daily Pipeline calendar was replaced with ApplyTrack's functional Board/List, search, status, sort, and selection controls.
- Stitch mock storage, dates, notifications, avatar data, animations, and remote logo were not imported.

## Phone Checks

- `390 x 844`: mobile app bar and bottom navigation visible; no document-level horizontal overflow.
- `430 x 932` (iPhone 15 Pro Max): mobile app bar and bottom navigation visible; no document-level horizontal overflow.
- `720px` boundary: mobile shell visible and sidebar hidden.
- Bottom navigation targets measured `53px` high; active destination exposes `aria-current="page"`.
- Dashboard metrics render as two equal columns.
- Board shows one active stage at a time; all four stage controls fit in one row at both `390px` and `430px` with live counts visible.
- Board/List switching works.
- Choosing Rejected in the status filter switches to List; returning to Board resets status to All.
- Search, status, and sort labels and values remain readable.
- Profile is single-column and includes a `48px` mobile sign-out action.
- Progress uses a two-column summary and full-width `53px` view tabs.
- Import panel measured `358px` inside the `390px` viewport.
- Application form is single-column.
- Sign-in and reset-password panels measured `358px`; sign-in controls are at least `44px` high.
- Live-data check covered 184 visible Applied cards: zero clipped company/title nodes, zero overflowing cards, and zero action-row overlaps.

## Tablet And Desktop Regression

- `721px`: mobile bars hidden, existing tablet navigation visible, and no horizontal overflow.
- `768 x 900`: mobile bars hidden, existing tablet navigation visible, and no horizontal overflow.
- `1024 x 768`: mobile bars hidden, existing laptop sidebar visible, and no horizontal overflow.
- All new visual rules are contained in `@media (max-width: 720px)`; the extra mobile shell elements default to `display: none` above the breakpoint.
- The previously approved desktop dashboard structure remains unchanged.

## Technical Checks

- `npm run lint`: passed.
- `npm run build`: passed after correcting one unmatched CSS block terminator found by the production minifier.
- `git diff --check`: passed with line-ending warnings only.
- Browser console: no warnings or errors during final live-dashboard check.
- Production code does not import from `applytrack-mobile/`.

## Remaining P3 Differences

- The production logo uses the existing ApplyTrack `A` mark instead of Stitch's remote circular image.
- Production content is denser than the mock reference because it preserves the real job-tracking controls and data.

final result: passed
