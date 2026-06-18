import { createClient } from 'npm:@supabase/supabase-js@2.106.2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2.106.2/cors'

const recoveryResponse = {
  message: 'If an account uses that recovery email, a reset link is on its way.',
}
const rateLimitWindowMs = 15 * 60 * 1000
const maxResetRequests = 5
const resetAttempts = new Map<string, { count: number; resetAt: number }>()

function jsonResponse(body: Record<string, string | boolean>, status = 200) {
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

function getRateLimitKey(request: Request, email: string) {
  const forwardedFor =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  return `${forwardedFor}:${email || 'empty'}`
}

function isRateLimited(request: Request, email: string) {
  const now = Date.now()
  const key = getRateLimitKey(request, email)
  const attempt = resetAttempts.get(key)

  if (!attempt || attempt.resetAt <= now) {
    resetAttempts.set(key, { count: 1, resetAt: now + rateLimitWindowMs })
    return false
  }

  if (attempt.count >= maxResetRequests) {
    return true
  }

  resetAttempts.set(key, {
    count: attempt.count + 1,
    resetAt: attempt.resetAt,
  })
  return false
}

function getSafeRedirectUrl(requestedRedirect: string) {
  const fallbackUrl = Deno.env.get('APP_URL')
  const allowedOrigins = (Deno.env.get('ALLOWED_REDIRECT_ORIGINS') || fallbackUrl || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  try {
    const requestedUrl = new URL(requestedRedirect)

    if (allowedOrigins.includes(requestedUrl.origin)) {
      return `${requestedUrl.origin}/?recovery=1`
    }
  } catch {
    // Use the configured application URL below.
  }

  if (!fallbackUrl) {
    throw new Error('APP_URL is not configured.')
  }

  return `${new URL(fallbackUrl).origin}/?recovery=1`
}

async function findUserByRecoveryEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
) {
  const perPage = 1000

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    })

    if (error) {
      throw error
    }

    const matchingUser = data.users.find(
      (user) =>
        user.user_metadata?.profileEmail?.trim().toLowerCase() === email,
    )

    if (matchingUser || data.users.length < perPage) {
      return matchingUser || null
    }
  }

  return null
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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const secretKey = getSecretKey()

    if (!supabaseUrl || !secretKey) {
      throw new Error('Supabase admin credentials are not configured.')
    }

    const { email = '', redirectTo = '' } = await request.json()
    const normalizedEmail =
      typeof email === 'string' ? email.trim().toLowerCase() : ''

    if (isRateLimited(request, normalizedEmail)) {
      return jsonResponse(
        { error: 'Too many reset requests. Please wait before trying again.' },
        429,
      )
    }

    if (!normalizedEmail) {
      return jsonResponse(recoveryResponse)
    }

    const supabaseAdmin = createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
    const user = await findUserByRecoveryEmail(supabaseAdmin, normalizedEmail)

    if (!user?.email) {
      return jsonResponse(recoveryResponse)
    }

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      email: user.email,
      options: { redirectTo: getSafeRedirectUrl(redirectTo) },
      type: 'recovery',
    })

    if (error || !data.properties?.action_link) {
      throw error || new Error('Supabase did not return a recovery link.')
    }

    await sendResetEmail(normalizedEmail, data.properties.action_link)
  } catch (error) {
    console.error('Password reset request failed:', error)
    return jsonResponse(
      { error: 'Password recovery is unavailable right now. Please try again later.' },
      500,
    )
  }

  return jsonResponse(recoveryResponse)
})
