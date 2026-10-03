import { useRef } from 'react'
import { useI18n } from '../i18n/i18n'
import { cn } from '../lib/cn'
import { Icon } from './Icon'

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

/** The menu search: in the header on wide screens, above the menu on phones. */
export function SearchBox({ value, onChange, className }: SearchBoxProps) {
  const { t } = useI18n()
  const input = useRef<HTMLInputElement>(null)
  return (
    <form
      role="search"
      className={cn('relative', className)}
      onSubmit={(event) => {
        event.preventDefault()
        input.current?.blur() // hides the phone keyboard
      }}
    >
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-[15px] -translate-y-1/2 text-muted" />
      <input
        ref={input}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.preventDefault()
            onChange('')
          }
        }}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        className="h-11 w-full rounded-[14px] border border-line bg-surface pr-11 pl-11 text-[15px] font-medium outline-none transition-[border-color,box-shadow] duration-150 focus:border-brand-text focus:shadow-[0_0_0_3px_var(--brand-soft)]"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('')
            input.current?.focus()
          }}
          aria-label={t('clearSearch')}
          className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-[10px] bg-surface-2 text-ink-2 hover:bg-surface-3"
        >
          <Icon name="x" className="size-4" />
        </button>
      )}
    </form>
  )
}
