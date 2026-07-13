# Stitch Mobile Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate the Stitch-generated phone experience in the production ApplyTrack app at viewport widths of `720px` and below while leaving all layouts above `720px` unchanged.

**Architecture:** Keep the current hash router, Supabase persistence, route pages, and application components. Add a mobile-only top app bar and bottom navigation to `AppLayout`, expose a few semantic mobile class hooks in existing pages, and place the visual implementation in one final `@media (max-width: 720px)` section in `src/styles/theme.css`. The untracked `applytrack-mobile` project remains an unmodified visual reference and is never imported by production code.

**Tech Stack:** React 19, Vite, JavaScript JSX, CSS media queries, Lucide React, Recharts, Supabase.

## Global Constraints

- The Stitch design applies only at `max-width: 720px`.
- Existing tablet and desktop layouts at `min-width: 721px` must remain visually and behaviorally unchanged.
- Use ApplyTrack's real Supabase data, routes, forms, imports, and calculations.
- Do not copy Stitch mock data, local storage, hard-coded dates, fake notifications, Motion dependency, or remote logo.
- Phone verification viewport is `390 x 844`; there must be no document-level horizontal overflow.
- Mobile touch targets must have at least `44px` effective height or tap area.
- `applytrack-mobile/` is read-only reference material and must not be imported or modified.

---

## File Structure

- Modify `src/components/AppLayout.jsx`: render production mobile top and bottom navigation using existing callbacks and current-page state.
- Modify `src/pages/DashboardPage.jsx`: add mobile copy/class hooks without duplicating dashboard state or data processing.
- Modify `src/components/MetricGrid.jsx`: expose accessible metric classes used by the phone bento grid.
- Modify `src/components/ApplicationBoard.jsx`: preserve behavior and add mobile feed hooks only if existing class names are insufficient.
- Modify `src/components/ApplicationCard.jsx`: preserve list behavior and add mobile feed hooks only if existing class names are insufficient.
- Modify `src/pages/ProfilePage.jsx`: add a mobile account action for sign out because the desktop sidebar is hidden on phones.
- Modify `src/styles/theme.css`: append the complete phone shell and page styling under one `max-width: 720px` boundary.
- Modify `DESIGN.md`: document the mobile Stitch source of truth and exact breakpoint.
- Modify `design-qa.md`: record same-viewport comparison and responsive checks.

### Task 1: Production Mobile Shell

**Files:**
- Modify: `src/components/AppLayout.jsx`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: existing `currentPage`, `onDashboard`, `onProfile`, `onProgress`, and `onImportExcel` props.
- Produces: `.mobile-app-bar`, `.mobile-bottom-nav`, and `.mobile-nav-item` elements for every authenticated route using `AppLayout`.

- [ ] **Step 1: Capture the failing shell state**

Run the current app at `390 x 844` and record that the phone page does not yet have `.mobile-app-bar` or `.mobile-bottom-nav`.

Expected before implementation:

```js
({
  topBar: document.querySelector('.mobile-app-bar'),
  bottomNav: document.querySelector('.mobile-bottom-nav'),
})
// { topBar: null, bottomNav: null }
```

- [ ] **Step 2: Add shared mobile navigation metadata and markup**

Update `AppLayout.jsx` to reuse the existing navigation definitions and render the following siblings around the existing sidebar/content:

```jsx
<header className="mobile-app-bar">
  <div className="mobile-brand-lockup" aria-label="ApplyTrack">
    <span className="mobile-brand-mark" aria-hidden="true">A</span>
    <span>ApplyTrack</span>
  </div>
</header>

<nav className="mobile-bottom-nav" aria-label="Mobile navigation">
  {navItems.map((item) => {
    const Icon = navIcons[item.key]
    const isActive = currentPage === item.key

    return (
      <button
        aria-current={isActive ? 'page' : undefined}
        className={`mobile-nav-item ${isActive ? 'mobile-nav-item-active' : ''}`}
        key={item.key}
        type="button"
        onClick={item.onClick}
      >
        <Icon aria-hidden="true" size={20} />
        <span>{item.key === 'import' ? 'Import' : item.label}</span>
      </button>
    )
  })}
</nav>
```

Keep the existing `<aside className="sidebar">` and `<section className="app-content">` markup unchanged for desktop.

- [ ] **Step 3: Add shell visibility and fixed positioning**

Add default hidden styles outside media queries:

```css
.mobile-app-bar,
.mobile-bottom-nav {
  display: none;
}
```

Append a final phone block to `theme.css`:

