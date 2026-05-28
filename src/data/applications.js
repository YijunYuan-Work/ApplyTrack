export const applicationsKey = 'applytrack-applications'
export const userKey = 'applytrack-user'

export const statuses = ['Wishlist', 'Applied', 'Interview', 'Offer', 'Rejected']

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
    notes: 'Screening call booked. Review component architecture examples.',
  },
]

export function createBlankApplication() {
  return {
    company: '',
    role: '',
    location: '',
    status: 'Applied',
    date: new Date().toISOString().slice(0, 10),
    jobUrl: '',
    contact: '',
    salary: '',
    followUp: '',
    coverLetter: '',
    referral: '',
    lastUpdated: '',
    notes: '',
  }
}

export function normalizeApplication(application) {
  return {
    ...createBlankApplication(),
    ...application,
    location: application.location || '',
    status: statuses.includes(application.status) ? application.status : 'Applied',
  }
}
