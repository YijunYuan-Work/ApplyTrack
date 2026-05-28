import { normalizeApplication } from '../data/applications'
import { supabase } from '../lib/supabase'

function toIsoDate(value) {
  if (!value) {
    return ''
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  return parsedDate.toISOString().slice(0, 10)
}

function extractLegacyNoteDetails(notes = '') {
  const coverLetterMatch = notes.match(/Cover letter:\s*(Yes|No)/i)
  const referralMatch = notes.match(/Referral:\s*(Yes|No)/i)
  const lastUpdatedMatch = notes.match(/Last updated:\s*([^\n]+)/i)
  const cleanedNotes = notes
    .replace(/Cover letter:\s*(Yes|No)/gi, '')
    .replace(/Referral:\s*(Yes|No)/gi, '')
    .replace(/Last updated:\s*([^\n]+)/gi, '')
    .trim()

  return {
    coverLetter: coverLetterMatch?.[1] || '',
    referral: referralMatch?.[1] || '',
    lastUpdated: toIsoDate(lastUpdatedMatch?.[1]),
    notes: cleanedNotes,
  }
}

function fromApplicationRow(row) {
  const legacyDetails = extractLegacyNoteDetails(row.notes)

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
    coverLetter: row.cover_letter || legacyDetails.coverLetter,
    referral: row.referral || legacyDetails.referral,
    lastUpdated: row.last_updated || legacyDetails.lastUpdated,
    notes: legacyDetails.notes,
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
    cover_letter: application.coverLetter,
    referral: application.referral,
    last_updated: application.lastUpdated || null,
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
