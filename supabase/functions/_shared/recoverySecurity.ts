const maxRequestBytes = 2048

export function normalizeRecoveryEmail(value) {
  if (typeof value !== 'string' || /[\p{Cc}\p{Cf}]/u.test(value)) {
    return ''
  }

  const email = value.trim().toLowerCase()
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : ''
}

export function getRecoveryNetworkAddress(request) {
  // The email bucket is authoritative. Proxy forwarding headers are only
  // a best-effort second defense and are not trusted for identity decisions.
  const ipHeader =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for') ||
    'unknown'
  return ipHeader.split(',')[0].trim().slice(0, 128) || 'unknown'
}

export async function hashRecoveryBucket(type, value) {
  const bytes = new TextEncoder().encode(`${type}:${value}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function getSafeRecoveryRedirect(requestedRedirect, appUrl, allowedOrigins) {
  if (!appUrl) {
    throw new Error('APP_URL is not configured.')
  }

  let configured
  try {
    configured = new URL(appUrl)
  } catch {
    throw new Error('APP_URL is invalid.')
  }
  const isSafeUrl = (url) => !url.username && !url.password && (
    url.protocol === 'https:' ||
    (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
  )
  if (!isSafeUrl(configured)) throw new Error('APP_URL must use HTTPS or loopback HTTP without credentials.')
  const fallbackOrigin = configured.origin
  const permitted = new Set(
    (allowedOrigins || fallbackOrigin)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )

  try {
    const requested = new URL(requestedRedirect)
    if (permitted.has(requested.origin) && isSafeUrl(requested)) {
      return `${requested.origin}/?recovery=1`
    }
  } catch {
    // Missing/invalid requests always fall back to the configured app.
  }

  return `${fallbackOrigin}/?recovery=1`
}

export async function readRecoveryRequest(request) {
  const reader = request.body?.getReader()

  if (!reader) {
    throw new Error('Missing request body.')
  }

  const chunks = []
  let byteCount = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      byteCount += value.byteLength

      if (byteCount > maxRequestBytes) {
        await reader.cancel()
        throw new Error('Request body exceeds size limit.')
      }

      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const combined = new Uint8Array(byteCount)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }

  const payload = JSON.parse(new TextDecoder().decode(combined))
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
    throw new Error('Invalid password recovery request.')
  }

  return {
    email: normalizeRecoveryEmail(payload.email),
    redirectTo: typeof payload.redirectTo === 'string' &&
      payload.redirectTo.length <= 1024 ? payload.redirectTo : '',
  }
}
