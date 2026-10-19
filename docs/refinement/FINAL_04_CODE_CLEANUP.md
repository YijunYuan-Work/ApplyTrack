# Final-04: Legacy CSS and Code Cleanup

## Scope and Safety

Base: `f6a5eb9ba38a3548ac3e0b7c5917cfb5fea62117` (Final-03). Reviewed the local
UI 2.0 Final Audit's S3/S4 and optional cleanup findings against current callers
and the actual CSS import/cascade order. Version B remains the design authority.

| Change | Evidence / reason it is safe |
| --- | --- |
| Remove five old palette aliases in `src/index.css` | No consumers outside their declarations; all used semantic/status tokens retained. |
| Deduplicate `App.css` / `styles/theme.css` defaults | Same-selector unconditional theme declarations already owned the effective fields, feedback, form layout and empty-state styling. Preserve the surviving `flex-wrap`, letter spacing, shadow and input focus outline explicitly. Consolidate identical adjacent rules/media blocks without moving breakpoint boundaries. |
| Remove generic blue button background/hover/shadow | Active controls have scoped Version B treatments, including empty/error states. The unconsumed global fallback now uses existing accent tokens; actual control rendering and settled interactions are compared below. |
| Remove obsolete Job Agent client API and model options | `saveJobAgentProfile`, four resume operations and their three private mappers/helpers have no runtime/test/script consumers. Remove their unused profile/search/eligibility option constants too. Active queue/inbox/conversion/removal functions are unchanged. |
| Remove `src/utils/storage.js` and its exclusive keys/seed | No imports or dynamic consumers. Delete only unreachable source, not localStorage entries or persisted records. The cookie/session migration in `src/lib/supabase.js` and Demo fixtures are untouched. |
| Refresh `tests/refinement-02/README.md` | Correct fixed-finding claims, intercepted posting navigation, current SQL replay/readonly key-script bind, CI worker counts and explicit integration limits. |

Caller checks covered tracked source, tests, scripts/config/package references and
dynamic imports. The three edited JS modules have deletion-only diffs: surviving
functions and real data contracts are unchanged. No component JSX changed.

## Intentionally Retained

- `resumeParser.js`: no active UI import, but skill detection has two existing unit
  tests. Retain this small module and its extraction helpers/dependencies rather
  than deleting assertions or expanding into dependency/lockfile pruning. No
  shipped-bundle size reduction is claimed for unimported code.
- `parseList` / `formatList`: no UI callers, but existing tested utility contracts.
- Required globals, loading/fallback/setup styles, both screen-reader classes,
  focus indicators, scoped page CSS, motion/reduced-motion rules and responsive
  boundaries. Do not treat every overridden selector as dead in every state.
- `Infinity` normalization characterization and implementation: a separate
  correctness decision; no silent data-validation change in this cleanup.
- Dependencies/lockfile, all test assertions, CI and the two-worker configuration,
  Auth/session behavior, database objects/migrations, Edge Functions and user data.

## Verification

Node 24.16.0 / Playwright 1.62.1. All existing assertions/configuration retained.

| Check | Result |
| --- | --- |
| `npm test` / `npm run test:audit` | 207/207 Unit; 30/30 Audit |
| Full Chromium functional suite | 237/237, two workers, 362.95 seconds |
| Authentication UI | 12/12, one worker |
| Focused Firefox/WebKit | 18/18: fractional Dashboard/Agent/Progress/Profile/Import/navigation, normal-motion hover/focus, and Version B semantics/contrast at all three sizes |
| Lint / production build / `git diff --check` | Pass; existing large-chunk build warning remains |

Browser reports show zero skipped, unexpected or flaky results, with no retries.
No test implementation, assertion, CI workflow or tracked browser config changed.

Visual checks cover Board/List, drawer, Add/Edit, Map/Calendar, Agent Setup/Matches,
Profile/passwords, Import/preview, Sign In/Up/Reset, Demo and no-config Setup at
1440/768/390px. Board/List also cover 639/640, 720/721, 900/901, 1039/1040 and
1280/1281px; the existing cross-engine tests cover fractional CSS boundaries.

Final route-title assertions exclude lazy-loading placeholders. On the same settled
DOM, swap the two changed application stylesheets between pinned-base source and
cleaned source, retaining stylesheet order, fonts and page-specific styles. All
77 recorded geometry/computed-style snapshots match, with zero page errors or
document overflow. Of 80 screenshot pairs (including three no-config Setup views),
62 are pixel-identical; the other 18 differ by 4-119 pixels each with unchanged
recorded geometry/styles. Manual inspection found no perceptible design change;
this is not a claim of universal pixel identity. The unused root aliases were
checked separately for zero consumers, avoiding relative font-URL substitution.
Additional 15 empty/password error-success/sign-out-failure captures retain their
recorded normal styles. Same-DOM settled hover/focus comparisons cover 640 controls
across 45 route/size observations with zero differences. Early immediate-hover
readings were replaced with frame-settled comparisons, not dismissed as a pass.

Synthetic scripts, raw screenshots, JSON comparisons and test logs remain ignored
under `tmp/final-04.local/`; no screenshot framework or dependency was introduced.

All evidence uses synthetic accounts/data and intercepted requests, not production.
Ignored local Vite wrappers limit dependency scanning to `index.html` and exclude
old `tmp`/`.temp` tool trees from watching; owned ports, fixture environment,
assertions, test counts, retries and tracked configurations are unchanged.

## Limits and Follow-ups

- Browser evidence is bounded to the recorded synthetic routes/states, not every
  possible CSS combination, OS-native dialog or assistive technology.
- SQL/Docker and native Deno checks are not rerun: no SQL, schema, Edge, signature,
  parser or transactional behavior changed. The README describes their current
  coverage, not a fresh production or database validation.
- Non-finite interview normalization remains a separate potential correctness
  task. Dependency pruning can be considered separately with its own review.
- The existing large-chunk build warning is not addressed by unrelated code
  splitting. No manual deployment, merge or production service operation.
