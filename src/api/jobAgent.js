import { supabase } from '../lib/supabase'

function throwIfError(error) {
  if (error) {
    throw error
  }
}

function getResumeMimeType(file) {
  if (file.type) {
    return file.type
  }

  const extension = file.name.split('.').pop()?.toLowerCase()
  const mimeTypes = {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pdf: 'application/pdf',
    txt: 'text/plain',
  }

  return mimeTypes[extension] || 'application/octet-stream'
}

function mapProfile(row) {
  if (!row) {
    return null
  }

  return {
    addressCountryCode: row.address_country_code || 'ca',
    addressLine1: row.address_line_1 || '',
    addressLine2: row.address_line_2 || '',
    approved: Boolean(row.approved_at),
    approvedAt: row.approved_at,
    automationMode: row.automation_mode,
    city: row.city || '',
    displayName: row.display_name,
    enabled: row.enabled,
    firstName: row.first_name || '',
    formattedAddress: row.formatted_address || row.location || '',
    futureSponsorshipRequired:
      row.future_sponsorship_required === null
        ? ''
        : String(row.future_sponsorship_required),
    id: row.id,
    lastName: row.last_name || '',
    latitude: row.address_latitude,
    location: row.location,
    longitude: row.address_longitude,
    noticePeriodDays: row.notice_period_days ?? '',
    phone: row.phone,
    postalCode: row.postal_code || '',
    preferredName: row.preferred_name || row.display_name || '',
    region: row.region || '',
    reusableAnswers: row.reusable_answers || {},
    skills: row.skills || [],
    sponsorshipRequired:
      row.sponsorship_required === null ? '' : String(row.sponsorship_required),
    workAuthorization: row.work_authorization,
    workAuthorizationCountry: row.work_authorization_country || 'ca',
    workAuthorizationDetails: row.work_authorization_details || '',
    workAuthorizationStatus: row.work_authorization_status || '',
    yearsExperience: row.years_experience ?? '',
  }
}

function mapSearch(row) {
  if (!row) {
    return null
  }

  return {
    countryCode: row.country_code,
    employmentTypes: row.employment_types || [],
    enabled: row.enabled,
    excludedCompanies: row.excluded_companies || [],
    excludedKeywords: row.excluded_keywords || [],
    id: row.id,
    keywords: row.keywords || [],
    locations: row.locations || [],
    remotePreference: row.remote_preference,
    salaryCurrency: row.salary_currency || 'CAD',
    salaryMax: row.salary_max ?? '',
    salaryMin: row.salary_min ?? '',
    seniorityLevels: row.seniority_levels || [],
    titles: row.titles || [],
    workArrangements: row.work_arrangements || [],
  }
}

function mapResume(row) {
  return {
    createdAt: row.created_at,
    extractedText: row.extracted_text,
    fileName: row.file_name,
    fileSize: row.file_size,
    id: row.id,
    isPrimary: row.is_primary,
    mimeType: row.mime_type,
    skills: row.skills || [],
    storagePath: row.storage_path,
  }
}

