# ApplyTrack

ApplyTrack is a job application tracker built with React, Vite, and Supabase. It helps job seekers manage applications, import existing spreadsheet trackers, and review progress across applications, interviews, offers, rejections, and weekly activity.

## Features

- Username and password sign-up with optional recovery email
- Supabase-backed application storage with row-level security
- Dashboard with search, status filtering, sorting, pagination, and bulk delete
- Public demo dashboard route with sample data for portfolio previews
- Add and edit application details, including follow-up dates and interview count
- Excel import flow with preview and per-row selection
- Profile page for recovery email and password updates
- Progress page with a pipeline chart and weekly calendar
- Opt-in Job Agent setup with private resume storage and reusable answers
- LinkedIn and Indeed job-alert ingestion through a private forwarding address
- Signed Resend inbound webhooks with message and job deduplication
- Transparent job matching with filters, scores, reasons, and bulk review actions
- Password recovery through a Supabase Edge Function and Resend

## Tech Stack

- React 19
- Vite 8
- Supabase Auth, Database, Row Level Security, and Edge Functions
- Recharts for progress visualization
- xlsx for spreadsheet parsing
- PDF.js and Mammoth for local PDF and DOCX resume text extraction
- Resend for password recovery delivery and inbound job-alert email processing

## Getting Started

### Prerequisites

- Node.js
- npm
- A Supabase project
- A Resend account, needed for password recovery and inbound job-alert emails
- A domain or Resend receiving domain configured for inbound email
- A Mapbox account, optional, for address and preferred-location suggestions

### Install Dependencies

```powershell
npm install
```

### Configure Environment Variables

Copy the example environment file:

```powershell
Copy-Item .env.example .env.local
```

Then update `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_MAPBOX_ACCESS_TOKEN=your-restricted-public-mapbox-token
VITE_JOB_ALERT_INBOUND_DOMAIN=alerts.your-domain.com
```

Only `.env.example` should be committed. Keep `.env.local` private. The Mapbox value is a browser-visible public token, so restrict it to your local and deployed ApplyTrack URLs. Leave it blank to use the structured address fields without autocomplete.

### Set Up the Database

Run the SQL in `supabase/schema.sql` inside the Supabase SQL Editor. This creates the application and Job Agent tables, enables row-level security, and adds user-scoped policies so each user can only access their own records. It also creates the private `resumes` Storage bucket.

If you already created the table before the extra application fields were added, run `supabase/add-application-detail-columns.sql` as well.

### Run Locally

```powershell
npm run dev
```

The app will usually be available at:

```text
http://127.0.0.1:5173
```

The public demo dashboard is available without signing in:

```text
http://127.0.0.1:5173/#/demo
```

## Job Agent Setup

Phases 1-4 provide profile and resume setup, LinkedIn and Indeed alert ingestion, transparent matching, and a review queue. They do not scrape job sites, store job-site credentials, or submit applications. Resume text is extracted in the browser before the file and approved text are stored in the user's private Supabase records.

The Job Agent profile stores separate legal and preferred names, a structured mailing address, work authorization, sponsorship needs, notice period in days, and professional links. Targeting preferences support multiple roles and locations, remote/hybrid/on-site work arrangements, seniority levels, employment types, and a salary range.

### Optional Address Suggestions

ApplyTrack uses the Mapbox Geocoding API when `VITE_MAPBOX_ACCESS_TOKEN` is configured. Create a public token in Mapbox, restrict its allowed URLs, and add it to `.env.local` and your Vercel environment variables. Selected suggestions are saved as structured profile data, so review Mapbox's permanent geocoding requirements before enabling this in production. Without a token, users can enter every address field manually.

### Apply The Alert-Ingestion Migration

For an existing Supabase project, apply `supabase/migrations/20260722220608_linkedin_indeed_alert_ingestion.sql` through the SQL Editor, or push linked migrations with:

```powershell
npx supabase db push
```

The migrations create the private inbox and message-history tables, add RLS policies, link imported leads to their source message, and retire the obsolete scheduled-discovery tables and cron configuration.

### Configure Resend Inbound Email

