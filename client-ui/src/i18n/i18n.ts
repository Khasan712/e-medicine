import { createContext, useContext } from 'react'
import type { Lang } from '../api/types'
import { formatDateTime, formatMoney } from '../lib/format'
import { telegram } from '../lib/telegram'
import { messages, type MessageKey } from './messages'

export type { MessageKey }
export type Vars = Record<string, string | number>

export interface Named {
  name_uz: string
  name_ru: string
}

export interface I18n {
  lang: Lang
  /** The customer picked a language (persisted). */
  setLang: (lang: Lang) => void
  /** Use the language of the signed-in account unless the customer picked one on this device. */
  adoptLang: (lang: Lang | '' | null | undefined) => void
  t: (key: MessageKey, vars?: Vars) => string
  money: (value: number) => string
  date: (iso: string) => string
  /** The name of a product / category / order item in the current language (falls back to the other). */
  name: (item: Named | null | undefined) => string
  desc: (item: { desc_uz: string; desc_ru: string }) => string
  unit: (item: { unit_uz: string; unit_ru: string }) => string
}

export function translate(lang: Lang, key: MessageKey, vars?: Vars): string {
  const template = messages[lang][key] ?? messages.uz[key] ?? key
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match))
}

export function pickLang<T extends string>(lang: Lang, uzValue: T, ruValue: T): T {
  return lang === 'ru' ? ruValue || uzValue : uzValue || ruValue
}

export function makeI18n(lang: Lang, setLang: I18n['setLang'], adoptLang: I18n['adoptLang']): I18n {
  const t: I18n['t'] = (key, vars) => translate(lang, key, vars)
  return {
    lang,
    setLang,
    adoptLang,
    t,
    money: (value) => formatMoney(value, t('currency')),
    date: (iso) => formatDateTime(iso, lang),
    name: (item) => (item ? pickLang(lang, item.name_uz ?? '', item.name_ru ?? '') : ''),
    desc: (item) => pickLang(lang, item.desc_uz ?? '', item.desc_ru ?? ''),
    unit: (item) => pickLang(lang, item.unit_uz ?? '', item.unit_ru ?? ''),
  }
}

/** Saved choice → Telegram user language → browser language → Uzbek. */
export function detectLang(saved: unknown): Lang {
  if (saved === 'uz' || saved === 'ru') return saved
  const preferred = (telegram()?.initDataUnsafe.user?.language_code ?? navigator.language ?? '').toLowerCase()
  return preferred.startsWith('ru') ? 'ru' : 'uz'
}

export const I18nContext = createContext<I18n | null>(null)

export function useI18n(): I18n {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n() must be used inside <I18nProvider>')
  return context
}
