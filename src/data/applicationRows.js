import { getRejectionDate, normalizeApplication, normalizeRejectedDate } from './applications.js'

export function fromApplicationRow(row) {
  return normalizeApplication({
    id: row.id,
    company: row.company,
    role: row.role,
    location: row.location,
    status: row.status,
    date: row.applied_date || '',
    rejectedDate: row.rejected_date,
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
    rejected_date: normalizeRejectedDate(application.rejectedDate),
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

export function toApplicationStatusRow(status, interviewCount, lastUpdated, currentStatus) {
  return {
    status,
    last_updated: lastUpdated,
    ...(status === 'Rejected' && currentStatus !== 'Rejected'
      ? { rejected_date: getRejectionDate({ status: currentStatus }, status, lastUpdated) }
      : {}),
    ...(status === 'Interview' && (Number(interviewCount) || 0) === 0
      ? { interview_count: 1 }
      : {}),
  }
}
