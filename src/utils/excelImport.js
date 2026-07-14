import {
  createBlankApplication,
  getTodayIsoDate,
  normalizeApplication,
  statuses,
} from '../data/applications'

const fieldAliases = {
  company: ['company', 'employer', 'organization'],
  role: ['role', 'job title', 'position', 'title'],
  location: ['location', 'city'],
  jobUrl: ['job link', 'job url', 'link', 'url', 'posting'],
  date: ['date applied', 'data applied', 'applied date', 'applied on'],
  status: ['status'],
  contact: ['contact', 'recruiter'],
  salary: ['salary', 'salary range', 'compensation'],
  followUp: ['follow up', 'follow-up', 'followup', 'next follow up'],
  notes: ['notes', 'note'],
  coverLetter: ['cover letter'],
  referral: ['referral'],
  interviewStage: ['interview stage', 'stage'],
  lastUpdated: ['last updated', 'updated'],
}

function normalizeHeader(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function buildHeaderMap(headers) {
  return headers.reduce((map, header, index) => {
    const normalizedHeader = normalizeHeader(header)

    Object.entries(fieldAliases).forEach(([field, aliases]) => {
      if (aliases.includes(normalizedHeader) && map[field] === undefined) {
        map[field] = index
      }
    })

    return map
  }, {})
}

function getCell(row, headerMap, field) {
  const index = headerMap[field]

  if (index === undefined) {
    return ''
  }

  return String(row[index] ?? '').trim()
}

function toIsoDate(value, XLSX) {
  if (!value) {
    return ''
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'number') {
    const parsedDate = XLSX.SSF.parse_date_code(value)

    if (parsedDate) {
      return `${parsedDate.y}-${String(parsedDate.m).padStart(2, '0')}-${String(parsedDate.d).padStart(2, '0')}`
    }
  }

  const parsedDate = new Date(String(value))

  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  return parsedDate.toISOString().slice(0, 10)
}

function normalizeStatus(value, interviewStage) {
  const exactStatus = statuses.find(
    (status) => status.toLowerCase() === String(value).trim().toLowerCase(),
  )

  if (exactStatus) {
    return exactStatus
  }

  if (String(value).toLowerCase().includes('reject')) {
    return 'Rejected'
  }

  if (String(value).toLowerCase().includes('offer')) {
    return 'Offer'
  }

  if (String(value).toLowerCase().includes('interview') || interviewStage) {
    return 'Interview'
  }

  return 'Applied'
}

function inferInterviewCount(interviewStage) {
  const normalizedStage = String(interviewStage).trim().toLowerCase()

  if (!normalizedStage) {
    return 0
  }

  const numericMatch = normalizedStage.match(/\d+/)

  if (numericMatch) {
    return Number(numericMatch[0])
  }

  if (
    normalizedStage.includes('final') ||
    normalizedStage.includes('onsite') ||
    normalizedStage.includes('panel')
  ) {
    return 2
  }

  return 1
}

function buildNotes(row, headerMap) {
  const notes = [
    getCell(row, headerMap, 'notes'),
    getCell(row, headerMap, 'interviewStage') &&
      `Interview stage: ${getCell(row, headerMap, 'interviewStage')}`,
  ].filter(Boolean)

  return notes.join('\n')
}

export async function downloadExcelTemplate() {
  const XLSX = await import('xlsx')
  const worksheet = XLSX.utils.aoa_to_sheet([
    [
      'Company',
      'Role',
      'Location',
      'Status',
      'Applied Date',
      'Follow Up',
      'Job Link',
      'Contact',
      'Salary',
      'Cover Letter',
      'Referral',
      'Interview Stage',
      'Last Updated',
      'Notes',
    ],
  ])
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Applications')
  XLSX.writeFile(workbook, 'ApplyTrack-import-template.xlsx')
}

export async function parseExcelApplications(file) {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { cellDates: true })
  const firstSheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    header: 1,
    raw: true,
  })

  if (rows.length < 2) {
    return []
  }

  const [headers, ...dataRows] = rows
  const headerMap = buildHeaderMap(headers)

  return dataRows
    .map((row) => {
      const interviewStage = getCell(row, headerMap, 'interviewStage')
      const application = {
        ...createBlankApplication(),
        company: getCell(row, headerMap, 'company'),
        role: getCell(row, headerMap, 'role'),
        location: getCell(row, headerMap, 'location'),
        status: normalizeStatus(getCell(row, headerMap, 'status'), interviewStage),
        date: toIsoDate(row[headerMap.date], XLSX),
        jobUrl: getCell(row, headerMap, 'jobUrl'),
        contact: getCell(row, headerMap, 'contact'),
        salary: getCell(row, headerMap, 'salary'),
        followUp: toIsoDate(row[headerMap.followUp], XLSX),
        coverLetter: getCell(row, headerMap, 'coverLetter'),
        referral: getCell(row, headerMap, 'referral'),
        lastUpdated: toIsoDate(row[headerMap.lastUpdated], XLSX) || getTodayIsoDate(),
        interviewCount: inferInterviewCount(interviewStage),
        notes: buildNotes(row, headerMap),
      }

      return normalizeApplication(application)
    })
    .filter((application) => application.company && application.role)
}
