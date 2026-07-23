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

export function formatSalary(minimum, maximum, currency = 'CAD') {
  const formatter = new Intl.NumberFormat(undefined, {
    currency,
    maximumFractionDigits: 0,
    style: 'currency',
  })

  if (minimum && maximum) {
    return `${formatter.format(minimum)}-${formatter.format(maximum)}`
  }

  if (minimum || maximum) {
    return formatter.format(minimum || maximum)
  }

  return 'Salary not listed'
}
