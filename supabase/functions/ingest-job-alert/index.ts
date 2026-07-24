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

  const { data: priorMessage, error: priorError } = await admin
    .from('job_alert_messages')
    .select('id, status')
    .eq('resend_email_id', event.data.email_id)
    .maybeSingle()

  if (priorError) {
    console.error('Could not check webhook idempotency.', priorError.message)
    return jsonResponse({ error: 'Could not process this alert.' }, 500)
  }

  if (priorMessage && priorMessage.status !== 'failed') {
    return jsonResponse({ duplicate: true, ok: true })
  }

  const receivedAt = event.data.created_at || event.created_at || new Date().toISOString()
  const messageResult = priorMessage
    ? await admin
        .from('job_alert_messages')
        .update({
          safe_error_summary: '',
          status: 'processing',
        })
        .eq('id', priorMessage.id)
        .select('id')
        .single()
    : await admin
        .from('job_alert_messages')
        .insert({
          internet_message_id: event.data.message_id || '',
          parser_version: parserVersion,
          received_at: receivedAt,
          resend_email_id: event.data.email_id,
          status: 'processing',
          subject: event.data.subject || '',
          user_id: inbox.user_id,
        })
        .select('id')
        .single()
  const { data: message, error: messageError } = messageResult

  if (messageError) {
    if (messageError.code === '23505') {
      return jsonResponse({ duplicate: true, ok: true })
    }

    console.error('Could not create job alert history.', messageError.message)
    return jsonResponse({ error: 'Could not process this alert.' }, 500)
  }

  const { error: receivedUpdateError } = await admin
    .from('job_alert_inboxes')
    .update({ last_received_at: receivedAt })
    .eq('id', inbox.id)

  if (receivedUpdateError) {
    console.error('Could not update inbox receipt time.', receivedUpdateError.message)
  }

  try {
    const { data: email, error: emailError } = await resend.emails.receiving.get(
      event.data.email_id,
    )

    if (emailError || !email) {
      throw new Error('Resend could not retrieve the received email.')
    }

    const anchors = anchorsFromHtml(email.html, email.text)
    const parsed = parseJobAlert({
      anchors,
      from: email.from || event.data.from,
      subject: email.subject || event.data.subject,
    })

    if (parsed.provider === 'unknown') {
      await admin
        .from('job_alert_messages')
        .update({
          processed_at: new Date().toISOString(),
          safe_error_summary: 'This message was not a LinkedIn or Indeed job alert.',
          status: 'ignored',
        })
        .eq('id', message.id)

      return jsonResponse({ ignored: true, ok: true })
    }

    const externalIds = parsed.jobs.map((job) => job.externalId)
    const { data: existing, error: existingError } = externalIds.length
      ? await admin
          .from('job_leads')
          .select('discovered_at, external_id, source, state')
          .eq('user_id', inbox.user_id)
          .eq('source', parsed.provider)
          .in('external_id', externalIds)
      : { data: [], error: null }

    if (existingError) {
      throw existingError
    }

    const existingById = new Map(
      (existing || []).map((lead) => [`${lead.source}:${lead.external_id}`, lead]),
    )
    const rows = parsed.jobs.map((job) => {
      const prior = existingById.get(`${job.source}:${job.externalId}`)

      return {
        apply_url: job.url,
        canonical_url: job.url,
        category: job.category,
        company: job.company,
        contract_type: job.contractType,
        description: job.description,
        discovered_at: prior?.discovered_at || new Date().toISOString(),
        external_id: job.externalId,
        filter_reasons: [],
        filtered: false,
        job_search_id: null,
        location: job.location,
        match_reasons: [],
        match_score: 0,
        posted_at: job.postedAt,
        salary_max: job.salaryMax,
        salary_min: job.salaryMin,
        source: job.source,
        source_message_id: message.id,
        state: prior?.state || 'new',
        title: job.title,
        user_id: inbox.user_id,
      }
    })

    if (rows.length > 0) {
      const { error: upsertError } = await admin
        .from('job_leads')
        .upsert(rows, { onConflict: 'user_id,source,external_id' })

      if (upsertError) {
        throw upsertError
      }
    }

    const createdCount = rows.filter(
      (row) => !existingById.has(`${row.source}:${row.external_id}`),
    ).length
    const completedAt = new Date().toISOString()
    const status = rows.length > 0 ? 'completed' : 'partial'
    const safeErrorSummary = rows.length > 0
      ? ''
      : 'The alert was received, but no supported job links were found.'

    await Promise.all([
      admin
        .from('job_alert_messages')
        .update({
          jobs_created: createdCount,
          jobs_found: rows.length,
          jobs_updated: rows.length - createdCount,
          processed_at: completedAt,
          provider: parsed.provider,
          safe_error_summary: safeErrorSummary,
          status,
        })
        .eq('id', message.id),
      admin
        .from('job_alert_inboxes')
        .update({ last_received_at: receivedAt })
        .eq('id', inbox.id),
    ])

    return jsonResponse({ created: createdCount, found: rows.length, ok: true })
  } catch (error) {
    const safeMessage = error instanceof Error
      ? error.message
      : 'The job alert could not be processed.'

    console.error('Job alert ingestion failed.', safeMessage)
    await admin
      .from('job_alert_messages')
      .update({
        processed_at: new Date().toISOString(),
        safe_error_summary: safeMessage.slice(0, 300),
        status: 'failed',
      })
      .eq('id', message.id)

    return jsonResponse({ error: 'Could not process this alert.' }, 500)
  }
})
