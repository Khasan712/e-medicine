import { useId } from 'react'
import type { Product } from '../../api/types'
import { Icon } from '../../components/Icon'
import { ProductImage } from '../../components/ProductImage'
import { Stepper } from '../../components/Stepper'
import { useI18n } from '../../i18n/i18n'
import { cn } from '../../lib/cn'
import { haptic } from '../../lib/telegram'
import { ROOMY_QUERY, useMediaQuery } from '../../lib/useMediaQuery'
import { useCart } from '../../state/cart'
import { useNav } from '../../state/nav'

/** The card's open-details button covers the whole card; the cart controls sit above it. */
const COVER = "text-left after:absolute after:inset-0 after:rounded-[20px] after:content-['']"

/** A control lying on a photo. */
const RAISED = 'shadow-[0_4px_14px_rgb(0_0_0/0.28)]'

function inCartFrame(qty: number) {
  return qty > 0 ? 'border-brand-text ring-1 ring-brand-text' : 'border-line'
}

interface CardControlProps {
  product: Product
  title: string
  nameId: string
  qty: number
  className?: string
}

/**
 * The round "+" of a card, which turns into a stepper in place: the stepper grows to the left and its "+"
 * lands exactly where the first one was, so a customer can keep tapping the same spot.
 */
function CardControl({ product, title, nameId, qty, className }: CardControlProps) {
  const { t } = useI18n()
  const cart = useCart()
  const add = () => {
    cart.increment(product.id)
    haptic('light')
  }
  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={add}
        aria-label={t('add')}
        aria-describedby={nameId}
        className={cn(
          'relative z-[1] grid size-11 shrink-0 place-items-center rounded-full bg-brand text-brand-ink transition-[filter,transform] duration-150 hover:brightness-110 active:scale-95',
          className,
        )}
      >
        <Icon name="plus" className="size-5" />
      </button>
    )
  }
  return (
    <Stepper
      value={qty}
      name={title}
      onIncrement={add}
      onDecrement={() => {
        cart.decrement(product.id)
        haptic('select')
      }}
      className={cn('relative z-[1] animate-[fade-in_0.18s_ease_both]', className)}
    />
  )
}

function useCard(product: Product) {
  const { name, desc, money } = useI18n()
  const cart = useCart()
  const { openSheet } = useNav()
  return {
    nameId: useId(),
    title: name(product),
    description: desc(product),
    price: money(product.price),
    qty: cart.quantity(product.id),
    open: () => openSheet({ type: 'product', id: product.id }),
  }
}

/**
 * A menu line: name, description and price on the left, the photo on the right. The "+" sits next to the price
 * where there is room; on phones it sits on the corner of the photo, so that the stepper it turns into never
 * squeezes the price of a narrow (360px) screen.
 */
export function ProductCard({ product, className }: { product: Product; className?: string }) {
  const { nameId, title, description, price, qty, open } = useCard(product)
  const roomy = useMediaQuery(ROOMY_QUERY)
  const control = <CardControl product={product} title={title} nameId={nameId} qty={qty} className={roomy ? undefined : RAISED} />
  return (
    <article
      aria-label={title}
      className={cn(
        'group relative flex gap-3.5 rounded-[20px] border bg-surface p-3 shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-smooth hover:-translate-y-0.5 hover:shadow-card',
        inCartFrame(qty),
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col pt-0.5 pl-0.5">
        <h3 id={nameId} className="text-[15.5px] leading-[1.3] font-bold tracking-[-0.01em]">
          <button type="button" onClick={open} className={COVER}>
            {title}
          </button>
        </h3>
        {description && <p className="mt-1 line-clamp-2 text-[13px] leading-[1.45] text-muted">{description}</p>}
        <div className="mt-auto flex min-h-11 items-center gap-1.5 pt-2.5">
          <span className="tabular min-w-0 flex-1 truncate text-[15.5px] font-extrabold tracking-[-0.01em]">{price}</span>
          {roomy && control}
        </div>
      </div>
      <div className="relative size-[112px] shrink-0 sm:size-[104px]">
        <ProductImage
          src={product.image}
          name={title}
          className="size-full rounded-[14px] [&_img]:transition-[opacity,transform] [&_img]:duration-500 [&_img]:ease-smooth group-hover:[&_img]:scale-[1.045]"
        />
        {!roomy && <div className="absolute right-1 bottom-1 z-[1] flex">{control}</div>}
      </div>
    </article>
  )
}

/**
 * A popular dish. Wide screens: a card with a big photo, the price and "+" under it. Phones (`compact`): a
 * small card in a swipeable row, "+" on the corner of the photo.
 */
export function FeaturedCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { nameId, title, description, price, qty, open } = useCard(product)
  if (compact) {
    return (
      <article
        aria-label={title}
        className={cn('relative flex w-[168px] shrink-0 snap-start flex-col overflow-hidden rounded-[18px] border bg-surface shadow-sm', inCartFrame(qty))}
      >
        <div className="relative h-[124px]">
          <ProductImage src={product.image} name={title} className="size-full" />
          <div className="absolute right-2 bottom-2 z-[1] flex">
            <CardControl
              product={product}
              title={title}
              nameId={nameId}
              qty={qty}
              className={RAISED}
            />
          </div>
        </div>
        <div className="px-3 pt-2.5 pb-3">
          <h3 id={nameId} className="truncate text-[14.5px] leading-[1.3] font-bold">
            <button type="button" onClick={open} className={COVER}>
              {title}
            </button>
          </h3>
          <p className="tabular mt-0.5 text-[14.5px] font-extrabold">{price}</p>
        </div>
      </article>
    )
  }
  return (
    <article
      aria-label={title}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-[20px] border bg-surface shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-smooth hover:-translate-y-0.5 hover:shadow-card',
        inCartFrame(qty),
      )}
    >
      <ProductImage
        src={product.image}
        name={title}
        className="aspect-[4/3] w-full [&_img]:transition-[opacity,transform] [&_img]:duration-500 [&_img]:ease-smooth group-hover:[&_img]:scale-[1.045]"
      />
      <div className="flex flex-1 flex-col pt-3.5 pr-3 pb-3 pl-3.5">
        <h3 id={nameId} className="text-[15.5px] leading-[1.3] font-bold tracking-[-0.01em]">
          <button type="button" onClick={open} className={COVER}>
            {title}
          </button>
        </h3>
        {description && <p className="mt-1 line-clamp-2 text-[13px] leading-[1.45] text-muted">{description}</p>}
        <div className="mt-auto flex items-center gap-1.5 pt-3">
          <span className="tabular min-w-0 flex-1 truncate text-base font-extrabold tracking-[-0.01em]">{price}</span>
          <CardControl product={product} title={title} nameId={nameId} qty={qty} />
        </div>
      </div>
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="flex gap-3.5 rounded-[20px] border border-line bg-surface p-3" aria-hidden="true">
      <div className="flex flex-1 flex-col">
        <div className="skeleton mt-1 h-4 w-3/5" />
        <div className="skeleton mt-2.5 h-3 w-4/5" />
        <div className="skeleton mt-auto h-4 w-1/3" />
      </div>
      <div className="skeleton size-[112px] shrink-0 sm:size-[104px]" />
    </div>
  )
}
