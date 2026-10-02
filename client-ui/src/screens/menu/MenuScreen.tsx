import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Icon, type IconName } from '../../components/Icon'
import { useI18n } from '../../i18n/i18n'
import { cn } from '../../lib/cn'
import { errorMessageKey } from '../../lib/errors'
import { prefersReducedMotion } from '../../lib/motion'
import { haptic } from '../../lib/telegram'
import { useMainButton } from '../../lib/useTelegram'
import { useCart } from '../../state/cart'
import { searchProducts, useCatalog } from '../../state/catalog'
import { useDocumentTitle } from '../../state/hooks'
import { useNav } from '../../state/nav'
import { CartPanel } from './CartPanel'
import { Hero, HeroSkeleton } from './Hero'
import { ProductCard, ProductCardSkeleton } from './ProductCard'
import { CategoryChips, SearchBox, Toolbar } from './Toolbar'

function SectionTitle({ id, icon, title, count }: { id?: string; icon?: IconName; title: string; count?: number }) {
  return (
    <h2 id={id} className="mb-3 flex items-baseline gap-2 text-[21px] font-extrabold tracking-[-0.025em]">
      {icon && <Icon name={icon} className="size-5 self-center text-brand-text" />}
      {title}
      {count !== undefined && <small className="tabular text-[13px] font-bold tracking-normal text-muted">{count}</small>}
    </h2>
  )
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">{children}</div>
}

