# ApplyTrack

ApplyTrack is a job application tracker built with React, Vite, and Supabase. It helps job seekers manage applications, import existing spreadsheet trackers, and review progress across applications, interviews, offers, rejections, and weekly activity.

## Features

- Username and password sign-up with optional recovery email
- Supabase-backed application storage with row-level security
- Dashboard with search, status filtering, sorting, pagination, and bulk delete
- Add and edit application details, including follow-up dates and interview count
- Excel import flow with preview and per-row selection
- Profile page for recovery email and password updates
- Progress page with a pipeline chart and weekly calendar
- Password recovery through a Supabase Edge Function and Resend

## Tech Stack

- React 19
- Vite 8
- Supabase Auth, Database, Row Level Security, and Edge Functions
- Recharts for progress visualization
- xlsx for spreadsheet parsing
- Resend for password recovery email delivery

## Getting Started

### Prerequisites

- Node.js
- npm
- A Supabase project
- A Resend account, only needed for password recovery emails

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
```

Only `.env.example` should be committed. Keep `.env.local` private.

### Set Up the Database

Run the SQL in `supabase/schema.sql` inside the Supabase SQL Editor. This creates the `applications` table, enables row-level security, and adds user-scoped policies so each user can only access their own applications.

If you already created the table before the extra application fields were added, run `supabase/add-application-detail-columns.sql` as well.

### Run Locally

```powershell
npm run dev
```

The app will usually be available at:

```text
http://127.0.0.1:5173
```

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
2. Redeploy after adding or changing environment variables.
3. Add the deployed Vercel URL to `ALLOWED_REDIRECT_ORIGINS` for password recovery.
4. Set `APP_URL` to the deployed site URL.

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
  schema.sql    Database schema and RLS policies
```

## Security Notes

- The Supabase publishable key is safe to expose in browser code when row-level security policies are correct.
- The Supabase service role key must only be used server-side, such as inside Edge Functions.
- Keep `.env.local` and function `.env` files out of Git.
- Review RLS policies before adding new tables or broadening data access.
