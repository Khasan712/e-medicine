import { useId } from 'react'
import type { Product } from '../../api/types'
import { Icon } from '../../components/Icon'
import { ProductImage } from '../../components/ProductImage'
import { Stepper } from '../../components/Stepper'
import { useI18n } from '../../i18n/i18n'
import { cn } from '../../lib/cn'
import { haptic } from '../../lib/telegram'
import { useCart } from '../../state/cart'
import { useNav } from '../../state/nav'

interface ProductCardProps {
  product: Product
  top?: boolean
  className?: string
}

export function ProductCard({ product, top = false, className }: ProductCardProps) {
  const { t, name, unit, money } = useI18n()
  const cart = useCart()
  const { openSheet } = useNav()
  const nameId = useId()
  const title = name(product)
  const qty = cart.quantity(product.id)
  const unitName = unit(product)

  const open = () => openSheet({ type: 'product', id: product.id })
  const add = () => {
    cart.increment(product.id)
    haptic('light')
  }
  const remove = () => {
    cart.decrement(product.id)
    haptic('select')
  }

  return (
    <article
      aria-label={title}
      className={cn(
        'group flex flex-col rounded-[20px] border border-line bg-surface p-2 shadow-sm transition-[transform,box-shadow] duration-200 ease-smooth hover:-translate-y-0.5 hover:shadow-card',
        className,
      )}
    >
      <button type="button" onClick={open} className="flex flex-1 flex-col rounded-[14px] text-left" aria-labelledby={nameId}>
        <span className="relative block aspect-square w-full overflow-hidden rounded-[14px]">
          <ProductImage
            src={product.image}
            name={title}
            className="size-full transition-transform duration-500 ease-smooth group-hover:scale-[1.045]"
          />
          {top && (
            <span className="absolute top-2 left-2 inline-flex h-6 items-center gap-0.5 rounded-full bg-white/94 px-2 text-[11.5px] font-extrabold text-[#16161a] shadow-sm">
              <Icon name="flame" className="size-[13px] fill-current text-brand" strokeWidth={1.5} />
              {t('top')}
            </span>
          )}
          {qty > 0 && (
            <span className="tabular absolute top-2 right-2 grid h-[26px] min-w-[26px] animate-pop-in place-items-center rounded-full bg-brand px-[7px] text-[12.5px] font-extrabold text-brand-ink shadow-brand">
              {qty}
            </span>
          )}
        </span>
        <span className="flex flex-1 flex-col gap-0.5 px-1 pt-2.5 pb-0.5">
          <span className="tabular text-[16.5px] font-extrabold tracking-[-0.015em]">{money(product.price)}</span>
          <span id={nameId} className="line-clamp-2 min-h-[2.9em] text-sm leading-[1.45] font-semibold text-ink-2">
            {title}
          </span>
          {unitName && <span className="text-[12.5px] font-semibold text-muted">{t('perUnit', { unit: unitName })}</span>}
        </span>
      </button>
      {qty === 0 ? (
        <button
          type="button"
          onClick={add}
          aria-describedby={nameId}
          className="mt-2 flex h-10 items-center justify-center gap-1.5 rounded-xl bg-surface-2 text-sm font-extrabold transition-[background-color,transform] duration-150 hover:bg-surface-3 active:scale-[0.97]"
        >
          <Icon name="plus" className="size-4" />
          {t('add')}
        </button>
      ) : (
        <Stepper
          className="mt-2 animate-[fade-in_0.18s_ease_both]"
          value={qty}
          name={title}
          onIncrement={add}
          onDecrement={remove}
        />
      )}
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-[20px] border border-line bg-surface p-2" aria-hidden="true">
      <div className="skeleton aspect-square" />
      <div className="skeleton mx-1 mt-3 mb-1.5 h-4 w-3/5" />
      <div className="skeleton mx-1 mb-3 h-3 w-4/5" />
      <div className="skeleton h-10 rounded-xl" />
    </div>
  )
}