/** A horizontal row of cards: swipe on phones, arrow buttons with a mouse. */
function Rail({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const scroller = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: true, end: true })

  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const update = () =>
      setEdges({
        start: element.scrollLeft <= 4,
        end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 4,
      })
    update()
    element.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      element.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const page = (direction: 1 | -1) => {
    const element = scroller.current
    element?.scrollBy?.({ left: direction * element.clientWidth * 0.8, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  const arrow = 'absolute top-[38%] z-[2] hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface text-ink shadow-card transition-transform hover:scale-105 md:grid'
  return (
    <div className="relative">
      <div
        ref={scroller}
        className="no-scrollbar -mx-4 grid snap-x snap-mandatory scroll-px-4 auto-cols-[minmax(150px,44%)] grid-flow-col gap-3 overflow-x-auto px-4 pb-1 sm:auto-cols-[minmax(180px,30%)] sm:gap-4 md:-mx-6 md:scroll-px-6 md:px-6 xl:auto-cols-[calc(25%-12px)] [&>*]:snap-start"
      >
        {children}
      </div>
      {!edges.start && (
        <button type="button" aria-label={t('previous')} onClick={() => page(-1)} className={cn(arrow, '-left-3')}>
          <Icon name="chevron-left" />
        </button>
      )}
      {!edges.end && (
        <button type="button" aria-label={t('next')} onClick={() => page(1)} className={cn(arrow, '-right-3')}>
          <Icon name="chevron-right" />
        </button>
      )}
    </div>
  )
}

function CatalogSkeleton() {
  return (
    <section className="mt-6" aria-busy="true">
      <div className="skeleton mb-3.5 h-6 w-40" />
      <Grid>
        {Array.from({ length: 8 }, (_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </Grid>
    </section>
  )
}

export function MenuScreen() {
  const { t, name, money } = useI18n()
  useDocumentTitle()
  const catalog = useCatalog()
  const cart = useCart()
  const { openSheet } = useNav()
  const [search, setSearch] = useState('')
  const query = useDeferredValue(search)
  const results = useMemo(() => searchProducts(catalog.products, query), [catalog.products, query])
  const [active, setActive] = useState<number | null>(null)
  const toolbar = useRef<HTMLDivElement>(null)
  const ignoreSpyUntil = useRef(0)
  const popularIds = useMemo(() => new Set(catalog.popular.map((product) => product.id)), [catalog.popular])
  const searching = results !== null
  const activeId = active ?? catalog.sections[0]?.id ?? null

  const stickyOffset = useCallback(() => {
    const header = document.querySelector('header')?.getBoundingClientRect().height ?? 64
    const bar = toolbar.current?.getBoundingClientRect().height ?? 100
    return header + bar
  }, [])

  // Scroll-spy: the category whose section is at the top becomes the active chip.
  useEffect(() => {
    if (searching || catalog.sections.length < 2 || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < ignoreSpyUntil.current) return
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const first = visible[0]
        if (first) setActive(Number((first.target as HTMLElement).dataset.section))
      },
      { rootMargin: `-${Math.round(stickyOffset())}px 0px -55% 0px` },
    )
    document.querySelectorAll('[data-section]').forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [searching, catalog.sections, stickyOffset])

  // Telegram: the cart lives in the MainButton.
  useMainButton(
    cart.count > 0
      ? {
          text: `${t('cart')} · ${t('itemsCount', { count: cart.count })} · ${money(cart.total)}`,
          onClick: () => openSheet({ type: 'cart' }),
        }
      : null,
  )

  const scrollToSection = (id: number) => {
    const section = document.querySelector<HTMLElement>(`[data-section="${id}"]`)
    setActive(id)
    haptic('select')
    if (!section) return
    ignoreSpyUntil.current = Date.now() + 900
    window.scrollTo({
      top: section.getBoundingClientRect().top + window.scrollY - stickyOffset() - 8,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }

  let content: ReactNode
  if (catalog.status === 'loading') {
    content = <CatalogSkeleton />
  } else if (catalog.status === 'error') {
    content = (
      <EmptyState
        icon="wifi-off"
        title={t('loadError')}
        text={t(errorMessageKey(catalog.error))}
        action={
          <Button variant="dark" size="md" icon="refresh" onClick={catalog.refetch}>
            {t('retry')}
          </Button>
        }
      />
    )
  } else if (results) {
    content = (
      <section className="mt-5" aria-labelledby="search-results">
        <SectionTitle id="search-results" title={t('results')} count={results.length} />
        {results.length ? (
          <Grid>
            {results.map((product) => (
              <ProductCard key={product.id} product={product} top={popularIds.has(product.id)} />
            ))}
          </Grid>
        ) : (
          <EmptyState icon="search" title={t('nothingFound')} text={t('nothingFoundText', { query: search.trim() })} />
        )}
      </section>
    )
  } else if (!catalog.products.length) {
    content = <EmptyState icon="utensils" tone="brand" title={t('emptyMenu')} text={t('emptyMenuText')} />
  } else {
    content = (
      <>
        {catalog.popular.length > 0 && (
          <section className="mt-5" aria-labelledby="popular-title">
            <SectionTitle id="popular-title" icon="flame" title={t('popular')} />
            <Rail>
              {catalog.popular.map((product) => (
                <ProductCard key={product.id} product={product} top />
              ))}
            </Rail>
          </section>
        )}
        {catalog.sections.map((section) => (
          <section key={section.id} data-section={section.id} className="mt-6" aria-labelledby={`section-${section.id}`}>
            <SectionTitle
              id={`section-${section.id}`}
              title={section.category ? name(section.category) : t('other')}
              count={section.products.length}
            />
            <Grid>
              {section.products.map((product) => (
                <ProductCard key={product.id} product={product} top={popularIds.has(product.id)} />
              ))}
            </Grid>
          </section>
        ))}
      </>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-7 pb-32 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-14 tg:pb-10">
      <div className="min-w-0">
        {catalog.status === 'ready' ? <Hero /> : catalog.status === 'loading' ? <HeroSkeleton /> : null}
        {catalog.status !== 'error' && (
          <Toolbar ref={toolbar}>
            <SearchBox value={search} onChange={setSearch} />
            {!searching && catalog.sections.length > 1 && (
              <CategoryChips sections={catalog.sections} active={activeId} onSelect={scrollToSection} />
            )}
          </Toolbar>
        )}
        {content}
      </div>
      <aside className="hidden lg:sticky lg:top-[calc(var(--header-h)+var(--safe-top)+16px)] lg:block lg:self-start">
        <CartPanel />
      </aside>
    </div>
  )
}
