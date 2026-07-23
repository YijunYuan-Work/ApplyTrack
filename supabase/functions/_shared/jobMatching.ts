export type JobSearch = {
  country_code: string
  employment_types: string[]
  excluded_companies: string[]
  excluded_keywords: string[]
  keywords: string[]
  locations: string[]
  remote_preference: string
  salary_max: number | null
  salary_min: number | null
  seniority_levels: string[]
  titles: string[]
  work_arrangements: string[]
}

const countryLabels: Record<string, string[]> = {
  au: ['au', 'australia'],
  ca: ['ca', 'canada'],
  gb: ['gb', 'uk', 'united kingdom'],
  us: ['us', 'usa', 'united states', 'united states of america'],
}

export type JobProfile = {
  skills: string[]
  years_experience: number | null
}

export type NormalizedJob = {
  category: string
  company: string
  contractType: string
  description: string
  externalId: string
  location: string
  postedAt: string | null
  salaryMax: number | null
  salaryMin: number | null
  title: string
  url: string
}

function normalize(value: string | null | undefined) {
  return (value || '').toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').trim()
}

function includesPhrase(haystack: string, phrase: string) {
  const normalizedPhrase = normalize(phrase)
  return Boolean(normalizedPhrase && haystack.includes(normalizedPhrase))
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function detectSeniority(content: string) {
  if (/\b(principal|distinguished)\b/.test(content)) {
    return 'principal'
  }

  if (/\b(staff|lead)\b/.test(content)) {
    return 'staff'
  }

  if (/\b(senior|sr\.?|manager)\b/.test(content)) {
    return 'senior'
  }

  if (/\b(mid level|intermediate)\b/.test(content)) {
    return 'mid'
  }

  if (/\b(entry level|junior|jr\.?|new grad|graduate|intern)\b/.test(content)) {
    return 'entry'
  }

  return null
}

function detectWorkArrangement(content: string) {
  if (/\bhybrid\b/.test(content)) {
    return 'hybrid'
  }

  if (/\b(remote|work from home|telecommut)/.test(content)) {
    return 'remote'
  }

  if (/\b(on[ -]?site|in[ -]?office|office[ -]?based)\b/.test(content)) {
    return 'onsite'
  }

  return null
}

function employmentTypeMatches(contractType: string, preference: string) {
  const normalizedPreference = normalize(preference)
  const aliases: Record<string, string[]> = {
    contract: ['contract', 'temporary', 'fixed term'],
    full_time: ['full time', 'permanent'],
    internship: ['intern', 'internship', 'co op'],
    part_time: ['part time'],
  }
  const terms = aliases[preference] || [normalizedPreference]

  return terms.some((term) => includesPhrase(contractType, term))
}

function locationMatchesSearch(location: string, search: JobSearch) {
  if (search.locations.length === 0) {
    return true
  }

  const selectedCountry = countryLabels[search.country_code] || [search.country_code]
  const includesWholeCountry = search.locations.some((preference) =>
    selectedCountry.includes(normalize(preference)),
  )

  return (
    includesWholeCountry ||
    search.locations.some((preference) => includesPhrase(location, preference))
  )
}

export function evaluateJob(
  job: NormalizedJob,
  search: JobSearch,
  profile: JobProfile,
) {
  const title = normalize(job.title)
  const company = normalize(job.company)
  const location = normalize(job.location)
  const content = normalize(`${job.title} ${job.description} ${job.category}`)
  const fullText = `${title} ${company} ${location} ${content}`
  const arrangement = detectWorkArrangement(fullText)
  const isRemote = arrangement === 'remote'
  const seniority = detectSeniority(content)
  const matchesLocation = locationMatchesSearch(location, search)
  const filterReasons: string[] = []

  if (search.excluded_companies.some((value) => includesPhrase(company, value))) {
    filterReasons.push('Company is on your exclusion list')
  }

  const blockedKeyword = search.excluded_keywords.find((value) =>
    includesPhrase(content, value),
  )

  if (blockedKeyword) {
    filterReasons.push(`Contains excluded keyword: ${blockedKeyword}`)
  }

  if (
    search.work_arrangements.length > 0 &&
    arrangement &&
    !search.work_arrangements.includes(arrangement)
  ) {
    filterReasons.push(`Work arrangement is ${arrangement}`)
  }

  if (
    search.seniority_levels.length > 0 &&
    seniority &&
    !search.seniority_levels.includes(seniority)
  ) {
    filterReasons.push(`Seniority is ${seniority}`)
  }

  if (
    !isRemote &&
    !matchesLocation
  ) {
    filterReasons.push('Outside your preferred locations')
  }

  if (
    search.salary_min &&
    job.salaryMax !== null &&
    job.salaryMax < search.salary_min
  ) {
    filterReasons.push('Advertised salary is below your minimum')
  }

  if (
    search.employment_types.length > 0 &&
    job.contractType &&
    !search.employment_types.some((value) => employmentTypeMatches(job.contractType, value))
  ) {
    filterReasons.push('Employment type does not match')
  }

  let score = 5
  const matchReasons: string[] = []
  const exactTitle = search.titles.find((value) => includesPhrase(title, value))

  if (exactTitle) {
    score += 40
    matchReasons.push(`Title matches ${exactTitle}`)
  } else {
    const titleTerms = unique(
      search.titles.flatMap((value) => normalize(value).split(' ')),
    ).filter((value) => value.length > 2)
    const matchingTitleTerms = titleTerms.filter((term) => title.includes(term))
    const titleScore = Math.min(30, matchingTitleTerms.length * 8)
    score += titleScore

    if (matchingTitleTerms.length > 0) {
      matchReasons.push(`Related title terms: ${matchingTitleTerms.slice(0, 3).join(', ')}`)
    }
  }

  const skillTerms = unique([...search.keywords, ...profile.skills])
  const matchingSkills = skillTerms.filter((value) => includesPhrase(content, value))
  score += Math.min(30, matchingSkills.length * 6)

  if (matchingSkills.length > 0) {
    matchReasons.push(`Skills match: ${matchingSkills.slice(0, 4).join(', ')}`)
  }

  if (seniority && search.seniority_levels.includes(seniority)) {
    score += 5
    matchReasons.push(`Preferred seniority: ${seniority}`)
  }

  if (arrangement && search.work_arrangements.includes(arrangement)) {
    score += 5
    matchReasons.push(`Preferred work arrangement: ${arrangement}`)
  }

  if (
    isRemote ||
    matchesLocation
  ) {
    score += 15
    matchReasons.push(isRemote ? 'Remote option detected' : 'Preferred location')
  }

  if (
    search.salary_min &&
    job.salaryMax !== null &&
    job.salaryMax >= search.salary_min
  ) {
    score += 5
    matchReasons.push('Salary meets your minimum')
  }

  if (
    search.salary_max &&
    job.salaryMin !== null &&
    job.salaryMin <= search.salary_max
  ) {
    score += 3
    matchReasons.push('Salary overlaps your preferred range')
  }

  if (job.postedAt) {
    const ageMs = Date.now() - new Date(job.postedAt).getTime()

    if (ageMs >= 0 && ageMs <= 3 * 24 * 60 * 60 * 1000) {
      score += 5
      matchReasons.push('Posted recently')
    }
  }

  return {
    filterReasons,
    filtered: filterReasons.length > 0,
    matchReasons: matchReasons.length > 0 ? matchReasons : ['General search match'],
    score: Math.max(0, Math.min(100, score)),
  }
}
