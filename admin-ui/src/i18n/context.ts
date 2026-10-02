import { createContext, use } from 'react'
import { STORAGE_KEYS, storage } from '../lib/storage'
import type { DictKey, PluralKey } from './dict'
import { isLang, type Lang, type Vars } from './translate'

export interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  /** Translated string with `{name}` placeholders filled in. */
  t: (key: DictKey, vars?: Vars) => string
  /** Count-aware phrase, e.g. «5 заказов». */
  tn: (key: PluralKey, count: number, vars?: Vars) => string
  /** Localised `name_uz` / `name_ru`. */
  name: (item: { name_uz?: string | null; name_ru?: string | null } | null | undefined) => string
}

export const I18nContext = createContext<I18nValue | null>(null)

export function useI18n(): I18nValue {
  const value = use(I18nContext)
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>')
  return value
}

export function initialLang(): Lang {
  const saved = storage.get(STORAGE_KEYS.lang)
  return isLang(saved) ? saved : 'uz'
}