```css
@media (max-width: 720px) {
  .app-layout {
    display: block;
    min-height: 100svh;
    background: #f7f9fc;
  }

  .sidebar {
    display: none;
  }

  .mobile-app-bar {
    position: fixed;
    z-index: 60;
    top: 0;
    right: 0;
    left: 0;
    display: flex;
    align-items: center;
    height: 56px;
    padding: 0 16px;
    border-bottom: 1px solid #dbe5f0;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 2px 10px rgba(7, 26, 57, 0.05);
  }

  .mobile-bottom-nav {
    position: fixed;
    z-index: 60;
    right: 0;
    bottom: 0;
    left: 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    min-height: 64px;
    padding: 5px max(8px, env(safe-area-inset-right)) max(5px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
    border-top: 1px solid #dbe5f0;
    background: rgba(255, 255, 255, 0.97);
    box-shadow: 0 -4px 16px rgba(7, 26, 57, 0.07);
  }

  .app-content {
    width: 100%;
    min-width: 0;
    padding: 72px 16px calc(84px + env(safe-area-inset-bottom));
  }
}
```

- [ ] **Step 4: Verify shell behavior**

At `390 x 844`, confirm both mobile bars are visible, each bottom item has at least a `44px` tap area, the active route has `aria-current="page"`, and `document.documentElement.scrollWidth === document.documentElement.clientWidth`.

At `768px`, confirm both mobile bars compute to `display: none` and the existing tablet navigation remains visible.

- [ ] **Step 5: Commit the shell**

```powershell
git add src/components/AppLayout.jsx src/styles/theme.css
git commit -m "feat: add mobile application shell"
```

### Task 2: Stitch-Style Mobile Dashboard

**Files:**
- Modify: `src/pages/DashboardPage.jsx`
- Modify: `src/components/MetricGrid.jsx`
- Modify: `src/components/ApplicationBoard.jsx`
- Modify: `src/components/ApplicationCard.jsx`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: existing dashboard state (`viewMode`, `statusFilter`, `sortBy`, `activeBoardStatus`, `searchTerm`) and existing application callbacks.
- Produces: the same dashboard functionality in a Stitch-style phone hierarchy without new persistence or route state.

- [ ] **Step 1: Capture dashboard failures at 390px**

Record the current phone screenshot and check for clipped toolbar labels, document overflow, covered content, and cards whose action rows overlap long company or role text.

Expected failing conditions before the redesign: the layout does not visually match the Stitch reference and the old mobile sidebar/top navigation remains present.

- [ ] **Step 2: Add mobile dashboard copy hooks**

Keep the desktop heading intact and add mobile-only copy inside the same header:

```jsx
<div>
  <p className="eyebrow desktop-dashboard-copy">Job application track dashboard</p>
  <h1 className="desktop-dashboard-copy">Applications that need your attention</h1>
  <p className="mobile-dashboard-copy mobile-dashboard-title">Your application flow.</p>
  <p className="mobile-dashboard-copy mobile-dashboard-subtitle">
    Real-time tracking of your career journey.
  </p>
</div>
```

Default `.mobile-dashboard-copy` to `display: none`, then switch visibility only inside `max-width: 720px`.

- [ ] **Step 3: Style the metric bento grid**

At phone width, set `.dashboard-workspace .metric-grid` to a stable two-column grid with `12px` gaps. Cards use `min-height: 132px`, `16px` padding, `12px` radius, white background, and status-colored icon tiles. Remove desktop accent-line positioning that conflicts with the compact layout while retaining text labels and numbers.

Use the existing production metrics in this order: Total applications, Interviews, Offers, Rejected.

- [ ] **Step 4: Recompose mobile controls**

Inside the phone media query:

```css
.dashboard-workspace .tracker-section {
  gap: 18px;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.dashboard-workspace .tracker-control-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
}

.dashboard-workspace .view-toggle {
  width: 100%;
  min-height: 44px;
}

.dashboard-workspace .toolbar {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.dashboard-workspace .toolbar-search {
  grid-column: 1 / -1;
}
```

Status and Sort controls must show their labels and selected values without ellipsis. The Add application action remains a full-width primary action near the dashboard heading. The Select action remains available in List view.

- [ ] **Step 5: Style the active-stage board as a mobile feed**

Keep the existing board state and filtering. On phone:

- Keep `.board-stage-tabs` horizontally scrollable with `44px` buttons.
- Display only `.board-column.active`.
- Remove fixed/max heights from the active column and card list.
- Make `.board-card-list` overflow visible so the document owns vertical scrolling.
- Give cards `16px` padding, `12px` radius, and content-driven height.
- Preserve company, role, status, Applied, Last updated, Open, and Edit.
- Allow company and role to wrap with `overflow-wrap: anywhere` and no line clamp.

- [ ] **Step 6: Style List view consistently**

At phone width, ensure `.application-card` is single-column, content-height, and uses the same white-card rhythm as board cards. Selection controls remain keyboard and touch accessible. Pagination bars stack without horizontal overflow.

- [ ] **Step 7: Verify dashboard interactions**

At `390 x 844`:

- Board is the default and Status is All.
- Switching to List works.
- Selecting a status switches to List.
- Switching back to Board resets Status to All.
- Search and Sort remain functional.
- Board stage buttons show the correct applications.
- Add application and Edit navigate to the existing routes.
- Long company and role text grows the card without overlap.
- Horizontal overflow is `0px`.

