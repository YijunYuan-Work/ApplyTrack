# ApplyTrack Design System

Last updated: 2026-07-10
Status: current product UI reference

## Source Of Truth

The current authenticated dashboard follows the approved visual mockup stored at:

`C:\Users\John\.codex\generated_images\019edc73-e978-7122-9bad-39f88264202b\ig_09d2d8fac4b6fe01016a49de871498819491a7e7c98a9eff86.png`

When this document conflicts with older Linear-inspired notes, use this document. The app is a product workspace for job seekers, not a marketing page.

## Mobile Source Of Truth

At viewport widths of `720px` and below, the production UI follows the Stitch
reference in `applytrack-mobile/`. The production app retains its existing hash
routes, Supabase data, forms, imports, and calculations; mock data and local
storage from the reference are not used.

The phone layout uses a fixed 56px ApplyTrack app bar, a fixed four-destination
bottom navigation, two-column summary metrics, and single-column task surfaces.
Layouts at `721px` and above retain the approved tablet and desktop design
described in this document.

## Product Feel

ApplyTrack should feel professional, structured, and active. The UI should make a job search feel manageable without becoming playful or decorative. The current direction is a light, clean workspace with blue action energy, soft status color, and compact dashboard components.

Design goals:

- Keep application data scannable.
- Keep primary actions visible.
- Use familiar app controls: sidebar nav, segmented views, search, select filters, board columns, cards, and icon buttons.
- Avoid landing-page hero treatment inside authenticated views.
- Avoid dense spreadsheet compression on smaller screens.
- Preserve enough breathing room that applying for jobs does not feel visually exhausting.

## Color System

Primary theme:

| Token | Value | Usage |
| --- | --- | --- |
| `canvas` | `#f7fbff` | App background |
| `surface` | `#ffffff` | Sidebar, panels, cards, inputs |
| `surface-soft` | `#f2f6fd` | Active sidebar item and soft control states |
| `border` | `#dbe5f0` | Panels, cards, controls |
| `text-strong` | `#071a39` | Main headings and metric numbers |
| `text` | `#33445d` | Primary body and navigation text |
| `text-muted` | `#647084` | Labels, hints, secondary copy |
| `blue` | `#006bd8` | Brand mark, active nav, Applied status, primary accents |
| `teal-blue` | `#05a9be` | End of primary CTA gradient |
| `orange` | `#f59e0b` | Interview status |
| `green` | `#22a55b` | Offer status and empty offer state |
| `red` | `#ef4444` | Rejected status |

Primary CTA gradient:

```css
linear-gradient(135deg, #0877d9, #05a9be)
```

Status accents:

- Applied: blue text on `#dcecff`.
- Interview: orange text on `#fff0d4`.
- Offer: green text on `#dcf6e7`.
- Rejected: red text on `#ffe5e5`.

ApplyTrack uses a single light theme. Do not add a dark-mode switch or alternate dark layout unless the product direction changes explicitly.

## Typography

Use the existing system stack:

```css
Inter, "SF Pro Display", "SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Desktop dashboard type scale:

| Element | Size | Weight | Notes |
| --- | ---: | ---: | --- |
| Dashboard eyebrow | `0.93rem` | `750` | Blue, sentence case |
| Dashboard H1 | `2.1rem` | `850` | No negative tracking |
| Body copy | `1.03rem` | `400-500` | Muted blue-gray |
| Sidebar brand | `1.58rem` | `900` | Strong product mark |
| Nav item | `1rem` | `650` | Icon plus label |
| Metric label | `1.05rem` | `650` | Sentence case |
| Metric number | `2.15rem` | `850` | Strong dark ink |
| Board column title | `1.2rem` | `850` | Status color |
| Board card company | `0.92rem` | `900` | Uppercase, clamp long names |
| Board card detail | `0.78rem` | `650` | Compact metadata |

Do not use viewport-scaled font sizes. Keep letter spacing at `0` unless a small uppercase label needs subtle spacing.

## Layout

### Desktop Reference

Reference viewport: `1600 x 1024`.

Measured dashboard targets:

| Area | Target |
| --- | --- |
| Sidebar width | `312px` |
| Main content x | `356px` |
| Header y | `31px` |
| Metric grid | `x=356`, `y=153`, `w=1200`, `h=112` |
| Tracker panel | `x=356`, `y=287`, `w=1200`, `h=704` |
| Board columns | `y=376`, `h=604`, four columns |

The header and metric area should sit directly on the page canvas. Do not wrap it in a visible white panel. Metric cards are individual white cards, but the containing overview section is transparent.

### Small Laptop Reference

Reference viewport: around `1440 x 900`.

Requirements:

- No document-level horizontal overflow.
- Header overview area remains transparent.
- Toolbar controls fit without clipping text.
- Board cards stay readable and show the same information types as the mockup.
- Columns may become slightly narrower, but cards must not collapse into unreadable strips.

### Tablet

From `721px` through the existing tablet range:

- Preserve the approved tablet layout and top navigation behavior.
- Keep metric cards, filters, actions, and content panels readable without document-level horizontal overflow.
- Do not apply the Stitch phone shell or bottom navigation.

### Phone

At `720px` and below:

- Hide the desktop/tablet sidebar and show the fixed Stitch-style app bar and bottom navigation.
- Keep 16px page gutters and fixed-bar clearance around all routed content.
- Use two-column summary metrics and single-column content cards.
- Stack or pair filters and actions instead of shrinking labels beyond readable width.
- Show one active board stage at a time while retaining Board and List behavior.
- Keep all touch targets at least `44px` high and prevent document-level horizontal overflow.

## Components

### Sidebar

Desktop sidebar:

- Width: `312px`.
- White background with right border `#dbe3ee`.
- Brand row: blue square `A` mark plus `ApplyTrack` wordmark.
- Workspace row: user workspace label plus chevron.
- Navigation items use Lucide icons and labels.
- Active item uses pale blue background and a blue left rail.
- Account controls are pinned near the bottom in a bordered block with Sign out.

