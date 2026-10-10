import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

export const projectRef = 'qotipygmwlovxklkexjb'
export const approvedOrigin = 'https://apply-track-six.vercel.app'
const digest = (value) => createHash('sha256').update(value).digest('hex')

export function summarizeSecrets(items) {
  const find = (name) => items.find((item) => item.name === name)
  const matches = (name, expected) => {
    const metadata = find(name)
    return metadata ? (metadata.digest ?? metadata.value) === digest(expected) : null
  }
  return {
    requiredNamesPresent: ['APP_URL', 'ALLOWED_REDIRECT_ORIGINS', 'RESEND_API_KEY',
      'PASSWORD_RESET_FROM_EMAIL', 'SUPABASE_URL'].every((name) => Boolean(find(name))),
    serverCredentialNamePresent: Boolean(find('SUPABASE_SERVICE_ROLE_KEY') || find('SUPABASE_SECRET_KEYS')),
    appUrlMatchesApprovedOrigin: matches('APP_URL', approvedOrigin),
    allowlistMatchesProductionOnly: matches('ALLOWED_REDIRECT_ORIGINS', approvedOrigin),
    allowlistMatchesDocumentedLocalhostMix: matches('ALLOWED_REDIRECT_ORIGINS',
      `http://localhost:5173,http://127.0.0.1:5173,${approvedOrigin}`),
    supabaseUrlMatchesTarget: matches('SUPABASE_URL', `https://${projectRef}.supabase.co`),
  }
}

export function summarizeAuth(config) {
  const entries = typeof config.uri_allow_list === 'string'
    ? config.uri_allow_list.split(',').map((value) => value.trim()).filter(Boolean) : null
  const canonicalEntry = (entry) => {
    try {
      const url = new URL(entry)
      return url.origin === approvedOrigin && !url.username && !url.password && !/[*]/.test(entry)
    } catch { return false }
  }
  return {
    siteUrlMatchesApprovedOrigin: typeof config.site_url === 'string'
      ? config.site_url === approvedOrigin || config.site_url === `${approvedOrigin}/` : null,
    redirectsProductionOnly: entries ? entries.length > 0 && entries.every(canonicalEntry) : null,
    recoveryRedirectExplicitlyListed: entries ? entries.includes(`${approvedOrigin}/?recovery=1`) : null,
    redirectEntryCount: entries?.length ?? null,
    otpExpirySeconds: typeof config.mailer_otp_exp === 'number' ? config.mailer_otp_exp : null,
    smtpConfigured: typeof config.smtp_host === 'string' ? Boolean(config.smtp_host) : null,
  }
}

export function summarizeBackups(config) {
  return {
    pitrEnabled: typeof config.pitr_enabled === 'boolean' ? config.pitr_enabled : null,
    physicalBackupEnabled: typeof config.physical_backup_enabled === 'boolean'
      ? config.physical_backup_enabled : null,
    backupEntryCount: Array.isArray(config.backups) ? config.backups.length : null,
    // An entry count alone never establishes freshness, completion, or restorability.
    ownerMustVerifyCompletedPreReleaseRestorePoint: true,
  }
}

export async function checkManagement(token, fetchImpl = fetch) {
  if (!token) throw new Error('Set SUPABASE_ACCESS_TOKEN in this process using an owner-authorized read-only token.')
  const result = {}
  const routes = [
    ['secrets', 'secrets', summarizeSecrets],
    ['auth', 'config/auth', summarizeAuth],
    ['backups', 'database/backups', summarizeBackups],
    ['dataApi', 'config/postgrest', (config) => ({
      publicSchemaExposed: typeof config.db_schema === 'string'
        ? config.db_schema.split(',').map((schema) => schema.trim()).includes('public') : null,
    })],
    ['edge', 'functions', (items) => {
      const deployed = items.find((item) => item.slug === 'request-password-reset')
      return { version: Number.isSafeInteger(deployed?.version) && deployed.version > 0
        ? deployed.version : null, active: deployed?.status === 'ACTIVE',
        verifyJwtDisabled: deployed?.verify_jwt === false }
    }],
  ]
  for (const [name, route, summarize] of routes) {
    try {
      const response = await fetchImpl(`https://api.supabase.com/v1/projects/${projectRef}/${route}`, {
        method: 'GET', headers: { Authorization: `Bearer ${token}` },
        redirect: 'error', signal: AbortSignal.timeout(15_000),
      })
      result[name] = response.ok ? summarize(await response.json()) : { unavailable: true, status: response.status }
    } catch {
      // Provider bodies/errors may contain credentials or private settings: never print them.
      result[name] = { unavailable: true }
    }
  }
  return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await checkManagement(process.env.SUPABASE_ACCESS_TOKEN)
    console.log(JSON.stringify(result, null, 2))
    if (Object.values(result).some((section) => section.unavailable)) process.exitCode = 1
  } catch {
    console.error('Read-only release check unavailable. Supply an owner-authorized SUPABASE_ACCESS_TOKEN; no credentials are read from disk or keyrings.')
    process.exitCode = 1
  }
}