1. In Resend, add and verify a receiving domain.
2. Add that exact domain to local and Vercel environments as `VITE_JOB_ALERT_INBOUND_DOMAIN`.
3. In Resend Webhooks, add this endpoint and subscribe it to `email.received`:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/ingest-job-alert
```

4. Copy the webhook signing secret and set the server-only function values:

```powershell
npx supabase secrets set RESEND_API_KEY=re_your_api_key
npx supabase secrets set RESEND_WEBHOOK_SECRET=whsec_your_webhook_secret
npx supabase secrets set INBOUND_EMAIL_DOMAIN=alerts.your-domain.com
```

5. Deploy the public webhook function:

```powershell
npx supabase functions deploy ingest-job-alert --no-verify-jwt
```

The endpoint is public so Resend can call it, but it verifies every Resend signature before processing. It stores ingestion metadata only, not raw email bodies or attachments. Replayed webhook events and repeated jobs are deduplicated.

After deployment, open Job Agent > Setup, create the private forwarding address, and forward LinkedIn and Indeed job-alert emails to it. The Matches page shows source-specific status and imported jobs. Delivery timing is controlled by LinkedIn and Indeed; ApplyTrack processes alerts when they arrive.

## Password Recovery Setup

ApplyTrack signs users in with usernames. Supabase Auth still requires an email internally, so the app generates an internal auth email from the username and stores the user's optional real recovery email in user metadata.

The `request-password-reset` Edge Function:

1. Receives a recovery email.
2. Looks up a matching user metadata recovery email.
3. Generates a Supabase recovery link with the service role key.
4. Sends the reset email through Resend.
5. Returns a neutral public message so the app does not reveal whether an account exists.

### Required Supabase Function Secrets

Set these in Supabase Dashboard > Edge Functions > Secrets, or with the Supabase CLI:

```powershell
npx supabase secrets set RESEND_API_KEY=re_your_api_key
npx supabase secrets set "PASSWORD_RESET_FROM_EMAIL=ApplyTrack <noreply@your-domain.com>"
npx supabase secrets set APP_URL=https://your-vercel-project.vercel.app
npx supabase secrets set "ALLOWED_REDIRECT_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://your-vercel-project.vercel.app"
```

Deploy the function:

```powershell
npx supabase functions deploy request-password-reset
```

The function is public because unauthenticated users need to request password resets. It includes simple in-memory rate limiting, but for a production public launch you should consider stronger protection such as platform-level rate limiting, abuse monitoring, or CAPTCHA.

## Deployment

For Vercel deployment:

1. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel Project Settings > Environment Variables.
2. Optionally add `VITE_MAPBOX_ACCESS_TOKEN` to enable address and location suggestions.
3. Redeploy after adding or changing environment variables.
4. Add the deployed Vercel URL to `ALLOWED_REDIRECT_ORIGINS` for password recovery.
5. Set `APP_URL` to the deployed site URL.

Do not paste real secrets into `.env.example` or commit `.env.local`.

## Available Scripts

```powershell
npm run dev
```

Starts the local Vite development server.

```powershell
npm run build
```

Creates a production build.

```powershell
npm run lint
```

Runs ESLint.

```powershell
npm test
```

Runs the Job Agent parsing and matching utility tests.

```powershell
npm run preview
```

Serves the production build locally for preview.

## Project Structure

```text
src/
  api/          Supabase API helpers
  components/   Shared React components
  data/         Application defaults and normalization helpers
  lib/          Supabase client setup
  pages/        Route-level views
  styles/       Theme override layer
  utils/        Routing, storage, and Excel import utilities
supabase/
  functions/    Edge Functions
  migrations/   Incremental database migrations
  schema.sql    Database schema and RLS policies
```

## Security Notes

- The Supabase publishable key is safe to expose in browser code when row-level security policies are correct.
- The Supabase service role key must only be used server-side, such as inside Edge Functions.
- Keep `.env.local` and function `.env` files out of Git.
- Resume files are stored in a private bucket and are restricted to their owner.
- Mapbox browser tokens should be public tokens restricted to the ApplyTrack origins; never use a secret Mapbox token in a `VITE_` variable.
- Inbound message history is server-owned and read-only to its user; raw alert bodies are not retained.
- Generated leads are server-owned; users can only review the state of their own leads.
- Review RLS policies before adding new tables or broadening data access.
