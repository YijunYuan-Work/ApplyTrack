import { parseSalaryText } from '../../supabase/functions/_shared/salary.js'

export const emptyJobAgentProfile = {
  addressCountryCode: 'ca',
  addressLine1: '',
  addressLine2: '',
  approved: false,
  automationMode: 'review',
  city: '',
  displayName: '',
  enabled: false,
  firstName: '',
  formattedAddress: '',
  futureSponsorshipRequired: '',
  lastName: '',
  latitude: null,
  location: '',
  longitude: null,
  noticePeriodDays: '',
  phone: '',
  postalCode: '',
  preferredName: '',
  region: '',
  reusableAnswers: {},
  skills: [],
  sponsorshipRequired: '',
  workAuthorization: '',
  workAuthorizationCountry: 'ca',
  workAuthorizationDetails: '',
  workAuthorizationStatus: '',
  yearsExperience: '',
}

export const emptyJobSearch = {
  countryCode: 'ca',
  employmentTypes: [],
  enabled: false,
  excludedCompanies: [],
  excludedKeywords: [],
  keywords: [],
  locations: [],
  remotePreference: 'any',
  salaryCurrency: 'CAD',
  salaryMax: '',
  salaryMin: '',
  seniorityLevels: [],
  titles: [],
  workArrangements: ['remote', 'hybrid', 'onsite'],
}

export const countryOptions = [
  { code: 'ca', currency: 'CAD', label: 'Canada' },
  { code: 'us', currency: 'USD', label: 'United States' },
  { code: 'gb', currency: 'GBP', label: 'United Kingdom' },
  { code: 'au', currency: 'AUD', label: 'Australia' },
]

const sharedAuthorizationOptions = [
  { label: 'Not currently authorized', value: 'not_authorized' },
  { label: 'Other authorization', value: 'other' },
  { label: 'Prefer not to specify', value: 'prefer_not_to_say' },
]

export const workAuthorizationOptions = {
  au: [
    { label: 'Australian citizen', value: 'citizen' },
    { label: 'Permanent resident', value: 'permanent_resident' },
    { label: 'Temporary work visa', value: 'temporary_work_authorization' },
    { label: 'Student or graduate work authorization', value: 'student_work_authorization' },
    ...sharedAuthorizationOptions,
  ],
  ca: [
    { label: 'Canadian citizen', value: 'citizen' },
    { label: 'Permanent resident', value: 'permanent_resident' },
    { label: 'Open work permit', value: 'open_work_permit' },
    { label: 'Employer-specific work permit', value: 'employer_specific_permit' },
    { label: 'Student or graduate work authorization', value: 'student_work_authorization' },
    ...sharedAuthorizationOptions,
  ],
  gb: [
    { label: 'British or Irish citizen', value: 'citizen' },
    { label: 'Indefinite leave to remain', value: 'permanent_resident' },
    { label: 'Temporary work visa', value: 'temporary_work_authorization' },
    { label: 'Student or graduate work authorization', value: 'student_work_authorization' },
    ...sharedAuthorizationOptions,
  ],
  us: [
    { label: 'U.S. citizen', value: 'citizen' },
    { label: 'Permanent resident', value: 'permanent_resident' },
    { label: 'Employment authorization document', value: 'open_work_permit' },
    { label: 'Employer-sponsored work visa', value: 'employer_specific_permit' },
    { label: 'Student or graduate work authorization', value: 'student_work_authorization' },
    ...sharedAuthorizationOptions,
  ],
}

export const seniorityOptions = [
  { label: 'Entry-level', value: 'entry' },
  { label: 'Mid-level', value: 'mid' },
  { label: 'Senior', value: 'senior' },
  { label: 'Staff', value: 'staff' },
  { label: 'Principal', value: 'principal' },
]

export const employmentTypeOptions = [
  { label: 'Full-time', value: 'full_time' },
  { label: 'Part-time', value: 'part_time' },
  { label: 'Contract', value: 'contract' },
  { label: 'Internship', value: 'internship' },
]

export const workArrangementOptions = [
  { label: 'Remote', value: 'remote' },
  { label: 'Hybrid', value: 'hybrid' },
  { label: 'On-site', value: 'onsite' },
]

