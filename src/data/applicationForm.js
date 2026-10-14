import { getRejectionDate, getTodayIsoDate, normalizeApplication } from './applications.js'

export function validateApplicationForm(data) {
  const errors = {}
  if (!(data.company || '').trim()) errors.company = 'Enter a company name.'
  if (!(data.role || '').trim()) errors.role = 'Enter a role name.'
  return errors
}

export function prepareApplicationForm(data, applicationId) {
  const today = getTodayIsoDate()
  const interviewCount = Number(data.interviewCount) || 0
  return normalizeApplication({
    ...data,
    company: data.company.trim(),
    role: data.role.trim(),
    location: data.location.trim() || 'Not specified',
    jobUrl: (data.jobUrl || '').trim(),
    contact: (data.contact || '').trim(),
    salary: (data.salary || '').trim(),
    coverLetter: (data.coverLetter || '').trim(),
    referral: (data.referral || '').trim(),
    interviewCount: data.status === 'Interview' && interviewCount === 0 ? 1 : interviewCount,
    lastUpdated: applicationId ? today : data.lastUpdated || today,
    notes: data.notes,
  })
}

export function applicationFormChanges(prepared, initial) {
  const baseline = prepareApplicationForm(initial, initial.id)
  return Object.fromEntries(Object.entries(prepared).filter(([key, value]) =>
    key !== 'id' && key !== 'rejectedDate' && (key === 'lastUpdated' || value !== baseline[key]),
  ))
}

export function mergeApplicationFormChanges(current, changes) {
  // Form intent carries the local operation day, not the stored Last Updated.
  const next = normalizeApplication({
    ...current,
    ...changes,
    rejectedDate: getRejectionDate(current, changes.status ?? current.status, changes.lastUpdated),
  })
  if (next.status === 'Interview' && next.interviewCount === 0) next.interviewCount = 1
  return next
}