At `768px`, `1024px`, and desktop, compare screenshots with the pre-change state and confirm unchanged layout.

- [ ] **Step 8: Commit the dashboard**

```powershell
git add src/pages/DashboardPage.jsx src/components/MetricGrid.jsx src/components/ApplicationBoard.jsx src/components/ApplicationCard.jsx src/styles/theme.css
git commit -m "feat: adapt dashboard for mobile"
```

### Task 3: Profile, Progress, Import, And Forms

**Files:**
- Modify: `src/pages/ProfilePage.jsx`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: existing page markup, form handlers, progress data, Excel parser, and `onSignOut` callback.
- Produces: Stitch-style single-column phone layouts while preserving all production behavior.

- [ ] **Step 1: Add a mobile Profile sign-out action**

Append the following inside `.profile-section` after the settings grid:

```jsx
<button
  className="mobile-profile-sign-out ghost-button"
  type="button"
  onClick={onSignOut}
>
  Sign out
</button>
```

Default it to hidden and display it as a full-width `48px` account action only at `max-width: 720px`.

- [ ] **Step 2: Style Profile for phone**

Use the Stitch order and spacing: compact heading, username identity card, recovery card, password card, then sign out. Set `.profile-settings-grid` to one column, cards to `16px` padding and `12px` radius, fields/buttons to at least `44px`, and messages to wrap.

- [ ] **Step 3: Style Progress for phone**

Keep the existing Recharts data and calendar calculations. Use a two-column `.progress-summary`, white rounded `.progress-chart-panel`, full-width two-segment `.progress-tabs`, compact Sankey container, stacked calendar toolbar, hidden weekday header row, and single-column calendar days. Do not add Stitch goals or hard-coded bars.

- [ ] **Step 4: Style Import for phone**

Keep `ExcelImportPanel` behavior unchanged. Use a compact heading, `16px` rounded upload surface, full-width file control and actions, one-column preview rows, and wrapping file/error text. Preserve row selection and imported application count.

- [ ] **Step 5: Style application and authentication forms**

At phone width, make `.application-form`, `.auth-panel`, and related panels single-column with `16px` padding, `12px` radius, `44px` controls, stacked action buttons, and fixed-shell clearance. Setup and sign-in screens that do not use `AppLayout` must not receive unnecessary bottom-navigation spacing.

- [ ] **Step 6: Verify secondary routes**

At `390 x 844`, verify Profile, Progress map, Progress calendar, Import, add form, edit form, sign-in, setup, and reset-password views. Confirm no horizontal overflow, no fixed-bar overlap, readable long text, working tabs/forms, and visible focus indicators.

At `768px`, verify the existing tablet layout remains unchanged and `.mobile-profile-sign-out` is hidden.

- [ ] **Step 7: Commit secondary pages**

```powershell
git add src/pages/ProfilePage.jsx src/styles/theme.css
git commit -m "feat: style mobile workspace pages"
```

### Task 4: Documentation And Final QA

**Files:**
- Modify: `DESIGN.md`
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: final rendered app and the Stitch reference project.
- Produces: current design documentation and a passed visual/responsive QA record.

- [ ] **Step 1: Update design documentation**

Add a `Mobile Source Of Truth` section to `DESIGN.md` documenting:

```markdown
## Mobile Source Of Truth

At viewport widths of `720px` and below, the production UI follows the
Stitch reference in `applytrack-mobile/`. The production app retains its
existing routes, Supabase data, forms, imports, and calculations. Layouts at
`721px` and above retain the approved desktop/tablet design.
```

Update older Tablet and Phone language that says the sidebar becomes top navigation; phone navigation is now the fixed bottom bar, while tablet remains unchanged.

- [ ] **Step 2: Run code verification**

Run:

```powershell
npm run lint
npm run build
git diff --check
```

Expected: lint exits `0`, Vite production build exits `0`, and diff check reports no whitespace errors.

- [ ] **Step 3: Run visual comparison**

Capture the Stitch reference and production app at `390 x 844`. Compare top bar, bottom navigation, page padding, metric grid, card radius, control sizing, color, typography, and content flow side by side. Fix all P0, P1, and P2 mismatches.

- [ ] **Step 4: Record design QA**

Update `design-qa.md` with the reference paths, tested routes/viewports, interaction results, overflow measurements, remaining P3 differences, and exact final line:

```markdown
final result: passed
```

- [ ] **Step 5: Final regression check**

Recheck `390 x 844`, `768 x 900`, `1024 x 768`, and the default desktop viewport after all fixes. Confirm the production app is served from the correct ApplyTrack dev server rather than a stale project on the same port.

- [ ] **Step 6: Commit documentation and QA**

```powershell
git add DESIGN.md design-qa.md
git commit -m "docs: document mobile design and QA"
```
