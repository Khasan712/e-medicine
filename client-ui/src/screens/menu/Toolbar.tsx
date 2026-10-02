import { useEffect, useRef, type ReactNode, type Ref } from 'react'
import { Icon } from '../../components/Icon'
import { useI18n } from '../../i18n/i18n'
import { cn } from '../../lib/cn'
import type { Section } from '../../state/catalog'

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
}

export function SearchBox({ value, onChange }: SearchBoxProps) {
  const { t } = useI18n()
  const input = useRef<HTMLInputElement>(null)
  return (
    <form
      role="search"
      className="relative"
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
        className="h-[46px] w-full rounded-[15px] border-[1.5px] border-line bg-surface pr-11 pl-11 text-base outline-none transition-[border-color,box-shadow] duration-150 focus:border-brand focus:shadow-[0_0_0_4px_var(--brand-soft)]"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('')
            input.current?.focus()
          }}
          aria-label={t('clearSearch')}
          className="absolute top-1/2 right-[7px] grid size-8 -translate-y-1/2 place-items-center rounded-[10px] text-muted hover:bg-surface-2"
        >
          <Icon name="x" className="size-4" />
        </button>
      )}
    </form>
  )
}

interface CategoryChipsProps {
  sections: Section[]
  active: number | null
  onSelect: (id: number) => void
}

export function CategoryChips({ sections, active, onSelect }: CategoryChipsProps) {
  const { t, name } = useI18n()
  const scroller = useRef<HTMLDivElement>(null)

  // Keep the active chip in view (centred) while the menu scrolls.
  useEffect(() => {
    const bar = scroller.current
    const chip = bar?.querySelector<HTMLElement>(`[data-chip="${active}"]`)
    if (!bar || !chip) return
    bar.scrollTo?.({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' })
  }, [active])

  return (
    <nav aria-label={t('categories')} className="-mx-4 mt-2.5 md:-mx-6">
      <div ref={scroller} className="no-scrollbar flex gap-2 overflow-x-auto px-4 md:px-6">
        {sections.map((section) => {
          const selected = section.id === active
          return (
            <button
              key={section.id}
              type="button"
              data-chip={section.id}
              aria-current={selected || undefined}
              onClick={() => onSelect(section.id)}
              className={cn(
                'h-9 shrink-0 rounded-full border-[1.5px] px-[15px] text-sm font-bold whitespace-nowrap transition-[background-color,color,border-color] duration-200',
                selected ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink-2 hover:border-surface-3',
              )}
            >
              {section.category ? name(section.category) : t('other')}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export function Toolbar({ ref, children }: { ref?: Ref<HTMLDivElement>; children: ReactNode }) {
  return (
    <div
      ref={ref}
      className="sticky top-[calc(var(--header-h)+var(--safe-top))] z-30 -mx-4 bg-bg px-4 pt-3 pb-2.5 md:-mx-6 md:px-6"
    >
      {children}
    </div>
  )
}
