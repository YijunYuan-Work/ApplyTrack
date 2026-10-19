import { fromApplicationRow } from '../data/applicationRows'
import { supabase } from '../lib/supabase'

function throwIfError(error) {
  if (error) {
    throw error
  }
}

function mapLead(row) {
  return {
    applicationId: row.application_id,
    applyUrl: row.apply_url,
    canonicalUrl: row.canonical_url,
    category: row.category,
    company: row.company,
    contractType: row.contract_type,
    description: row.description,
    discoveredAt: row.discovered_at,
    filterReasons: row.filter_reasons || [],
    filtered: row.filtered,
    id: row.id,
    location: row.location,
    matchReasons: row.match_reasons || [],
    matchScore: row.match_score,
    postedAt: row.posted_at,
    salaryMax: row.salary_max,
    salaryMin: row.salary_min,
    source: row.source,
    sourceMessageId: row.source_message_id,
    state: row.state,
    title: row.title,
  }
}

function mapInbox(row) {
  if (!row) {
    return null
  }

  return {
    addressAlias: row.address_alias,
    createdAt: row.created_at,
    enabled: row.enabled,
    id: row.id,
    lastReceivedAt: row.last_received_at,
  }
}

function mapAlertMessage(row) {
  return {
    errorSummary: row.safe_error_summary,
    id: row.id,
    jobsCreated: row.jobs_created,
    jobsFound: row.jobs_found,
    jobsUpdated: row.jobs_updated,
    processedAt: row.processed_at,
    provider: row.provider,
    receivedAt: row.received_at,
    status: row.status,
    subject: row.subject,
  }
}

function waitingQuery(userId, columns = '*', options) {
  if (!userId) throw new Error('Authentication required.')
  return supabase.from('job_leads').select(columns, options)
    .eq('user_id', userId).eq('state', 'new')
}

function exactCount(result) {
  throwIfError(result.error)
  if (!Number.isSafeInteger(result.count) || result.count < 0) {
    throw new Error('Could not confirm the queue count. Reload to try again.')
  }
  return result.count
}

export async function fetchJobLeadQueue(userId, { page = 1, query = '', source = 'all' } = {}) {
  const totalResult = await waitingQuery(userId, 'id', { count: 'exact', head: true })
  let pendingCount = exactCount(totalResult)
  let request = waitingQuery(userId, '*', { count: 'exact' })
  if (source !== 'all') request = request.eq('source', source)
  if (query.trim()) {
    // Quote the PostgREST value; escape pattern characters so search stays literal.
    const pattern = `%${query.trim().replace(/[\\%_]/g, '\\$&')}%`
    const value = JSON.stringify(pattern)
    request = request.or(['company', 'title', 'location'].map((field) => `${field}.ilike.${value}`).join(','))
  }
  const result = await request.order('discovered_at', { ascending: false })
    .order('id', { ascending: false }).range((page - 1) * 20, page * 20 - 1)
  const resultCount = exactCount(result)
  if (!query.trim() && source === 'all') pendingCount = resultCount
  else if (resultCount > pendingCount) throw new Error('The queue changed while loading. Reload to try again.')
  const leads = (result.data || []).map(mapLead)
  const expected = Math.min(20, Math.max(0, resultCount - (page - 1) * 20))
  if (leads.length !== expected) {
    throw new Error('Queue results are incomplete or changed while loading. Reload to try again.')
  }
  return { leads, pendingCount, resultCount }
}

export async function fetchJobAgentWorkspace(userId) {
  const [inboxResult, messagesResult] =
    await Promise.all([
      supabase.from('job_alert_inboxes').select('*').eq('user_id', userId).maybeSingle(),
      supabase
        .from('job_alert_messages')
        .select('*')
        .eq('user_id', userId)
        .order('received_at', { ascending: false })
        .limit(20),
    ])

  ;[inboxResult, messagesResult].forEach(({ error }) => throwIfError(error))

  return {
    inbox: mapInbox(inboxResult.data),
    messages: (messagesResult.data || []).map(mapAlertMessage),
  }
}

