import {
  fromApplicationRow,
  toApplicationRow,
  toApplicationStatusRow,
} from '../data/applicationRows'
import { mergeApplicationFormChanges } from '../data/applicationForm'
import { supabase } from '../lib/supabase'

export async function fetchApplications(userId) {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('user_id', userId)
    .order('applied_date', { ascending: false, nullsFirst: false })

  if (error) {
    throw error
  }

  return data.map(fromApplicationRow)
}

const statusColumns = 'id,status,last_updated,interview_count,updated_at'

export async function fetchApplicationStatus(applicationId, userId) {
  const { data, error } = await supabase
    .from('applications')
    .select(statusColumns)
    .eq('id', applicationId)
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data
}

export function applicationStatusFields(row) {
  return {
    status: row.status,
    lastUpdated: row.last_updated || '',
    interviewCount: Number(row.interview_count) || 0,
  }
}

export async function updateApplicationStatus(applicationId, status, userId, date, isCurrent) {
  // The existing server timestamp fences late/ambiguous writes; contention is bounded.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!isCurrent()) throw new Error('Session changed. Status update canceled.')
    const current = await fetchApplicationStatus(applicationId, userId)
    if (!isCurrent()) throw new Error('Session changed. Status update canceled.')
    if (!current.updated_at) throw new Error('Cannot safely update this application. Reload and try again.')
    const { data, error } = await supabase
      .from('applications')
      .update(toApplicationStatusRow(status, current.interview_count, date))
      .eq('id', applicationId)
      .eq('user_id', userId)
      .eq('updated_at', current.updated_at)
      .select(statusColumns)
      .maybeSingle()
    if (error) throw error
    if (data) return applicationStatusFields(data)
  }
  throw new Error('This application changed while saving. Try the status change again.')
}

export async function createApplication(application, userId) {
  const { data, error } = await supabase
    .from('applications')
    .insert(toApplicationRow(application, userId))
    .select()
    .single()

  if (error) {
    throw error
  }

  return fromApplicationRow(data)
}

export async function createApplications(applications, userId) {
  const { data, error } = await supabase
    .from('applications')
    .insert(
      applications.map((application) => toApplicationRow(application, userId)),
    )
    .select()

  if (error) {
    throw error
  }

  return data.map(fromApplicationRow)
}

export async function fetchApplication(applicationId, userId) {
  const { data, error } = await supabase.from('applications').select('*')
    .eq('id', applicationId).eq('user_id', userId).single()
  if (error) throw error
  return data
}

export async function updateApplication(applicationId, changes, userId, isCurrent) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!isCurrent()) throw new Error('Session changed. Save canceled.')
    const current = await fetchApplication(applicationId, userId)
    if (!isCurrent()) throw new Error('Session changed. Save canceled.')
    if (!current.updated_at) throw new Error('Cannot safely update this application. Reload and try again.')
    const original = fromApplicationRow(current)
    const next = mergeApplicationFormChanges(original, changes)
    const originalRow = toApplicationRow(original, userId)
    const nextRow = toApplicationRow(next, userId)
    // Unchanged fields belong to the current record, not the form's older snapshot.
    const patch = Object.fromEntries(Object.entries(nextRow).filter(([key, value]) =>
      key !== 'user_id' && (key === 'last_updated' || value !== originalRow[key]),
    ))
    const { data, error } = await supabase.from('applications').update(patch)
      .eq('id', applicationId).eq('user_id', userId).eq('updated_at', current.updated_at)
      .select().maybeSingle()
    if (error) throw error
    if (data) return fromApplicationRow(data)
  }
  throw new Error('This application changed while saving. Please try again.')
}

export async function deleteApplication(applicationId, userId) {
  return deleteApplications([applicationId], userId)
}

export async function deleteApplications(applicationIds, userId) {
  const ids = [...new Set(applicationIds)]
  if (!userId || ids.length === 0) throw new Error('Choose applications in your current workspace.')
  const { data, error } = await supabase
    .from('applications')
    .delete()
    .eq('user_id', userId)
    .in('id', ids)
    .select('id')
  if (error) throw error
  // DELETE can succeed with no affected rows under RLS. Require exact confirmation.
  if (!Array.isArray(data)) throw new Error('The server did not confirm the deleted applications.')
  const confirmed = new Set(data.map((row) => String(row?.id)))
  if (data.length !== ids.length || confirmed.size !== ids.length || ids.some((id) => !confirmed.has(String(id)))) {
    throw new Error('The server did not confirm deletion of every requested application.')
  }
  return ids
}
