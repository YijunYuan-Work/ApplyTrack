# ApplyTrack

A React and Supabase job application tracker.

## Local development

1. Copy `.env.example` to `.env.local`.
2. Add your Supabase project URL and publishable key.
3. Run `npm install`.
4. Run `npm run dev`.

## Password recovery setup

ApplyTrack signs users in with usernames. Internally, Supabase Auth uses generated email
addresses, while the optional real recovery email is stored in user metadata. The
`request-password-reset` Edge Function looks up that recovery email, generates a
Supabase recovery link server-side, and sends it with Resend.

1. Create a Resend API key and verify your sending domain.
2. Set the Edge Function secrets in the Supabase dashboard or with the CLI:

```powershell
supabase secrets set RESEND_API_KEY=re_your_api_key
supabase secrets set "PASSWORD_RESET_FROM_EMAIL=ApplyTrack <noreply@your-domain.com>"
supabase secrets set APP_URL=https://your-vercel-project.vercel.app
supabase secrets set "ALLOWED_REDIRECT_ORIGINS=http://localhost:5173,https://your-vercel-project.vercel.app"
```

3. Deploy the public Edge Function:

```powershell
supabase functions deploy request-password-reset
```

For local Edge Function testing, copy `supabase/functions/.env.example` to
`supabase/functions/.env` and replace the placeholder values. The `.env` file is
ignored by Git.

The recovery form reports when no account is associated with an email. Before opening
registration to the public, add rate limiting or CAPTCHA protection to the public
password-recovery endpoint to limit account enumeration attempts.
