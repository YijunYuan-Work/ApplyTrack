<img src="public/brand/applytrack-logo-512.png" alt="ApplyTrack logo" width="96" height="96" />

# ApplyTrack

A focused workspace for managing a job search, from first lead to final outcome.

[Live application](https://apply-track-six.vercel.app/) | [Public demo](https://apply-track-six.vercel.app/#/demo) | [QA case study](docs/QA_AUTOMATION.md)

ApplyTrack replaces scattered spreadsheets, browser tabs and reminders with an
application pipeline. It combines day-to-day tracking with a user-controlled queue
of opportunities forwarded from LinkedIn and Indeed.

## What It Does

- Board and List views with search, status filters, date sorting and selection.
- Application details and full create/edit forms for notes, salary, contacts,
  follow-ups, referrals, cover letters and interview rounds.
- Applied, Interview, Offer and Rejected stages, with confirmed save/delete outcomes.
- Progress Map, interview metrics and a weekly Applied/Rejected activity calendar.
- Excel `.xlsx` / `.xls` import, template download, preview, duplicate guidance and
  row selection before confirmation.
- Username/password accounts and password updates for signed-in users.
- An account-free Public Demo with local simulated workflows.

Calendar rejection events use the latest known rejection date, independently of
unrelated edits. Unknown historical dates are not guessed or backfilled.

## Testing & Quality Assurance

Quality engineering focuses on trustworthy outcomes, not only happy-path clicks.
The current automated baseline is:

| Layer | What it verifies |
| --- | --- |
| 207 Unit tests | Row mapping, local dates, analytics, Excel input and conservative alert/salary parsing. |
| 30 Contract tests | Source/security contracts, real Edge handler/parser execution with controlled dependencies, signed-webhook rejection and retry behavior. |
| 241 Playwright functional tests | Real React workflows: CRUD, search, queue boundaries, stale responses, concurrent edits, cancellation, partial failures and session isolation. |
| 12 separate Authentication UI tests | Sign-in/up, validation, password updates, sign-out and valid legacy reset-session handling. |
| 7 smoke scenarios per Firefox/WebKit | Selected existing functional cases for CRUD, validation, queue filtering, analytics, responsive navigation and logout failure/retry. |
| Local PostgreSQL runner | Real SQL constraints, permissions, RPCs, migration replay and synchronized races in isolated PostgreSQL 17. |

Playwright exercises the real React application and Supabase browser client against
an **intercepted synthetic Supabase HTTP backend**, not live production services.
Deterministic fixtures control commits and response order. Responsive checks cover
desktop/tablet/phone; keyboard, focus and axe checks cover accessibility basics.
The separate SQL runner tests actual local database behavior, but does not run a
complete hosted Supabase environment.

GitHub Actions runs lint, Unit/Contracts, both complete Chromium suites, the lightweight
Firefox/WebKit smoke subset and the production build on every PR and `main` push.
This is not full cross-engine regression coverage. Native HTML reports are isolated
per suite and downloadable as CI artifacts;
failure traces and selected screenshots/attachments support diagnosis. Reports
are kept for three days, not published to a public report-hosting service.

Explore the [QA automation case study](docs/QA_AUTOMATION.md), with source-backed
walkthroughs of [status races](tests/browser/functional/status-mutations.spec.js),
[destructive operations](tests/browser/functional/delete-mutations.spec.js) and
[large job queues](tests/browser/functional/job-queue.spec.js). The
[test guide](tests/README.md) covers execution, reports and limitations.

## Job Agent

1. Configure job alerts on LinkedIn or Indeed and forward them to the private
   address shown in Job Agent Setup.
2. Review the Matches queue, open a source posting, and apply on its original site.
3. Confirm **Finished applying** to create a populated application record, or
   remove an unsuitable job.

The signed Resend webhook validates delivery and uses database-backed claims,
retry leases and deduplication. Search targeting stays on the source platforms.

ApplyTrack does not scrape job sites, store LinkedIn/Indeed credentials, submit
applications, or autofill external application forms. A job URL is a stored link,
not an automatic application-prefill service. Alerts may contain only some search
results; provider email-template changes can affect parsing.

## Architecture and Privacy

React 19 + Vite form a hash-routed single-page application. Supabase provides Auth,
PostgreSQL and user-scoped Row Level Security; the `ingest-job-alert` Edge Function
handles Resend inbound events. Recharts renders analytics and SheetJS parses Excel.

Browser configuration contains only public Supabase credentials. Service-role and
Resend secrets belong on the server. ApplyTrack stores parsed job fields and
processing metadata, not full raw email bodies or attachments; forwarded mail is
also handled by the configured email provider.

There is no active resume-upload/profile-answer workflow. Public password recovery
and recovery-email settings are unavailable; authenticated password changes and
existing valid Supabase recovery-token links remain supported. Demo changes are
in memory and reset on reload; Demo does not use a personal account.

## Run Locally

Use Node.js 24 and npm:

```powershell
npm ci
npm run dev -- --host 127.0.0.1
```

Open the URL printed by Vite, normally `http://127.0.0.1:5173/#/demo`. Demo needs
no Supabase configuration. Without configuration, non-Demo routes show Setup.

For real account development, use a separate test Supabase project. Copy
[.env.example](.env.example) to ignored `.env.local`, replace its placeholders,
and restart Vite:

```powershell
Copy-Item .env.example .env.local
```

The required browser values are `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY`. `VITE_JOB_ALERT_INBOUND_DOMAIN` is optional for
displaying a configured forwarding address; it does not provision email receiving.
Real ingestion also needs a receiving domain, signed webhook and server secrets.

Database bootstrap and existing-project migrations are different operations.
Read [Maintenance](docs/MAINTENANCE.md#database-and-release-boundaries) before any
SQL or Edge deployment. Never run setup SQL or a generic database push against
production as part of frontend installation.

## Development

```powershell
npm run lint
npm test
npm run test:contracts
npm run build
npm run preview
```

See [test instructions](tests/README.md) for isolated browser and
PostgreSQL checks. Passing synthetic tests is not live-service certification.

## Documentation

- [QA automation](docs/QA_AUTOMATION.md): test design, risk-based cases and evidence boundaries.
- [Design system](docs/DESIGN_SYSTEM.md): approved Version B palette and responsive UI.
- [Maintenance](docs/MAINTENANCE.md): verification, release constraints and open issues.
- [Dependency security](docs/security/dependency-security.md): dependency policy and limits.
- [Test guide](tests/README.md): commands, fixtures and coverage boundaries.