export async function fetchJobAgentSummary(userId) {
  const [inboxResult, messagesResult, waitingResult, appliedResult] = await Promise.all([
    supabase
      .from('job_alert_inboxes')
      .select('enabled, last_received_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('job_alert_messages')
      .select('provider, received_at, status')
      .eq('user_id', userId)
      .order('received_at', { ascending: false })
      .limit(20),
    waitingQuery(userId, 'id', { count: 'exact', head: true }),
    supabase.from('job_leads').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('state', 'applied'),
  ])

  ;[inboxResult, messagesResult].forEach(({ error }) =>
    throwIfError(error),
  )

  const messages = messagesResult.data || []

  return {
    alertEnabled: Boolean(inboxResult.data?.enabled),
    appliedCount: exactCount(appliedResult),
    available: true,
    enabled: Boolean(inboxResult.data?.enabled),
    failedAlertCount: messages.filter((message) => message.status === 'failed').length,
    indeedConnected: messages.some((message) => message.provider === 'indeed'),
    lastAlertAt: inboxResult.data?.last_received_at || null,
    linkedInConnected: messages.some((message) => message.provider === 'linkedin'),
    pendingCount: exactCount(waitingResult),
  }
}

export async function createJobAlertInbox(userId) {
  const { data: existing, error: existingError } = await supabase
    .from('job_alert_inboxes')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  throwIfError(existingError)

  if (existing) {
    return mapInbox(existing)
  }

  const { error } = await supabase
    .from('job_alert_inboxes')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })

  throwIfError(error)
  const { data, error: readError } = await supabase
    .from('job_alert_inboxes')
    .select('*')
    .eq('user_id', userId)
    .single()

  throwIfError(readError)
  return mapInbox(data)
}

export async function updateJobAlertInbox(inboxId, updates) {
  const payload = {}

  if (typeof updates.enabled === 'boolean') {
    payload.enabled = updates.enabled
  }

  if (updates.rotateAddress) {
    payload.address_alias = crypto.randomUUID().replaceAll('-', '')
  }

  const { data, error } = await supabase
    .from('job_alert_inboxes')
    .update(payload)
    .eq('id', inboxId)
    .select('*')
    .single()

  throwIfError(error)
  return mapInbox(data)
}

export async function completeJobLeadApplication(leadId, appliedDate) {
  const { data, error } = await supabase
    .rpc('complete_job_lead_application', {
      p_applied_date: appliedDate,
      p_job_lead_id: leadId,
    })
    .single()

  throwIfError(error)
  return fromApplicationRow(data)
}

export async function removeJobLead(leadId, userId) {
  const { data, error } = await supabase
    .from('job_leads')
    .delete()
    .eq('id', leadId)
    .eq('user_id', userId)
    .eq('state', 'new')
    .is('application_id', null)
    .select('id')
    .single()

  throwIfError(error)
  if (data?.id !== leadId) throw new Error('The job removal was not confirmed.')
  return data.id
}

export async function fetchJobLeadRemovalScope(userId) {
  const result = await waitingQuery(userId, 'id', { count: 'exact' })
    .order('id', { ascending: false }).limit(1)
  const count = exactCount(result)
  if (count && !result.data?.[0]?.id) throw new Error('Could not confirm the removal scope.')
  return { count, upperId: result.data?.[0]?.id ?? null }
}

export async function removeAllWaitingJobLeads(userId, scope, isCurrent = () => true) {
  let cursor = 0
  let removedCount = 0
  try {
    while (scope.upperId !== null && isCurrent()) {
      const batch = await waitingQuery(userId, 'id').gt('id', cursor)
        .lte('id', scope.upperId).order('id').limit(100)
      throwIfError(batch.error)
      if (!isCurrent()) return { status: 'stale', removedCount }
      if (!batch.data?.length) break
      const ids = batch.data.map((row) => row.id)
      const deletion = await supabase.from('job_leads').delete({ count: 'exact' })
        .eq('user_id', userId).eq('state', 'new').is('application_id', null)
        .in('id', ids).select('id')
      const { data, error } = deletion
      throwIfError(error)
      if (!isCurrent()) return { status: 'stale', removedCount }
      const deleted = new Set((data || []).map((row) => row.id))
      if (!Array.isArray(data) || deleted.size !== data.length || data.some((row) => !ids.includes(row.id))) {
        throw new Error('Invalid deletion confirmation.')
      }
      removedCount += data.length
      if (exactCount(deletion) !== data.length) {
        throw new Error('Deletion confirmations were incomplete. Reload to check saved records.')
      }
      // Missing confirmations are not successes. A concurrent conversion/deletion
      // can explain them, but a still-waiting row requires an explicit retry.
      if (deleted.size !== ids.length) {
        const remaining = await waitingQuery(userId, 'id').in('id', ids)
        throwIfError(remaining.error)
        if (remaining.data?.length) throw new Error('Some jobs could not be removed; their state or permissions may have changed.')
      }
      cursor = ids.at(-1)
    }
    if (!isCurrent()) return { status: 'stale', removedCount }
    const remaining = await waitingQuery(userId, 'id', { count: 'exact', head: true }).lte('id', scope.upperId ?? 0)
    if (exactCount(remaining) !== 0) throw new Error('The queue changed during removal. Reload and retry remaining jobs.')
    return { status: 'removed', removedCount }
  } catch (error) {
    return { status: 'error', removedCount,
      message: `${removedCount} removals confirmed. Further removal could not be confirmed. ${error.message} Reload to check remaining jobs before retrying.` }
  }
}
