# RF-11: Dashboard Selection Consistency

Status: In Progress; implementation only, awaiting independent review.
Baseline: `f7f0d98e8910f12b999488ac119038cc64306bd2` (latest origin/main).

## Root Cause and Selection Contract

F09 derived both bulk-toggle membership and its button state from List pagination
even when Board rendered every filtered record. Board also has two actual display
scopes: above 900px all four columns are accessible; at 900px and below the theme
hides all but the active stage. Scroll-clipped cards within a displayed column
remain in that stage's scope, not just the cards intersecting the viewport.

The selection correction is confined to `src/pages/DashboardPage.jsx`:

- List: Select All / Unselect All operate only on the current filtered, sorted
  page, including the existing page-size controls.
- Desktop Board (>900px): operate on all filtered applications.
- Compact Board (<=900px): operate only on filtered applications in the active
  stage. Invalid-status fallback matches the Board's existing Applied grouping.
- A matchMedia change listener follows the same CSS breakpoint during resizing;
  it cleans up on unmount. No card or navigation redesign.
- One derived ID scope drives the button label, enabled state and toggle.
  The functional state updater evaluates the latest selection before toggling.
  Selections are deduplicated; unselecting a scope keeps selected IDs elsewhere.
- The global selected count includes valid selected records hidden by another
  page, filter or stage. View/search/filter/sort/size/stage changes do not silently
  clear these selections. Clear or Exit multi-select intentionally clears all.
  Exit remains available when a search empties the view, avoiding a trapped mode.
- Existing RF-09 canonical-ID intersection excludes confirmed-deleted records.
  Status edits retain record identity even if the selected record changes stage.
  Bulk deletion continues to use the entire current selection, not just the
  current scope, with its existing count-based confirmation.

RF-09 outcomes, exact delete confirmations, cancellation/error/retry retention,
pending locks, session isolation and late-success pruning are unchanged. A pending
delete can finish after the user selects another stage; only its confirmed IDs
are removed from the current selection. Real and Demo share Dashboard logic;
Demo continues to make no backend requests.

Screenshot inspection also found the existing desktop multi-select toolbar
overlapping filter controls. A narrow theme override stacks the
existing controls only while the bulk toolbar is present; button/card styling
and the normal non-selection layout stay unchanged. Smaller widths already
stack these groups. Regression tests check control bounding boxes do not overlap.

## Verification

The old F09 known-bug characterization now asserts all 25 displayed Board records
are selected and can be unselected. Focused Playwright coverage checks actual
visible columns and exact DELETE IDs, not only a cosmetic selection count:

- Mixed-stage Board at 1440/901/900/899/768/390px, including both breakpoint edges.
- List page-by-page selection/unselection, page-size changes and view switching.
- Search, status filtering, sorting, empty scopes, hidden selection retention and
  exiting selection mode on an empty search.
- Stage switching and live resizing without clearing earlier valid selections.
- Confirmed status movement, record deletion and exact surviving selected IDs.
- Cancellation, held DELETE, selection changes, failure and retry across stages.
- Demo at desktop/tablet/phone, local deletion, overflow and screenshots.

Existing RF-07/08/09/10 regressions and unrelated known-bug cases are retained.

Local gates (2026-10-13, America/Toronto):

- `npm test`: 39 passed; `npm run test:audit`: 28 passed.
- `npm run test:auth-ui`: 12 passed.
- `npm run test:audit-ui -- --project chromium`: 145 passed, including 16 new
  RF-11 cases, the corrected F09 case and all existing RF-07/08/09/10 regressions.
- `npm run test:audit-ui -- dashboard-selection.spec.js --project firefox
  --project webkit`: 32 passed (16 per browser). Final Chromium, authentication
  and Firefox/WebKit runs passed without automatic retries.
- Lint, build and `git diff --check`: passed. Overflow/control-overlap checks
  passed at desktop/tablet/phone; screenshots at those widths were inspected.

Runtime attachments record actual CSS column displays and media-query results.
On this Windows Firefox runner, a requested 900px viewport reported integer
`innerWidth = 900` but `visualViewport.width = 900.13336` and the max-900px query
was false; CSS displayed all four columns. The initial test's rounded-width
assumption failed before selection ran. Boundary tests now independently check
the actual displayed columns against the media query and select their exact IDs,
with 899px explicitly testing below the boundary. No product CSS or breakpoint
was changed to accommodate the test environment.

The first toolbar fix was limited to wide desktop layouts; bounding-box tests
also caught the preexisting overlap in Firefox's fractional boundary gap between
the theme's max-900/min-901 rules. The final rule is scoped to the presence of
the bulk toolbar rather than another viewport threshold. Only multi-select
controls are stacked; normal toolbar/card styling is unchanged. One intermediate
Chromium run failed before application loading with `ERR_NO_BUFFER_SPACE`, and
an earlier WebKit List test remained in Board after its initial navigation click.
New List tests now explicitly wait for application data and the List view before
selection. Vite also reported nonfatal EBUSY warnings while watching workspace-
local Firefox profile lock files; no other project/process was modified.

## Scope and Limitations

Changed implementation: Dashboard selection and a scoped multi-select theme rule.
Test changes: the F09 audit case and new
`tests/refinement-02/ui/dashboard-selection.spec.js`. Documentation closes RF-10
with PR #22/merge SHA and verified Vercel metadata, and tracks RF-11 In Progress.

Selection uses the currently loaded application dataset; this does not resolve
the separate unpaginated Applications API/server-cap risk (R02). Board's existing
counter-based selection UI is preserved; no new per-card checkbox UI was added.
The CSS and media-query breakpoint must continue to agree; boundary tests guard
that contract. No production authenticated mutations are used as test evidence.

No dependency, API, database, Auth, Edge Function or Supabase configuration changes.
No migration or special backend release is needed. Automatic Supabase production
synchronization and Vercel Preview remain under the existing OFF hold. No manual
deployment, merge or live-user data change is authorized by this task.
