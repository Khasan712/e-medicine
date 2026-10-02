import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import type { Lang } from '../api/types'
import { readStorage, writeStorage } from '../lib/storage'
import { detectLang, I18nContext, makeI18n } from './i18n'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => detectLang(readStorage<unknown>('lang', null)))

  useLayoutEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    writeStorage('lang', next)
    setLangState(next)
  }, [])

  const adoptLang = useCallback((next: Lang | '' | null | undefined) => {
    if ((next === 'uz' || next === 'ru') && readStorage<unknown>('lang', null) === null) setLangState(next)
  }, [])

  const value = useMemo(() => makeI18n(lang, setLang, adoptLang), [lang, setLang, adoptLang])
  return <I18nContext value={value}>{children}</I18nContext>
}