Do not put the primary Add application CTA in the desktop sidebar for this design. The primary CTA belongs in the dashboard header.

### Dashboard Header

Copy:

- Eyebrow: `Job search dashboard`.
- H1: `Applications that need your attention`.
- Supporting copy: `Track applications, interviews, contacts, and follow-ups from one focused workspace.`

Actions:

- Primary: Add application, blue-to-teal gradient.
- Secondary: View progress, white button with border.

Header background must be transparent in the dashboard. The white visual surfaces are the metric cards and tracker panel, not the overview container.

### Metric Cards

Four cards:

- Total applications with briefcase icon.
- Interviews with users icon.
- Offers with trophy icon.
- Rejected with circle-x icon.

Desktop card specs:

- Height: `112px`.
- Border: `1px solid #d9e3ef`.
- Radius: `8px`.
- White background.
- Soft shadow only.
- Status-colored icon tile at `54-60px`.
- Thin accent line along the bottom.

### Tracker Panel

Desktop tracker panel:

- White background.
- Border: `1px solid #dbe5f0`.
- Radius: `8px`.
- Contains toolbar and board.

The tracker panel is the primary framed workspace. Do not nest extra cards around the toolbar or board.

### Toolbar

Toolbar order:

1. Segmented view control: List, Board, Calendar.
2. Search input.
3. Status select.
4. Sort select.
5. Select button.

Use Lucide line icons for the controls. At small laptop width, reduce gaps and control widths before allowing text clipping. On phone/tablet, stack controls.

### Board Columns

Columns:

- Applied: blue.
- Interview: orange.
- Offer: green.
- Rejected: red.

Each column has a colored title, short hint text, and a count pill. Columns should scroll vertically when they contain many applications. Avoid horizontal scrolling inside individual cards.

Column hint text:

- Applied: `Application submitted`.
- Interview: `No applications here` when empty, otherwise `Interviews in progress`.
- Offer: `No offers yet` when empty, otherwise `Offers received`.
- Rejected: `Not moving forward`.

### Board Cards

Cards must show the same information types as the visual mockup:

- Company initial tile.
- Company name.
- Role.
- Status badge.
- Applied date.
- Follow-up date or `Not set`.
- Contact or `Not set`.
- Open action when a job URL exists.
- Edit action.
- More action icon.

At desktop and small laptop widths, cards must not collapse so far that metadata is hidden or clipped. Long company names should clamp or wrap inside the card instead of creating horizontal scroll.

### Empty States

Only the Offer column should show the green empty state from the mockup:

- Icon: briefcase inside a green outlined circle.
- Title: `No offers yet`.
- Copy: `Keep going! Your next opportunity is ahead.`

Do not show this offer empty state in the Interview column or other statuses.

## Interaction

- Board/List segmented control must remain functional.
- Search, Status, Sort, and Select controls must remain functional.
- Add application, View progress, Open, Edit, and Sign out must remain keyboard reachable.
- Focus states must remain visible.
- Do not use icons as decoration only when a text label is needed for clarity.

## Implementation Notes

- Base styles live in `src/App.css`.
- Current theme and responsive overrides live in `src/styles/theme.css`.
- Dashboard structure lives mainly in:
  - `src/pages/DashboardPage.jsx`
  - `src/components/AppLayout.jsx`
  - `src/components/MetricGrid.jsx`
  - `src/components/ApplicationBoard.jsx`
  - `src/components/StatusBadge.jsx`
- Icons come from `lucide-react`.
- Keep future responsive fixes in `src/styles/theme.css` unless the base component structure must change.

## Verification Checklist

Before handing off dashboard UI changes:

- Run `npm run lint`.
- Run `npm run build`.
- Check desktop reference around `1600 x 1024`.
- Check small laptop around `1440 x 900`.
- Check tablet around `768px`.
- Check phone around `390px`.
- Confirm no document-level horizontal overflow.
- Confirm the header overview area has no white container background.
- Confirm the toolbar does not clip labels.
- Confirm board cards show company, role, status, applied date, follow-up, contact, and actions.
- Confirm the offer empty state appears only in the Offer column.

## Current QA Artifact

See `design-qa.md` for the latest measured browser checks and screenshot-comparison notes.
