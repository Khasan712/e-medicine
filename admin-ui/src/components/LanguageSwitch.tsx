import { useId } from 'react'
import { useI18n } from '../i18n/context'
import type { Lang } from '../i18n/translate'
import { cn } from '../lib/cn'

const LANGS: Array<{ value: Lang; label: string; name: string }> = [
  { value: 'uz', label: 'UZ', name: "O'zbekcha" },
  { value: 'ru', label: 'RU', name: 'Русский' },
]

export function LanguageSwitch({ className, variant = 'default' }: { className?: string; variant?: 'default' | 'dark' }) {
  const { lang, setLang, t } = useI18n()
  const name = useId()
  return (
    <fieldset
      className={cn(
        'flex items-center rounded-xl p-1',
        variant === 'dark' ? 'bg-white/10 ring-1 ring-white/10' : 'bg-subtle ring-1 ring-line',
        className,
      )}
    >
      <legend className="sr-only">{t('language')}</legend>
      {LANGS.map((item) => {
        const selected = lang === item.value
        return (
          <label
            key={item.value}
            title={item.name}
            className={cn(
              'relative flex h-7 cursor-pointer items-center rounded-lg px-2.5 text-xs font-bold tracking-wide transition-all duration-150',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary-500',
              variant === 'dark'
                ? selected
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-300 hover:text-white'
                : selected
                  ? 'bg-card text-primary-600 shadow-sm ring-1 ring-line dark:bg-slate-700 dark:text-white dark:ring-slate-600'
                  : 'text-muted hover:text-fg',
            )}
          >
            <input
              type="radio"
              name={name}
              value={item.value}
              checked={selected}
              onChange={() => setLang(item.value)}
              className="sr-only"
              aria-label={item.name}
            />
            <span aria-hidden="true">{item.label}</span>
          </label>
        )
      })}
    </fieldset>
  )
}
