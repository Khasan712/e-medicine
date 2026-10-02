const NBSP = ' '
const MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
]

/** 505000 → "505 000" (non-breaking spaces). */
export function formatNumber(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
}

/** Money is an integer in so'm: 505000 → "505 000 so'm". */
export function formatPrice(value: number): string {
  return `${formatNumber(value)}${NBSP}so'm`
}

/** "https://burger-house.portex.uz/" → "burger-house.portex.uz". */
export function hostOf(url: string): string {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '')
    return parsed.host + path
  } catch {
    return url.replace(/^[a-z]+:\/\//i, '').replace(/\/$/, '')
  }
}

function parse(iso: string): Date | null {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "2-oktabr 2026". */
export function formatDate(iso: string): string {
  const date = parse(iso)
  return date ? `${date.getDate()}-${MONTHS[date.getMonth()]} ${date.getFullYear()}` : ''
}

/** "9-oktabr, 19:40" (the year only when it is not the current one). */
export function formatDateTime(iso: string, now = new Date()): string {
  const date = parse(iso)
  if (!date) return ''
  const year = date.getFullYear() === now.getFullYear() ? '' : ` ${date.getFullYear()}`
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return `${date.getDate()}-${MONTHS[date.getMonth()]}${year}, ${time}`
}

/** The first letter of a name for an avatar ("burger" → "B"). */
export function initialOf(name: string): string {
  return (Array.from(name.trim())[0] ?? '?').toLocaleUpperCase()
}
