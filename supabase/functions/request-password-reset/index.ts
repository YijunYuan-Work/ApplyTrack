import { createClient } from 'npm:@supabase/supabase-js@2.106.2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2.106.2/cors'
import {
  getRecoveryNetworkAddress,
  getSafeRecoveryRedirect,
  hashRecoveryBucket,
  readRecoveryRequest,
} from '../_shared/recoverySecurity.ts'

const recoveryResponse = {
  message: 'If an account uses that recovery email, a reset link is on its way.',
}

function jsonResponse(body: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

function getSecretKey() {
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (legacyKey) {
    return legacyKey
  }

  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
  return Object.values(secretKeys)[0] as string | undefined
}

async function consumeRecoveryQuota(
  supabaseAdmin: ReturnType<typeof createClient>,
  request: Request,
  email: string,
) {
  const [emailHash, networkHash] = await Promise.all([
    hashRecoveryBucket('email', email),
    hashRecoveryBucket('network', getRecoveryNetworkAddress(request)),
  ])

  const { data, error } = await supabaseAdmin.rpc('consume_password_reset_quota', {
    p_email_hash: emailHash,
    p_network_hash: networkHash,
  })

  if (error || typeof data !== 'boolean') {
    throw error || new Error('Recovery rate-limit check failed.')
  }

  return data
}

async function lookupAuthEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
) {
  const { data, error } = await supabaseAdmin.rpc('find_recovery_auth_email', {
    p_recovery_email: email,
  })

  if (error) {
    throw error
  }

  return typeof data === 'string' && data ? data : null
}

async function sendResetEmail(to: string, actionLink: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('PASSWORD_RESET_FROM_EMAIL')

  if (!apiKey || !from) {
    throw new Error('Password-reset email delivery is not configured.')
  }

  const response = await fetch('https://api.resend.com/emails', {
    body: JSON.stringify({
      from,
      subject: 'Reset your ApplyTrack password',
      text: `Use this link to reset your ApplyTrack password: ${actionLink}`,
      to: [to],
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`Resend returned ${response.status}.`)
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  let payload
  try {
    payload = await readRecoveryRequest(request)
  } catch {
    return jsonResponse({ error: 'Invalid password recovery request.' }, 400)
  }

  if (!payload.email) {
    return jsonResponse(recoveryResponse)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const secretKey = getSecretKey()

    if (!supabaseUrl || !secretKey) {
      throw new Error('Supabase admin credentials are not configured.')
    }

    const supabaseAdmin = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Rate limiting persists across concurrent Edge Function instances.
    // A limited request returns the same non-enumerating public response.
    const permitted = await consumeRecoveryQuota(supabaseAdmin, request, payload.email)
    if (!permitted) {
      return jsonResponse(recoveryResponse)
    }

    const authEmail = await lookupAuthEmail(supabaseAdmin, payload.email)
    if (!authEmail) {
      return jsonResponse(recoveryResponse)
    }

    const redirectTo = getSafeRecoveryRedirect(
      payload.redirectTo,
      Deno.env.get('APP_URL') || '',
      Deno.env.get('ALLOWED_REDIRECT_ORIGINS') || '',
    )

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      email: authEmail,
      options: { redirectTo },
      type: 'recovery',
    })

    if (error || !data.properties?.action_link) {
      throw error || new Error('Supabase did not return a recovery link.')
    }

    await sendResetEmail(payload.email, data.properties.action_link)
  } catch (error) {
    // Avoid printing email addresses, account metadata, or recovery links.
    console.error('Password reset request failed:', error instanceof Error ? error.name : 'unknown')
    return jsonResponse(
      { error: 'Password recovery is unavailable right now. Please try again later.' },
      500,
    )
  }

  return jsonResponse(recoveryResponse)
})
