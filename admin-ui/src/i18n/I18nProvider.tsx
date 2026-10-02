import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { setApiLanguage } from '../api/client'
import { STORAGE_KEYS, storage } from '../lib/storage'
import { I18nContext, initialLang, type I18nValue } from './context'
import { localName, translate, translatePlural, type Lang } from './translate'

export function I18nProvider({ children, defaultLang }: { children: ReactNode; defaultLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(() => defaultLang ?? initialLang())

  useEffect(() => {
    document.documentElement.lang = lang
    setApiLanguage(lang)
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    storage.set(STORAGE_KEYS.lang, next)
    setApiLanguage(next)
    setLangState(next)
  }, [])

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      tn: (key, count, vars) => translatePlural(lang, key, count, vars),
      name: (item) => localName(item, lang),
    }),
    [lang, setLang],
  )

  return <I18nContext value={value}>{children}</I18nContext>
}
