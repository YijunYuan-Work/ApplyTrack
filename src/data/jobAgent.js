import { parseSalaryText } from '../../supabase/functions/_shared/salary.js'

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
