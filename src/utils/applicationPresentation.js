import { getDateFromKey } from '../data/progress'

const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

export function formatApplicationDate(value) {
  const date = getDateFromKey(value)
  return date ? shortDate.format(date) : 'Not set'
}
