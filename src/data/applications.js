export const applicationsKey = 'applytrack-applications'
export const userKey = 'applytrack-user'

export const statuses = ['Applied', 'Interview', 'Offer', 'Rejected']

export function getTodayIsoDate() {
  const today = new Date()

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')
}

export const initialApplications = [
  {
    id: 1,
    company: 'Northstar Labs',
    role: 'Frontend Developer',
    location: 'Remote',
    status: 'Applied',
    date: '2026-05-20',
    jobUrl: 'https://example.com/frontend-developer',
    contact: 'Maya Chen',
    salary: '$95k - $120k',
    followUp: '2026-05-30',
    coverLetter: 'Yes',
    referral: 'No',
    lastUpdated: '2026-05-21',
    interviewCount: 0,
    notes: 'Submitted through the careers page. Follow up with recruiter.',
  },
  {
    id: 2,
    company: 'Brightline Health',
    role: 'React Engineer',
    location: 'Toronto, ON',
    status: 'Interview',
    date: '2026-05-23',
    jobUrl: '',
    contact: 'Alex Rivera',
    salary: '$105k - $130k',
    followUp: '2026-05-28',
    coverLetter: 'Yes',
    referral: 'No',
    lastUpdated: '2026-05-24',
    interviewCount: 1,
    notes: 'Screening call booked. Review component architecture examples.',
  },
]

export function createBlankApplication() {
  return {
    company: '',
    role: '',
    location: '',
    status: 'Applied',
    date: getTodayIsoDate(),
    jobUrl: '',
    contact: '',
    salary: '',
    followUp: '',
    coverLetter: 'No',
    referral: 'No',
    lastUpdated: getTodayIsoDate(),
    interviewCount: 0,
    notes: '',
  }
}

export function normalizeApplication(application) {
  const interviewCount = Number(application.interviewCount ?? 0)

  return {
    ...createBlankApplication(),
    ...application,
    coverLetter: application.coverLetter || 'No',
    interviewCount: Number.isNaN(interviewCount) ? 0 : Math.max(0, interviewCount),
    lastUpdated: application.lastUpdated || application.date || getTodayIsoDate(),
    location: application.location || '',
    referral: application.referral || 'No',
    status: statuses.includes(application.status) ? application.status : 'Applied',
  }
}
