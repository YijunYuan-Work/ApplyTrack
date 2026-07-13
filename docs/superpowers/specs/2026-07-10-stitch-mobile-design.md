# ApplyTrack Stitch Mobile Integration Design

Date: 2026-07-10
Status: Approved design direction

## Goal

Recreate the phone experience from `applytrack-mobile` inside the production ApplyTrack app while preserving ApplyTrack's real data, routes, authentication, forms, and application workflows. The Stitch project is the visual reference only.

The new design applies only at viewport widths of `720px` and below. Tablet and desktop layouts above `720px` must remain visually and behaviorally unchanged.

## Source Of Truth

Visual reference:

- `applytrack-mobile/src/App.tsx`
- `applytrack-mobile/src/components/AppHeader.tsx`
- `applytrack-mobile/src/components/AppNav.tsx`
- `applytrack-mobile/src/components/DashboardView.tsx`
- `applytrack-mobile/src/components/ProfileView.tsx`
- `applytrack-mobile/src/components/ProgressView.tsx`
- `applytrack-mobile/src/components/ImportView.tsx`
- `applytrack-mobile/src/index.css`

Production behavior and content remain owned by the existing JavaScript app under `src/`. Mock data, local storage, hard-coded dates, fake notifications, and duplicate forms from `applytrack-mobile` will not be copied.

## Responsive Boundary

- Phone design: `max-width: 720px`.
- Existing tablet and desktop design: `min-width: 721px`.
- Existing laptop, tablet, and desktop media rules must not be changed unless a selector currently leaks into the phone range and must be isolated.
- Phone pages must fit a `390px` viewport without document-level horizontal scrolling.
- Mobile touch targets must be at least `44px` in either height or effective tap area.

## Architecture

The production app will continue using its current hash router, Supabase data layer, route pages, and shared application components. Mobile presentation will be introduced through the existing component tree instead of mounting a separate React application.

`AppLayout` will own the shared mobile shell because it already receives the active page and navigation handlers. It will render:

- A compact fixed top app bar with the ApplyTrack brand.
- A fixed bottom navigation with Dashboard, Profile, Progress, and Import.
- The existing desktop sidebar, hidden only in the phone range.
- The existing page content between the two fixed mobile bars.

The bottom navigation buttons will call the existing navigation callbacks. The current route remains the single source of truth for the active tab and `aria-current` state.

## Mobile Visual System

The mobile implementation will closely follow the Stitch reference:

- White fixed bars with subtle borders and shadows.
- Light blue-gray page canvas.
- Compact blue ApplyTrack brand treatment.
- Rounded white content cards with restrained shadows.
- Blue primary actions and status-specific blue, orange, green, and red accents.
- Two-column summary grids where the reference uses compact metrics.
- Single-column content cards and forms.
- Lucide icons already available in the production app.

The production app's current font stack and light-only theme remain in use. No new dark theme, animation dependency, remote logo image, or asset host will be introduced.

## Mobile Shell

### Top App Bar

The phone header will be fixed to the top and `56px` high. It will show the existing `A` brand mark and ApplyTrack wordmark. The reference notification control will be omitted because the production app has no notification feature.

### Bottom Navigation

The phone navigation will be fixed to the bottom and `64px` high. It will contain four equal navigation targets:

- Dashboard
- Profile
- Progress
- Import

The active destination will use the reference's soft blue pill treatment. Inactive destinations will use muted text and icons. Sign out remains available from the Profile page rather than occupying a fifth bottom-navigation item.

### Content Area

Phone content will include top and bottom safe spacing so it cannot sit underneath either fixed bar. All pages will use a centered content width with `16px` horizontal padding and no artificial phone frame or desktop shadow.

## Dashboard Mapping

The dashboard will use the Stitch hierarchy with ApplyTrack content:

1. Page heading: `Your application flow.`
2. Supporting text describing the user's job-search pipeline.
3. A two-column metric grid.
4. Mobile application controls.
5. A single-column application feed.

### Metrics

The four mobile metrics will use the production calculations:

- Total applications
- Interviews
- Offers
- Rejected

Metric cards remain informative rather than becoming new filters unless the current dashboard behavior already supports the interaction cleanly.

### Controls

The mobile controls will retain the existing functionality:

- Board and List view switching.
- Search by company, role, or notes.
- Status filter.
- Sort by applied date or last updated date.
- Add application.
- Multi-select when List view is active.

Controls will be arranged vertically or in compact two-column rows instead of shrinking the desktop toolbar. Labels and selected values must remain readable.

### Application Feed

Board view remains the default. On phone, board stages use the existing active-stage pattern so one status is visible at a time. The stage selector is horizontally scrollable without creating document overflow.