export function parseList(value) {
  return [
    ...new Set(
      String(value || '')
        .split(/[\n,;]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ]
}

export function formatList(values) {
  return Array.isArray(values) ? values.join(', ') : ''
}

export function formatJobAgentDate(value, fallback = 'Not yet') {
  if (!value) {
    return fallback
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return fallback
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getJobLeadImportTimestamp(lead) {
  const timestamp = Date.parse(lead?.discoveredAt || lead?.postedAt || '')
  return Number.isNaN(timestamp) ? 0 : timestamp
}

export function sortJobLeadsNewestFirst(leads) {
  return [...leads].sort((firstLead, secondLead) => {
    const dateDifference =
      getJobLeadImportTimestamp(secondLead) - getJobLeadImportTimestamp(firstLead)

    if (dateDifference !== 0) {
      return dateDifference
    }

    return String(secondLead.id || '').localeCompare(String(firstLead.id || ''))
  })
}

export function formatSalary(minimum, maximum, currency) {
  const validAmount = (value) => value == null ||
    ((typeof value === 'number' || (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value))) &&
      Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= Number.MAX_SAFE_INTEGER / 100)
  if (!validAmount(minimum) || !validAmount(maximum) ||
    (minimum != null && maximum != null && Number(minimum) > Number(maximum))) return null
  const formatter = new Intl.NumberFormat(undefined, {
    ...(currency ? { currency, style: 'currency' } : {}),
    maximumFractionDigits: 20,
  })

  if (minimum != null && maximum != null) {
    return `${formatter.format(minimum)} - ${formatter.format(maximum)}`
  }

  if (minimum != null || maximum != null) {
    return formatter.format(minimum ?? maximum)
  }

  return 'Salary not listed'
}

function cleanLeadText(value) {
  return String(value || '')
    .replace(/Â·|â€¢/g, '·')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getJobLeadPresentation(lead) {
  const text = cleanLeadText(lead?.description)
  const salary = parseSalaryText(text)
  const hasStructuredSalary = lead?.salaryMin != null || lead?.salaryMax != null
  const structuredLabel = hasStructuredSalary ? formatSalary(lead.salaryMin, lead.salaryMax) : null
  const textSalary = salary && (!hasStructuredSalary || (structuredLabel &&
    Number(lead.salaryMin) === salary.minimum &&
    (lead.salaryMax == null ? salary.maximum === null : Number(lead.salaryMax) === salary.maximum)))
    ? salary : null
  const highlights = []

  function addHighlight(value) {
    if (value && !highlights.some((item) => item.toLowerCase() === value.toLowerCase())) {
      highlights.push(value)
    }
  }

  for (const match of text.matchAll(/\b(\d+)\s+company\s+(?:alum|alumni)\b/gi)) {
    const count = Number(match[1])
    addHighlight(`${count} company ${count === 1 ? 'alum' : 'alumni'}`)
  }

  if (/\b(?:easy|easily) apply\b/i.test(text)) {
    addHighlight('Easy Apply')
  }

  if (/\bactively recruiting\b/i.test(text)) {
    addHighlight('Actively recruiting')
  }

  const summaryParts = text
    .split(/\s*(?:·|\|)\s*/)
    .map((part) => {
      let cleaned = cleanLeadText(part)
        .replace(/\b\d+\s+company\s+(?:alum|alumni)\b/gi, '')
        .replace(/\b(?:easy|easily) apply\b/gi, '')
        .replace(/\bactively recruiting\b/gi, '')

      if (textSalary) {
        cleaned = cleaned.replace(textSalary.matchedText, '')
      }

      cleaned = cleanLeadText(cleaned)
      // Preserve rejected/conflicting compensation text, including negative or incomplete bounds.
      if (textSalary || !/[$\u00a3\u20ac]|\b(?:CAD|USD|AUD|GBP|EUR)\b/i.test(cleaned)) {
        cleaned = cleaned.replace(/^[-–—:;,.\s]+|[-–—:;,.\s]+$/g, '')
      }

      if (/^remote$/i.test(cleaned)) {
        addHighlight('Remote')
        return ''
      }

      return cleaned
    })
    .filter((part, index, parts) =>
      part &&
      parts.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()) === index
    )

  return {
    highlights,
    salaryLabel: textSalary?.matchedText || structuredLabel,
    summary: summaryParts.join(' · '),
  }
}
