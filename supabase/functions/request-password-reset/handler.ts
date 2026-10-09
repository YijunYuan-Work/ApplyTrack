import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.106.2'
import {
  getRecoveryNetworkAddress,
  getSafeRecoveryRedirect,
  hashRecoveryBucket,
  readRecoveryRequest,
} from '../_shared/recoverySecurity.ts'

type RecoveryDependencies = {
  createAdminClient: () => SupabaseClient,
  getEnv: (name: string) => string | undefined,
  fetch: typeof fetch,
  corsHeaders: Record<string, string>,
  logError: (kind: string) => void,
}

const recoveryResponse = {
  message: 'If an account uses that recovery email, a reset link is on its way.',
}

// Share the request pipeline between production and local integration tests.
export function createPasswordResetHandler(dependencies: RecoveryDependencies) {
  function jsonResponse(body: Record<string, string>, status = 200) {
    return new Response(JSON.stringify(body), {
      headers: { ...dependencies.corsHeaders, 'Content-Type': 'application/json' },
      status,
    })
  }

  return async (request: Request) => {
    if (request.method === 'OPTIONS') {
      return new Response('ok', { headers: dependencies.corsHeaders })
    }
    if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

    let payload
    try {
      payload = await readRecoveryRequest(request)
    } catch {
      return jsonResponse({ error: 'Invalid password recovery request.' }, 400)
    }
    if (!payload.email) return jsonResponse(recoveryResponse)

    let matchedAccount = false
    try {
      const supabaseAdmin = dependencies.createAdminClient()
      const [emailHash, networkHash] = await Promise.all([
        hashRecoveryBucket('email', payload.email),
        hashRecoveryBucket('network', getRecoveryNetworkAddress(request)),
      ])
      const quota = await supabaseAdmin.rpc('consume_password_reset_quota', {
        p_email_hash: emailHash,
        p_network_hash: networkHash,
      })
      if (quota.error || typeof quota.data !== 'boolean') {
        throw quota.error || new Error('Recovery rate-limit check failed.')
      }
      if (!quota.data) return jsonResponse(recoveryResponse)

      const lookup = await supabaseAdmin.rpc('find_recovery_auth_email', {
        p_recovery_email: payload.email,
      })
      if (lookup.error) throw lookup.error
      const authEmail = typeof lookup.data === 'string' && lookup.data ? lookup.data : null
      if (!authEmail) return jsonResponse(recoveryResponse)
      matchedAccount = true

      const redirectTo = getSafeRecoveryRedirect(
        payload.redirectTo,
        dependencies.getEnv('APP_URL') || '',
        dependencies.getEnv('ALLOWED_REDIRECT_ORIGINS') || '',
      )
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        email: authEmail,
        options: { redirectTo },
        type: 'recovery',
      })
      if (error || !data.properties?.action_link) {
        throw error || new Error('Supabase did not return a recovery link.')
      }
      const apiKey = dependencies.getEnv('RESEND_API_KEY')
      const from = dependencies.getEnv('PASSWORD_RESET_FROM_EMAIL')
      if (!apiKey || !from) throw new Error('Password-reset email delivery is not configured.')

      const response = await dependencies.fetch('https://api.resend.com/emails', {
        body: JSON.stringify({
          from,
          subject: 'Reset your ApplyTrack password',
          text: `Use this link to reset your ApplyTrack password: ${data.properties.action_link}`,
          to: [payload.email],
        }),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
      if (!response.ok) throw new Error(`Resend returned ${response.status}.`)
    } catch (error) {
      dependencies.logError(error instanceof Error ? error.name : 'unknown')
      // Account-specific delivery failures must not expose a successful lookup.
      if (matchedAccount) return jsonResponse(recoveryResponse)
      return jsonResponse(
        { error: 'Password recovery is unavailable right now. Please try again later.' }, 500,
      )
    }
    return jsonResponse(recoveryResponse)
  }
}