Cards will adopt the Stitch single-column spacing and visual weight while showing ApplyTrack fields:

- Company initial
- Company name
- Job title
- Status badge
- Applied date
- Last updated date
- Open action when a job URL exists
- Edit action

Long company names and roles wrap naturally, and card height grows with the content. No field may overlap the action row.

List view will keep its existing data and selection behavior but use the same phone card rhythm and spacing.

## Profile Mapping

The Profile route will follow the Stitch single-column account layout while retaining the production fields and actions:

- User identity heading.
- Existing name and recovery email fields.
- Existing password controls.
- Save/update actions.
- Sign out as a full-width secondary account action near the bottom.

The generated avatar picker and mock profile persistence will not be copied unless equivalent production behavior already exists.

## Progress Mapping

The Progress route will use the Stitch compact analytics composition while preserving the production calculations and views:

- Two-column summary metrics.
- Existing pipeline visualization in a rounded white panel.
- Existing calendar/weekly application data in a phone-friendly single-column layout.
- Existing status labels and accessible chart descriptions.

The Stitch hard-coded weekly bars, goals, and mock dates will not be copied.

## Import Mapping

The Import route will follow the Stitch visual hierarchy while retaining the production Excel importer:

- Compact page heading.
- Prominent upload area.
- Existing file requirements and practical error messages.
- Existing parsed preview and row selection.
- Existing import action and success state.

No fake parser, artificial delay, or hard-coded preview rows will be introduced.

## Forms And Secondary Routes

Application add/edit, sign-in, setup, and reset-password routes will receive compatible phone spacing, card radii, control heights, and fixed-shell clearance. Their data behavior and field sets remain unchanged.

Primary form actions stay reachable without horizontal scrolling. Destructive actions retain confirmation behavior and accessible labels.

## State And Data Flow

- Supabase and the existing API helpers remain the only production persistence layer.
- `App.jsx` and the hash route remain the navigation source of truth.
- Page components keep their existing loading, error, and empty states.
- Mobile components receive current callbacks and data through existing props.
- No viewport value will be stored as application state solely to choose desktop versus mobile markup when CSS can handle presentation.
- `AppLayout` will render separate desktop-sidebar and mobile-bar navigation structures, with CSS controlling visibility at the `720px` boundary. Both structures call the same navigation callbacks.

## Accessibility

- Bottom navigation uses semantic buttons and `aria-current="page"`.
- Fixed bars do not hide focused controls or page headings.
- Touch targets are at least `44px`.
- Focus indicators remain visible.
- Status is communicated with text as well as color.
- Long text wraps without clipping.
- Reduced-motion preferences remain respected; the Motion dependency from the Stitch project will not be added.

## Error And Empty States

Existing production error messages remain authoritative. Their phone presentation will use full-width inline panels with readable wrapping.

Empty dashboard states provide an Add application action. Empty board stages retain their current meaning. Import failures remain practical and non-technical. The UI must not imply that mock data was successfully saved.

## Implementation Boundaries

The implementation is expected to touch only the production files that need mobile structure or styling, selected from:

- `src/components/AppLayout.jsx`
- `src/pages/DashboardPage.jsx`
- `src/components/ApplicationBoard.jsx`
- `src/components/ApplicationList.jsx`
- `src/components/ApplicationCard.jsx`
- `src/pages/ProfilePage.jsx`
- `src/pages/ProgressPage.jsx`
- `src/components/ExcelImportPanel.jsx`
- `src/styles/theme.css`
- `DESIGN.md`

Component edits should be limited to mobile structure and reusable class hooks. Most visual changes belong in the final mobile section of `src/styles/theme.css` so the cascade cannot alter tablet or desktop layouts.

The `applytrack-mobile` folder remains an unmodified reference and is not imported by the production bundle.

## Verification

Before completion:

- Run `npm run lint`.
- Run `npm run build`.
- Run `git diff --check`.
- Verify Dashboard, Profile, Progress, Import, add/edit form, sign-in, setup, and reset-password routes at `390 x 844`.
- Verify no document-level horizontal overflow on those routes.
- Verify fixed header and bottom navigation do not cover content or primary actions.
- Verify long company names and job titles expand card height.
- Verify route navigation, search, status filtering, sorting, Board/List switching, add/edit, import, and sign out.
- Smoke-check `768px`, small laptop, and desktop viewports to confirm their current layouts are unchanged.
- Compare the rendered `390 x 844` views against the Stitch reference and record the result in `design-qa.md`.

## Success Criteria

The work is complete when a phone user sees the Stitch-inspired mobile shell and page composition populated by real ApplyTrack content and can complete the existing core workflows, while tablet and desktop users see no layout regression.
