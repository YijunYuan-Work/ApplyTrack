import { createClient } from 'npm:@supabase/supabase-js@2.106.2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2.106.2/cors'
import { createPasswordResetHandler } from '../../supabase/functions/request-password-reset/handler.ts'

// Copied only into the disposable Sandbox; this entrypoint is never deployed.
Deno.serve(createPasswordResetHandler({
  createAdminClient: () => createClient(
    Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  ),
  corsHeaders,
  getEnv: (name) => Deno.env.get(name),
  logError: (kind) => console.error('Password reset request failed:', kind),
  fetch: (input, init) => {
    if (input !== 'https://api.resend.com/emails') throw new Error('Unexpected mail endpoint.')
    return fetch(Deno.env.get('TEST_MAIL_URL')!, init)
  },
}))
