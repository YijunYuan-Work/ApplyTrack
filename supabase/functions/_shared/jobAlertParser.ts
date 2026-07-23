import type { NormalizedJob } from './jobMatching.ts'

export type AlertProvider = 'linkedin' | 'indeed' | 'unknown'

export type EmailAnchor = {
  href: string
  segments: string[]
  text: string
}

export type ParsedAlertJob = NormalizedJob & {
  source: Exclude<AlertProvider, 'unknown'>
}

const genericLinkText = /^(apply|apply now|details|learn more|see job|see jobs|view|view job|view jobs|view posting)$/i
const noiseText = /^(recommended for you|jobs? you may be interested in|new jobs?|job alert|manage (?:job )?alerts?|unsubscribe(?: from this job alert)?|sign in|download the app|salary not listed|privacy(?: policy)?|terms(?: of (?:use|service))?|help cent(?:er|re)|cookie policy|accessibility|contact us|email preferences|notification settings)$/i

function cleanText(value: string | null | undefined) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function unique(values: string[]) {
  return [...new Set(values.map(cleanText).filter(Boolean))]
}

function safeUrl(value: string) {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function unwrapUrl(value: string) {
  let current = safeUrl(value)

  for (let depth = 0; current && depth < 3; depth += 1) {
    const nested = ['url', 'redirect', 'redirect_url', 'destination', 'dest'].map(
      (key) => current?.searchParams.get(key),
    ).find(Boolean)

    if (!nested) {
      break
    }

    const unwrapped = safeUrl(nested)

    if (!unwrapped) {
      break
    }

    current = unwrapped
  }

  return current
}

function sourceFromUrl(url: URL): AlertProvider {
  const hostname = url.hostname.toLowerCase()

  if (hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com')) {
    return 'linkedin'
  }

  if (hostname === 'indeed.com' || hostname.endsWith('.indeed.com')) {
    return 'indeed'
  }

  return 'unknown'
}

function isJobUrl(source: Exclude<AlertProvider, 'unknown'>, url: URL) {
  const pathname = url.pathname.toLowerCase()

  if (source === 'linkedin') {
    return /\/(?:comm\/)?jobs\/view\//.test(pathname) || Boolean(url.searchParams.get('currentJobId'))
  }

  return Boolean(url.searchParams.get('jk') || url.searchParams.get('vjk')) ||
    /\/(?:rc\/clk|viewjob)\/?$/.test(pathname)
}

export function detectAlertProvider({
  anchors = [],
  from = '',
  subject = '',
}: {
  anchors?: EmailAnchor[]
  from?: string
  subject?: string
}): AlertProvider {
  const sender = `${from} ${subject}`.toLowerCase()

  if (sender.includes('linkedin')) {
    return 'linkedin'
  }

  if (sender.includes('indeed')) {
    return 'indeed'
  }

  for (const anchor of anchors) {
    const url = unwrapUrl(anchor.href)
    const source = url ? sourceFromUrl(url) : 'unknown'

    if (source !== 'unknown') {
      return source
    }
  }

  return 'unknown'
}

function stableHash(value: string) {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(36)
}

function externalIdFor(source: ParsedAlertJob['source'], url: URL) {
  if (source === 'linkedin') {
    const pathId = url.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d+)/i)?.[1]
    return pathId || url.searchParams.get('currentJobId') || `url-${stableHash(url.href)}`
  }

  return url.searchParams.get('jk') || url.searchParams.get('vjk') || `url-${stableHash(url.href)}`
}

function isUsefulSegment(value: string) {
  return value.length >= 2 &&
    value.length <= 180 &&
    !noiseText.test(value) &&
    !genericLinkText.test(value) &&
    !/^https?:\/\//i.test(value)
}

function splitMetadata(value: string) {
  return value.split(/\s+(?:·|\||•)\s+/).map(cleanText).filter(Boolean)
}

function inferContractType(content: string) {
  const normalized = content.toLowerCase()

  if (/\bfull[ -]?time\b/.test(normalized)) return 'full time'
  if (/\bpart[ -]?time\b/.test(normalized)) return 'part time'
  if (/\b(contract|temporary|fixed[ -]?term)\b/.test(normalized)) return 'contract'
  if (/\b(intern|internship|co[ -]?op)\b/.test(normalized)) return 'internship'

  return ''
}

function jobFromAnchor(anchor: EmailAnchor, expectedSource: AlertProvider) {
  const url = unwrapUrl(anchor.href)

  if (!url) {
    return null
  }

  const source = sourceFromUrl(url)

  if (source === 'unknown' || (expectedSource !== 'unknown' && source !== expectedSource)) {
    return null
  }

  if (!isJobUrl(source, url)) {
    return null
  }

  const segments = unique([anchor.text, ...anchor.segments])
    .flatMap(splitMetadata)
    .filter(isUsefulSegment)
  const titleFromLink = cleanText(anchor.text)
  const title = !genericLinkText.test(titleFromLink) && isUsefulSegment(titleFromLink)
    ? titleFromLink
    : segments[0] || ''
  const details = segments.filter((segment) => segment !== title)
  const company = details[0] || ''
  const location = details[1] || ''

  if (!title || !company) {
    return null
  }

  const canonicalUrl = url.href
  const description = unique(details.slice(2)).join(' · ')

  return {
    category: '',
    company,
    contractType: inferContractType(`${title} ${description}`),
    description,
    externalId: externalIdFor(source, url),
    location,
    postedAt: null,
    salaryMax: null,
    salaryMin: null,
    source,
    title,
    url: canonicalUrl,
  } satisfies ParsedAlertJob
}

export function parseJobAlert({
  anchors,
  from,
  subject,
}: {
  anchors: EmailAnchor[]
  from?: string
  subject?: string
}) {
  const provider = detectAlertProvider({ anchors, from, subject })
  const jobs = anchors
    .map((anchor) => jobFromAnchor(anchor, provider))
    .filter((job): job is ParsedAlertJob => Boolean(job))
  const deduplicated = new Map<string, ParsedAlertJob>()

  jobs.forEach((job) => {
    deduplicated.set(`${job.source}:${job.externalId}`, job)
  })

  return {
    jobs: [...deduplicated.values()],
    provider,
  }
}
