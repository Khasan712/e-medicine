import type { Lang } from '../api/types'

const NBSP = '\u00A0'

/** 1250000 → "1 250 000" (non-breaking spaces, so prices never wrap). */
export function formatAmount(value: number): string {
  const rounded = Math.round(Number.isFinite(value) ? value : 0)
  const sign = rounded < 0 ? '-' : ''
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
}

export function formatMoney(value: number, currency: string): string {
  return `${formatAmount(value)}${NBSP}${currency}`
}

// --- phone numbers (Uzbek only: +998 and 9 digits) ---------------------------------------------

/** Any typed/pasted phone → up to 9 local digits ("+998 90 123-45-67" → "901234567"). */
export function localDigits(value: string | null | undefined): string {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits.replace(/^998(?=\d{9})/, '').slice(0, 9)
}

/** "901234567" → "90 123 45 67" (partial input is formatted as far as it goes). */
export function formatLocalPhone(digits: string): string {
  return [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean).join(' ')
}

export const isCompleteLocalPhone = (digits: string) => /^\d{9}$/.test(digits)

export const toE164 = (digits: string) => `+998${digits}`

/** "+998901234567" → "+998 90 123 45 67"; anything else is returned as is. */
export function displayPhone(value: string | null | undefined): string {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('998')) return `+998 ${formatLocalPhone(digits.slice(3))}`
  return value ?? ''
}

// --- dates -----------------------------------------------------------------------------------

const MONTHS: Record<Lang, string[]> = {
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  ru: [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
  ],
}
const TODAY: Record<Lang, string> = { uz: 'Bugun', ru: 'Сегодня' }
const YESTERDAY: Record<Lang, string> = { uz: 'Kecha', ru: 'Вчера' }

const pad = (n: number) => String(n).padStart(2, '0')
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** "Bugun, 14:05" · "Kecha, 09:30" · "2-oktabr, 14:05" · "2 октября, 14:05" (+ year when not this year). */
export function formatDateTime(iso: string, lang: Lang, now: Date = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (dayKey(date) === dayKey(now)) return `${TODAY[lang]}, ${time}`
  if (dayKey(date) === dayKey(yesterday)) return `${YESTERDAY[lang]}, ${time}`
  const month = MONTHS[lang][date.getMonth()]
  const sameYear = date.getFullYear() === now.getFullYear()
  if (lang === 'ru') return `${date.getDate()} ${month}${sameYear ? '' : ` ${date.getFullYear()}`}, ${time}`
  return `${sameYear ? '' : `${date.getFullYear()}-yil `}${date.getDate()}-${month}, ${time}`
}

// --- misc ------------------------------------------------------------------------------------

export function initial(text: string | null | undefined): string {
  const first = String(text ?? '').trim()[0]
  return first ? first.toUpperCase() : '?'
}

export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

export const mapUrl = (lat: number, lng: number) => `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`
