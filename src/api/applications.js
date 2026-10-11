import { fromApplicationRow, toApplicationRow } from '../data/applicationRows'
import { supabase } from '../lib/supabase'

export async function fetchApplications() {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .order('applied_date', { ascending: false, nullsFirst: false })

  if (error) {
    throw error
  }

  return data.map(fromApplicationRow)
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
