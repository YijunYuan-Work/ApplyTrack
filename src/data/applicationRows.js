import { normalizeApplication } from './applications.js'

export function fromApplicationRow(row) {
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
    coverLetter: row.cover_letter,
    referral: row.referral,
    lastUpdated: row.last_updated,
    interviewCount: row.interview_count,
    notes: row.notes,
  })
}

export function toApplicationRow(application, userId) {
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
    interview_count: Number(application.interviewCount) || 0,
    notes: typeof application.notes === 'string' ? application.notes : '',
  }
}
