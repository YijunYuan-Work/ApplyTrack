import { createClient } from 'npm:@supabase/supabase-js@2.106.2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2.106.2/cors'
import { createPasswordResetHandler } from './handler.ts'

function getSecretKey() {
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacyKey) return legacyKey

  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
  return Object.values(secretKeys)[0] as string | undefined
}

Deno.serve(createPasswordResetHandler({
  createAdminClient: () => {
    const url = Deno.env.get('SUPABASE_URL')
    const secretKey = getSecretKey()
    if (!url || !secretKey) throw new Error('Supabase admin credentials are not configured.')
    return createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  },
  corsHeaders,
  fetch,
  getEnv: (name) => Deno.env.get(name),
  // Never include email addresses, metadata, or signed links in logs.
  logError: (kind) => console.error('Password reset request failed:', kind),
}))
