import { normalizeApplication } from '../data/applications'
import { supabase } from '../lib/supabase'

function fromApplicationRow(row) {
  return normalizeApplication({
    id: row.id,
    company: row.company,
    role: row.role,
    location: row.location,
    status: row.status,
    date: row.applied_date || '',
    jobUrl: row.job_url,
    contact: row.contact,
    salary: row.salary,
    followUp: row.follow_up || '',
    notes: row.notes,
  })
}

function toApplicationRow(application, userId) {
  return {
    user_id: userId,
    company: application.company,
    role: application.role,
    location: application.location,
    status: application.status,
    applied_date: application.date || null,
    job_url: application.jobUrl,
    contact: application.contact,
    salary: application.salary,
    follow_up: application.followUp || null,
    notes: application.notes,
  }
}

export async function fetchApplications() {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .order('created_at', { ascending: false })

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
