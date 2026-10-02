import { MONTHS_LONG, MONTHS_SHORT, WEEKDAYS_LONG, WEEKDAYS_SHORT } from '../i18n/dict'
import { translate, type Lang } from '../i18n/translate'

export const NBSP = ' '

/** 1234567 → «1 234 567» (non-breaking spaces). */
export function formatNumber(value: number | null | undefined): string {
  const rounded = Math.round(Number(value) || 0)
  const sign = rounded < 0 ? '-' : ''
  return sign + Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
}

/** Money is an integer amount in so'm. */
export function formatMoney(value: number | null | undefined, lang: Lang): string {
  return `${formatNumber(value)}${NBSP}${translate(lang, 'currency')}`
}

/** Parses user input like «35 000» or «35,000 so'm» into an integer (null when empty / invalid). */
export function parseAmount(input: string): number | null {
  const digits = input.replace(/[\s ,.']/g, '').replace(/[^\d-]/g, '')
  if (!digits || digits === '-') return null
  const value = Number(digits)
  return Number.isSafeInteger(value) ? value : null
}

function toDate(value: string | Date): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (!value) return null
  // A plain day («2026-10-01») is a calendar date, not UTC midnight.
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const pad = (value: number) => String(value).padStart(2, '0')

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function formatTime(value: string | Date): string {
  const date = toDate(value)
  return date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : ''
}

/** «2 okt 2026» / «2 окт 2026»; the year is dropped for the current year when `short`. */
export function formatDate(value: string | Date, lang: Lang, options: { short?: boolean } = {}): string {
  const date = toDate(value)
  if (!date) return ''
  const month = MONTHS_SHORT[lang][date.getMonth()]
  const withYear = !options.short || date.getFullYear() !== new Date().getFullYear()
  return `${date.getDate()} ${month}${withYear ? ` ${date.getFullYear()}` : ''}`
}

/** «2 oktabr 2026» / «2 октября 2026». */
export function formatDateLong(value: string | Date, lang: Lang): string {
  const date = toDate(value)
  if (!date) return ''
  return `${date.getDate()} ${MONTHS_LONG[lang][date.getMonth()]} ${date.getFullYear()}`
}

/** «Bugun, 14:30» · «Kecha, 09:12» · «28 sen, 18:40» · «28 sen 2025, 18:40». */
export function formatDateTime(value: string | Date, lang: Lang, now: Date = new Date()): string {
  const date = toDate(value)
  if (!date) return ''
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  let day: string
  if (sameDay(date, now)) day = translate(lang, 'today')
  else if (sameDay(date, yesterday)) day = translate(lang, 'yesterday')
  else day = formatDate(date, lang, { short: true })
  return `${day}, ${formatTime(date)}`
}

/** Full timestamp for tooltips / detail pages: «2 oktabr 2026, 14:30». */
export function formatFullDateTime(value: string | Date, lang: Lang): string {
  const date = toDate(value)
  return date ? `${formatDateLong(date, lang)}, ${formatTime(date)}` : ''
}

export function weekdayShort(value: string | Date, lang: Lang): string {
  const date = toDate(value)
  return date ? WEEKDAYS_SHORT[lang][date.getDay()] : ''
}

export function weekdayLong(value: string | Date, lang: Lang): string {
  const date = toDate(value)
  return date ? WEEKDAYS_LONG[lang][date.getDay()] : ''
}

/** +998901234567 → «+998 90 123 45 67»; anything else is returned as typed. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`
  }
  return phone
}

/** `tel:` link target for a phone number. */
export function phoneHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '')
  return `tel:${cleaned}`
}

/** First letters of up to two words, upper-cased («Aziz Karimov» → «AK»). */
export function initials(...parts: Array<string | null | undefined>): string {
  const words = parts
    .flatMap((part) => (part ?? '').trim().split(/\s+/))
    .filter(Boolean)
  const letters = words.slice(0, 2).map((word) => Array.from(word)[0]?.toUpperCase() ?? '')
  return letters.join('') || '?'
}

export function fullName(first?: string | null, last?: string | null): string {
  return [first, last]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
}

/** «m:ss» for a number of seconds. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  return `${Math.floor(seconds / 60)}:${pad(seconds % 60)}`
}

/** Google / Yandex map links for coordinates (strings or numbers from the API). */
export function mapLinks(lat: string | number | null | undefined, lng: string | number | null | undefined) {
  const latitude = Number(lat)
  const longitude = Number(lng)
  if (lat === null || lat === undefined || lng === null || lng === undefined || lat === '' || lng === '') return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return {
    google: `https://maps.google.com/?q=${latitude},${longitude}`,
    yandex: `https://yandex.uz/maps/?pt=${longitude},${latitude}&z=17&l=map`,
    label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
  }
}
