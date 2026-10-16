// Shared by Vite, Node tests and the Deno email parser. No currency/unit conversions.
const currencyPattern = '(?:\\b(?:CAD|USD|AUD)\\s*\\$?|\\bGBP\\s*\\u00a3?|\\bEUR\\s*\\u20ac?|(?:CA|US|AU|C|A)?\\$|[\\u00a3\\u20ac])'
const currencies = new RegExp(currencyPattern, 'gi')
const currencyAtStart = new RegExp(`^${currencyPattern}`, 'i')
const rangeAtStart = /^\s*(?:-|\u2013|\u2014|\bto\b)\s*/i
const periods = {
  year: 'year', yr: 'year', yearly: 'year', annual: 'year', annually: 'year', annum: 'year',
  hour: 'hour', hr: 'hour', hourly: 'hour',
  week: 'week', wk: 'week', weekly: 'week',
  month: 'month', mo: 'month', monthly: 'month',
}

function readAmount(text) {
  const token = text.match(/^[+-]?[\d.,]+[a-z]*/i)?.[0]
  if (!token || !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?k?$/i.test(token)) return null
  const shorthand = /k$/i.test(token)
  const numberText = token.replace(/,/g, '').replace(/k$/i, '')
  const [whole, fraction = ''] = numberText.split('.')
  // Expand decimal shorthand with integer components, avoiding 2.01 * 1000 rounding noise.
  const value = shorthand ? Number(whole) * 1000 + Number(fraction.padEnd(3, '0')) : Number(numberText)
  if (!(value > 0) || value > Number.MAX_SAFE_INTEGER / 100) return null
  return { value, shorthand, length: token.length }
}

function currencyKey(marker) {
  if (marker === '\u00a3') return 'GBP'
  if (marker === '\u20ac') return 'EUR'
  const token = marker.replace(/[\s$\u00a3\u20ac]/g, '').toUpperCase()
  return { '': '$', CA: 'CAD', C: 'CAD', US: 'USD', AU: 'AUD', A: 'AUD' }[token] || token
}

function compatibleCurrencies(first, second) {
  const a = currencyKey(first)
  const b = currencyKey(second)
  return a === b || (a === '$' && ['CAD', 'USD', 'AUD'].includes(b)) ||
    (b === '$' && ['CAD', 'USD', 'AUD'].includes(a))
}

export function parseSalaryText(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  const markers = [...text.matchAll(currencies)]
  if (!markers.length || markers.length > 2) return null
  const first = markers[0]
  const start = first.index
  // Do not salvage a dollar sign from an unsupported currency code or negative amount.
  if (/[\w.+-]$/.test(text.slice(0, start)) ||
    /\b(?:up to|from|starting at|at least|over|under|between|about|approximately)\s*$/i.test(text.slice(0, start))) return null
  let cursor = start + first[0].length
  cursor += text.slice(cursor).match(/^\s*/)[0].length
  const minimum = readAmount(text.slice(cursor))
  if (!minimum) return null
  cursor += minimum.length
  let maximum = null
  const separator = text.slice(cursor).match(rangeAtStart)
  if (separator) {
    cursor += separator[0].length
    const secondCurrency = text.slice(cursor).match(currencyAtStart)?.[0]
    if (secondCurrency) {
      if (!compatibleCurrencies(first[0], secondCurrency)) return null
      cursor += secondCurrency.length
      cursor += text.slice(cursor).match(/^\s*/)[0].length
    }
    maximum = readAmount(text.slice(cursor))
    if (!maximum || maximum.value < minimum.value || maximum.shorthand !== minimum.shorthand) return null
    cursor += maximum.length
  }

  let period = null
  const rest = text.slice(cursor)
  if (/^\s+(?:days?|daily|fortnight(?:ly)?|bi[ -]?(?:weekly|monthly)|quarter(?:ly)?)\b/i.test(rest)) return null
  const explicitUnit = rest.match(/^\s*(?:(?:a|per)\s+|\/\s*)([a-z]+)/i)
  const bareUnit = rest.match(/^\s+(year|yr|yearly|annual|annually|annum|hour|hr|hourly|week|wk|weekly|month|mo|monthly)\b/i)
  const unit = explicitUnit || bareUnit
  if (unit) {
    const name = unit[1].toLowerCase()
    if (!Object.hasOwn(periods, name)) return null
    period = periods[name]
    cursor += unit[0].length
  }
  // Reject incomplete/alternative ranges and unsupported units; never retry a later bound.
  if (/^\w|^\s*(?:[\d/+%\u2013\u2014-]|[.,](?!\s|$)|\b(?:to|or|and|a|per|k)\b)/i.test(text.slice(cursor)) ||
    markers.some((marker) => marker.index >= cursor)) return null
  return {
    minimum: minimum.value,
    maximum: maximum?.value ?? null,
    period,
    matchedText: text.slice(start, cursor),
  }
}
