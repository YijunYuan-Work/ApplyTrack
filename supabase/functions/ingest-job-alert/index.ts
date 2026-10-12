import { createClient } from 'npm:@supabase/supabase-js@2'
import { parseHTML } from 'npm:linkedom@0.18.13'
import { Resend } from 'npm:resend@6.18.0'
import {
  parseJobAlert,
  type EmailAnchor,
} from '../_shared/jobAlertParser.ts'

const parserVersion = 'v2'

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

function normalizeAddress(value: string) {
  const bracketed = value.match(/<([^>]+)>/)?.[1]
  return (bracketed || value).trim().toLowerCase()
}

function findAlias(addresses: string[], inboundDomain: string) {
  const expectedDomain = inboundDomain.trim().toLowerCase().replace(/^@/, '')

  for (const value of addresses) {
    const [alias, domain] = normalizeAddress(value).split('@')

    if (alias && domain === expectedDomain) {
      return alias
    }
  }

  return null
}

function cleanText(value: string | null | undefined) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function anchorsFromHtml(html: string | null, text: string | null): EmailAnchor[] {
  if (!html) {
    const lines = String(text || '').split(/\r?\n/).map(cleanText).filter(Boolean)

    return lines.flatMap((line, index) => {
      const urls = line.match(/https?:\/\/[^\s<>"']+/g) || []
      const context = lines.slice(Math.max(0, index - 2), index + 3)
      return urls.map((href) => ({ href, segments: context, text: '' }))
    })
  }

  const { document } = parseHTML(html)

  return [...document.querySelectorAll('a[href]')].map((anchor) => {
    let container = anchor.parentElement

    for (let depth = 0; container?.parentElement && depth < 5; depth += 1) {
      const length = cleanText(container.textContent).length

      if (length >= 40 && length <= 1800) {
        break
      }

      container = container.parentElement
    }

    const segmentRoot = container || anchor
    const segments = [...segmentRoot.querySelectorAll('h1,h2,h3,h4,p,span,td')]
      .map((node) => cleanText(node.textContent))
      .filter(Boolean)
      .slice(0, 30)

    return {
      href: anchor.getAttribute('href') || '',
      segments,
      text: cleanText(anchor.textContent),
    }
  })
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  const inboundDomain = Deno.env.get('INBOUND_EMAIL_DOMAIN')

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !webhookSecret || !inboundDomain) {
    console.error('Job alert ingestion is missing required server configuration.')
    return jsonResponse({ error: 'Ingestion is not configured.' }, 503)
  }

  const resend = new Resend(resendApiKey)
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const payload = await request.text()
  let event

  try {
    event = resend.webhooks.verify({
      headers: {
        id: request.headers.get('svix-id') || '',
        signature: request.headers.get('svix-signature') || '',
        timestamp: request.headers.get('svix-timestamp') || '',
      },
      payload,
      webhookSecret,
    })
  } catch {
    return jsonResponse({ error: 'Invalid webhook signature.' }, 401)
  }

  if (event.type !== 'email.received') {
    return jsonResponse({ ignored: true, ok: true })
  }

  const alias = findAlias(
    [...event.data.to, ...event.data.received_for],
    inboundDomain,
  )

  if (!alias) {
    return jsonResponse({ ignored: true, ok: true })
  }

  const { data: inbox, error: inboxError } = await admin
    .from('job_alert_inboxes')
    .select('id, user_id')
    .eq('address_alias', alias)
    .eq('enabled', true)
    .maybeSingle()

  if (inboxError) {
    console.error('Could not resolve job alert inbox.', inboxError.message)
    return jsonResponse({ error: 'Could not process this alert.' }, 500)
  }

  if (!inbox) {
    return jsonResponse({ ignored: true, ok: true })
  }

  let message: { id: number; token: string; status: string; claimed: boolean }

  try {
    const { data, error } = await admin.rpc('claim_job_alert_message', {
      p_inbox_id: inbox.id,
      p_internet_message_id: event.data.message_id || '',
      p_parser_version: parserVersion,
      p_received_at: event.data.created_at || event.created_at || new Date().toISOString(),
      p_resend_email_id: event.data.email_id,
      p_subject: event.data.subject || '',
    })

    if (error || !data) {
      throw new Error('Could not claim job alert processing.')
    }

    message = data
  } catch {
    console.error('Could not claim job alert processing; delivery can be retried.')
    return jsonResponse({ error: 'Could not process this alert.' }, 500)
  }

  if (!message.claimed) {
    if (['completed', 'partial', 'ignored'].includes(message.status)) {
      return jsonResponse({ duplicate: true, ok: true })
    }

    // Do not acknowledge unfinished work: Resend must redeliver if its worker dies.
    return jsonResponse({ error: 'This alert is still processing.' }, 503)
  }

  try {
    const { data: email, error: emailError } = await resend.emails.receiving.get(
      event.data.email_id,
    )

    if (emailError || !email) {
      throw new Error('Resend could not retrieve the received email.')
    }

    const parsed = parseJobAlert({
      anchors: anchorsFromHtml(email.html, email.text),
      from: email.from || event.data.from,
      subject: email.subject || event.data.subject,
    })
    const rows = parsed.jobs.map((job) => ({
      apply_url: job.url,
      canonical_url: job.url,
      category: job.category,
      company: job.company,
      contract_type: job.contractType,
      description: job.description,
      external_id: job.externalId,
      location: job.location,
      posted_at: job.postedAt,
      salary_max: job.salaryMax,
      salary_min: job.salaryMin,
      source: job.source,
      title: job.title,
    }))
    const { data: result, error: finishError } = await admin.rpc('finish_job_alert_message', {
      p_inbox_id: inbox.id,
      p_jobs: rows,
      p_message_id: message.id,
      p_provider: parsed.provider,
      p_token: message.token,
    })

    if (finishError || !result) {
      throw new Error('Could not commit job alert processing.')
    }

    return parsed.provider === 'unknown'
      ? jsonResponse({ ignored: true, ok: true })
      : jsonResponse({ ...result, ok: true })
  } catch {
    console.error('Job alert ingestion failed; delivery can be retried.')
    try {
      const { error: failureError } = await admin
        .from('job_alert_messages')
        .update({
          processed_at: new Date().toISOString(),
          processing_started_at: null,
          processing_token: null,
          safe_error_summary: 'The job alert could not be processed. Delivery can be retried.',
          status: 'failed',
        })
        .eq('id', message.id)
        .eq('status', 'processing')
        .eq('processing_token', message.token)

      if (failureError) {
        console.error('Could not release processing lease; it will expire.')
      }
    } catch {
      console.error('Could not release processing lease; it will expire.')
    }

    return jsonResponse({ error: 'Could not process this alert.' }, 500)
  }
})
