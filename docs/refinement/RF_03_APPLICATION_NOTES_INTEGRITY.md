# RF-03: Application Notes Data Integrity

Date: 2026-10-10. Findings: **F02, F03, CQ07, G01**.
Baseline: `origin/main` at `0200606f3fed76f342e2a1d0a04ecc68fccc13f3`.
Branch: `fix/refinement-03-application-note-integrity`.
Status: implementation awaiting ChatGPT review; not Done, merged or released.

## Root Causes and Historical Evidence

- **F02:** The mapper removed every matching `Cover letter:`, `Referral:` and
  `Last updated:` phrase and trimmed Notes, even when structured columns existed.
  A subsequent unrelated edit persisted the altered text. Authenticated and demo
  save handlers also trimmed Notes; Excel cell parsing trimmed imported Notes.
- **F03:** PostgreSQL `notes text default ''` permits NULL. A JavaScript default
  parameter only handled undefined, so NULL reached `.match()` and aborted the
  entire `data.map(...)` operation.
- **CQ07:** Row transformation lived in the Supabase API module. Unit tests needed
  Vite SSR and a mocked Supabase initializer simply to call the mapper.
- **G01:** Existing audit tests asserted lost text and failed loading as intentional
  bug characterizations. Those assertions now require the corrected behavior.

History inspected: `56889b1:src/utils/excelImport.js` appended plain-text labels to
user Notes. It supplied neither a format version nor a provenance marker.
`2bd46fb:src/api/applications.js` introduced the text extraction/cleanup alongside
structured columns. The current schema defaults Cover Letter and Referral to
`No`, including its existing backfill of NULL/empty values; that does not establish
which Notes were legacy imports. These files were inspected, not applied.

## Safe Compatibility Contract

1. Preserve every string Notes value exactly at read/write boundaries: labels,
   repeated labels, tabs, leading/trailing whitespace, blank lines and CRLF included.
2. NULL, undefined/missing and unsupported non-string Notes become `''` for the UI
   and write payload. Reading alone does not update the database. Saving a nullable
   record may store an empty string, not its original SQL NULL.
3. Structured columns alone supply Cover Letter, Referral and Last Updated.
   Missing/NULL/empty columns retain existing normalization defaults: `No`, `No`,
   and applied date or local today. Never infer these values from Notes.
4. Unversioned historical text remains readable in Notes, including old metadata
   labels. Metadata available only inside old Notes is no longer automatically
   promoted into structured fields. This deliberate preservation fallback avoids
   guessing whether arbitrary user prose was machine-generated.
5. Existing structured data and interview-count behavior remain unchanged. No bulk
   rewriting, migration or cleanup occurs. Existing text already lost through a
   previous save cannot be reconstructed by this fix.
6. Excel retains original Notes and its existing appended `Interview stage: ...`
   annotation. Other spreadsheet fields retain their previous trimming behavior.
7. Native textareas expose CRLF as LF. Role-only edits retain the original React
   state and send the original CRLF string; directly editing Notes follows normal
   browser textarea line-ending behavior.

A non-destructive regex fallback was considered but rejected: even without deleting
text, it could silently derive incorrect structured values from user prose. Any
future historical-data promotion needs independently established provenance and
separate approval. No such migration is included here.

## Scoped Implementation

- `src/data/applicationRows.js`: pure read/write mappers, shared by Applications
  API and Job Agent conversion; no Supabase initialization or Vite environment.
- `src/data/applications.js`: safe string normalization for nullable Notes.
- `src/api/applications.js`, `src/api/jobAgent.js`: consume the pure mappers;
  query, mutation and RPC behavior otherwise unchanged.
- `src/App.jsx`, `src/pages/DemoWorkspace.jsx`: stop trimming Notes on save.
- `src/utils/excelImport.js`: preserve Notes cell whitespace only.
- `src/data/applicationRows.test.js`, `src/utils/excelImport.test.js`, `package.json`:
  production-mapper and Excel roundtrips run under the normal unit-test gate.
- `tests/refinement-02/logic.test.js`, `ui/audit.spec.js`, `ui/fixtures.js`,
  `tests/refinement-02/README.md`: replace F02/F03 bug assertions, strengthen
  import/conversion coverage and add authenticated/demo form regression tests.
- Master Plan: RF-03 In Progress awaiting review; other tasks unchanged.

## Validation

Before the fix, the updated F02/F03 mapper regression failed: expected the complete
original text, received only `Keep this`. No production access was used.

| Gate | Result |
| --- | --- |
| `npm test` | 34 passed, including 15 direct mapper tests and Excel `.xlsx`/`.xls` roundtrips |
| `npm run test:audit` | 14 passed; real mapper imported directly without Supabase/Vite stubs |
| Focused browser audit (`--grep 'RF-03\|Excel import\|Job conversion'`) | 18 passed across Chromium, Firefox and WebKit |
| `npm run test:audit-ui` | 66 passed: 22 scenarios each in Chromium, Firefox and WebKit |
| `npm run test:auth-ui -- --output test-results/rf03-auth` | 12 passed, including password updates, unchanged metadata and valid old reset links |
| `npm run lint` | Passed |
| `npm run build` | Passed; local bundle only |
| `npm audit --audit-level=high` | Passed; 0 high/critical, 3 pre-existing moderate entries in the Mammoth/argparse/sprintf-js chain |
| `git diff --check` | Passed |
| `npm run test:audit-db` | Blocked at Docker preflight: daemon unavailable; no test container or SQL session created |

Browser tests exercise the actual production UI, API functions and mappers with
intercepted synthetic backend responses. They cover CRUD, exact Notes payloads,
Role-only updates, mixed NULL/valid records, Excel import and Job Agent conversion.
Responsive checks cover 1440px, 768px and 390px with no document-level overflow.
Synthetic screenshots/traces stay under Git-ignored `test-results/`.

The Job Agent response fixture mirrors the existing SQL-generated confirmation
note; it does not reimplement the application mapper. This is HTTP-mocked functional
coverage, not hosted Supabase/GoTrue/PostgREST integration evidence.

## Boundaries and Remaining Risks

- No UI/CSS redesign, schema/RLS/migration, Auth, Edge Function, dependency version
  or production configuration change. No SQL deployment is required.
- No production data, credentials or real email used; no PR #6 work resumed.
- No Vercel deployment command or configuration change. Push/PR creation relies on
  the user's previously confirmed disabled automatic Preview deployment setting;
  that setting is not independently re-verified by these tests.
- SQL integration requires manually available Docker Desktop and the existing
  cached image. Its fixture runner is network-disabled and uses only its uniquely
  labeled tmpfs container. Production permission/RLS state is not validated here.
- Other audited bugs remain characterized, not fixed. A passing whole audit does
  not imply all findings are resolved; only F02/F03/CQ07 and related G01 are in scope.
- Historical unstructured-only metadata uses the documented defaults; review this
  compatibility tradeoff before merging. Lost text from past writes is not restored.
- ChatGPT review, user merge approval and applicable release verification remain
  required. No automatic merge or deployment; RF-03 must not be marked Done yet.
