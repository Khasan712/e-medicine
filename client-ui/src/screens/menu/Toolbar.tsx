import { useEffect, useRef, type ReactNode, type Ref } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { useI18n } from '../../i18n/i18n'
import { cn } from '../../lib/cn'

/** A place in the menu: the popular dishes or a category. */
export interface MenuPlace {
  key: string
  label: string
  icon?: IconName
}

interface PlacesProps {
  places: MenuPlace[]
  active: string | null
  onSelect: (key: string) => void
}

/** Categories as chips above the menu (phones and medium screens). */
export function CategoryChips({ places, active, onSelect }: PlacesProps) {
  const { t } = useI18n()
  const scroller = useRef<HTMLDivElement>(null)

  // Keep the active chip in view (centred) while the menu scrolls.
  useEffect(() => {
    const bar = scroller.current
    const chip = bar?.querySelector<HTMLElement>(`[data-chip="${active}"]`)
    if (!bar || !chip) return
    bar.scrollTo?.({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' })
  }, [active])

  return (
    <nav aria-label={t('categories')} className="-mx-4 md:-mx-6">
      <div ref={scroller} className="no-scrollbar flex gap-2 overflow-x-auto px-4 md:px-6">
        {places.map((place) => {
          const selected = place.key === active
          return (
            <button
              key={place.key}
              type="button"
              data-chip={place.key}
              aria-current={selected || undefined}
              onClick={() => onSelect(place.key)}
              className={cn(
                'h-10 shrink-0 rounded-full border px-4 text-sm font-bold whitespace-nowrap transition-[background-color,color,border-color] duration-200',
                selected ? 'border-transparent bg-brand text-brand-ink' : 'border-line bg-surface text-ink-2 hover:border-surface-3',
              )}
            >
              {place.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/** Categories as a list on the left of the menu (wide screens); stays in view while the menu scrolls. */
export function CategoryRail({ places, active, onSelect }: PlacesProps) {
  const { t } = useI18n()
  return (
    <nav
      aria-label={t('categories')}
      className="no-scrollbar sticky top-[calc(var(--header-h)+var(--safe-top)+24px)] max-h-[calc(100dvh-var(--header-h)-var(--safe-top)-48px)] self-start overflow-y-auto"
    >
      <p className="mx-3 mt-1.5 mb-2.5 text-xs font-extrabold tracking-[0.08em] text-muted uppercase">{t('menu')}</p>
      <ul className="flex flex-col gap-0.5">
        {places.map((place) => {
          const selected = place.key === active
          return (
            <li key={place.key}>
              <button
                type="button"
                aria-current={selected || undefined}
                onClick={() => onSelect(place.key)}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[14.5px] transition-colors duration-150',
                  selected ? 'bg-brand-soft font-extrabold text-brand-text' : 'font-semibold text-ink-2 hover:bg-surface-2',
                )}
              >
                {place.icon && <Icon name={place.icon} className="size-4" />}
                <span className="truncate">{place.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** The bar under the header that stays in view while the menu scrolls (the category chips). */
export function Toolbar({ ref, children }: { ref?: Ref<HTMLDivElement>; children: ReactNode }) {
  return (
    <div ref={ref} className="sticky top-[calc(var(--header-h)+var(--safe-top))] z-30 -mx-4 bg-bg px-4 pt-3.5 pb-2.5 md:-mx-6 md:px-6">
      {children}
    </div>
  )
}