function mapLead(row) {
  return {
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

export async function fetchJobAgentWorkspace(userId) {
  const [
    profileResult,
    resumesResult,
    searchResult,
    inboxResult,
    messagesResult,
    leadsResult,
  ] =
    await Promise.all([
      supabase.from('job_agent_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('resumes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('job_searches').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('job_alert_inboxes').select('*').eq('user_id', userId).maybeSingle(),
      supabase
        .from('job_alert_messages')
        .select('*')
        .eq('user_id', userId)
        .order('received_at', { ascending: false })
        .limit(20),
      supabase
        .from('job_leads')
        .select('*')
        .eq('user_id', userId)
        .order('match_score', { ascending: false })
        .order('posted_at', { ascending: false, nullsFirst: false })
        .limit(500),
    ])

  ;[
    profileResult,
    resumesResult,
    searchResult,
    inboxResult,
    messagesResult,
    leadsResult,
  ].forEach(({ error }) => throwIfError(error))

  return {
    inbox: mapInbox(inboxResult.data),
    leads: (leadsResult.data || []).map(mapLead),
    messages: (messagesResult.data || []).map(mapAlertMessage),
    profile: mapProfile(profileResult.data),
    resumes: (resumesResult.data || []).map(mapResume),
    search: mapSearch(searchResult.data),
  }
}

export async function fetchJobAgentSummary(userId) {
  const [profileResult, searchResult, inboxResult, messagesResult, leadsResult] = await Promise.all([
    supabase
      .from('job_agent_profiles')
      .select('approved_at, enabled')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('job_searches')
      .select('enabled')
      .eq('user_id', userId)
      .maybeSingle(),
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
    supabase.from('job_leads').select('filtered, source, state').eq('user_id', userId),
  ])

  ;[profileResult, searchResult, inboxResult, messagesResult, leadsResult].forEach(({ error }) =>
    throwIfError(error),
  )

  const leads = leadsResult.data || []
  const alertLeads = leads.filter(
    (lead) => lead.source === 'linkedin' || lead.source === 'indeed',
  )
  const messages = messagesResult.data || []

  return {
    alertEnabled: Boolean(inboxResult.data?.enabled),
    available: true,
    enabled: Boolean(
      profileResult.data?.enabled &&
      searchResult.data?.enabled &&
      inboxResult.data?.enabled,
    ),
    failedAlertCount: messages.filter((message) => message.status === 'failed').length,
    indeedConnected: messages.some((message) => message.provider === 'indeed'),
    lastAlertAt: inboxResult.data?.last_received_at || null,
    linkedInConnected: messages.some((message) => message.provider === 'linkedin'),
    newCount: alertLeads.filter((lead) => lead.state === 'new' && !lead.filtered).length,
    ready: Boolean(profileResult.data?.approved_at),
    savedCount: alertLeads.filter((lead) => lead.state === 'shortlisted').length,
  }
}

export async function saveJobAgentProfile(profile, userId) {
  const displayName = profile.preferredName.trim() || profile.firstName.trim()
  const location = profile.formattedAddress.trim() || [
    profile.city.trim(),
    profile.region.trim(),
    profile.addressCountryCode.toUpperCase(),
  ].filter(Boolean).join(', ')
  const payload = {
    address_country_code: profile.addressCountryCode,
    address_latitude: profile.latitude,
    address_line_1: profile.addressLine1.trim(),
    address_line_2: profile.addressLine2.trim(),
    address_longitude: profile.longitude,
    approved_at: profile.approved ? new Date().toISOString() : null,
    automation_mode: profile.automationMode,
    city: profile.city.trim(),
    display_name: displayName,
    enabled: Boolean(profile.enabled),
    first_name: profile.firstName.trim(),
    formatted_address: profile.formattedAddress.trim(),
    future_sponsorship_required:
      profile.futureSponsorshipRequired === ''
        ? null
        : profile.futureSponsorshipRequired === 'true',
    last_name: profile.lastName.trim(),
    location,
    notice_period_days:
      profile.noticePeriodDays === '' ? null : Number(profile.noticePeriodDays),
    phone: profile.phone.trim(),
    postal_code: profile.postalCode.trim(),
    preferred_name: profile.preferredName.trim(),
    region: profile.region.trim(),
    reusable_answers: profile.reusableAnswers || {},
    skills: profile.skills,
    sponsorship_required:
      profile.sponsorshipRequired === ''
        ? null
        : profile.sponsorshipRequired === 'true',
    user_id: userId,
    work_authorization: profile.workAuthorizationDetails.trim(),
    work_authorization_country: profile.workAuthorizationCountry,
    work_authorization_details: profile.workAuthorizationDetails.trim(),
    work_authorization_status: profile.workAuthorizationStatus,
    years_experience:
      profile.yearsExperience === '' ? null : Number(profile.yearsExperience),
  }
  const { data, error } = await supabase
    .from('job_agent_profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single()

  throwIfError(error)
  return mapProfile(data)
}

export async function saveJobSearch(search, userId) {
  const payload = {
    country_code: search.countryCode,
    employment_types: search.employmentTypes,
    enabled: Boolean(search.enabled),
    excluded_companies: search.excludedCompanies,
    excluded_keywords: search.excludedKeywords,
    keywords: search.keywords,
    locations: search.locations,
    remote_preference:
      search.workArrangements.length === 1
        ? search.workArrangements[0]
        : 'any',
    salary_currency: search.salaryCurrency,
    salary_max: search.salaryMax === '' ? null : Number(search.salaryMax),
    salary_min: search.salaryMin === '' ? null : Number(search.salaryMin),
    seniority_levels: search.seniorityLevels,
    titles: search.titles,
    user_id: userId,
    work_arrangements: search.workArrangements,
  }
  const { data, error } = await supabase
    .from('job_searches')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single()

  throwIfError(error)
  return mapSearch(data)
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

  const { data, error } = await supabase
    .from('job_alert_inboxes')
    .insert({ user_id: userId })
    .select('*')
    .single()

  throwIfError(error)
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

export async function uploadResume(file, extracted, userId) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-')
  const storagePath = `${userId}/${crypto.randomUUID()}-${safeName}`
  const mimeType = getResumeMimeType(file)
  const { error: uploadError } = await supabase.storage
    .from('resumes')
    .upload(storagePath, file, {
      cacheControl: '3600',
      contentType: mimeType,
      upsert: false,
    })

  throwIfError(uploadError)

  try {
    const { error: primaryError } = await supabase
      .from('resumes')
      .update({ is_primary: false })
      .eq('is_primary', true)

    throwIfError(primaryError)

    const { data, error } = await supabase
      .from('resumes')
      .insert({
        extracted_text: extracted.text,
        file_name: file.name,
        file_size: file.size,
        is_primary: true,
        mime_type: mimeType,
        skills: extracted.skills,
        storage_path: storagePath,
        user_id: userId,
      })
      .select('*')
      .single()

    throwIfError(error)
    return mapResume(data)
  } catch (error) {
    await supabase.storage.from('resumes').remove([storagePath])
    throw error
  }
}

export async function updateResumeText(resumeId, extractedText, skills) {
  const { data, error } = await supabase
    .from('resumes')
    .update({ extracted_text: extractedText.trim(), skills })
    .eq('id', resumeId)
    .select('*')
    .single()

  throwIfError(error)
  return mapResume(data)
}

export async function downloadResumeFile(resume) {
  const { data, error } = await supabase.storage
    .from('resumes')
    .download(resume.storagePath)

  throwIfError(error)
  return data
}

export async function deleteResume(resume) {
  const { error: storageError } = await supabase.storage
    .from('resumes')
    .remove([resume.storagePath])

  throwIfError(storageError)
  const { error } = await supabase.from('resumes').delete().eq('id', resume.id)
  throwIfError(error)
}

export async function updateJobLeadStates(leadIds, state) {
  const { data, error } = await supabase
    .from('job_leads')
    .update({ state })
    .in('id', leadIds)
    .select('*')

  throwIfError(error)
  return (data || []).map(mapLead)
}
