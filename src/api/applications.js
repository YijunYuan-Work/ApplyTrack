import {
  fromApplicationRow,
  toApplicationRow,
  toApplicationStatusRow,
} from '../data/applicationRows'
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

export async function updateApplication(applicationId, application, userId) {
  const { data, error } = await supabase
    .from('applications')
    .update(toApplicationRow(application, userId))
    .eq('id', applicationId)
    .select()
    .single()

  if (error) {
    throw error
  }

  return fromApplicationRow(data)
}

export async function deleteApplication(applicationId) {
  const { error } = await supabase
    .from('applications')
    .delete()
    .eq('id', applicationId)

  if (error) {
    throw error
  }
}

export async function deleteApplications(applicationIds) {
  const { error } = await supabase
    .from('applications')
    .delete()
    .in('id', applicationIds)

  if (error) {
    throw error
  }
}
