import { useI18n } from '../i18n/i18n'
import { haptic } from '../lib/telegram'
import { useCart, type CartLine } from '../state/cart'
import { useNav } from '../state/nav'
import { Icon } from './Icon'
import { ProductImage } from './ProductImage'
import { Stepper } from './Stepper'

/** Lines of the cart with steppers (sheet on phones, side panel on desktop). */
export function CartLines({ lines }: { lines: CartLine[] }) {
  const { name, money } = useI18n()
  const cart = useCart()
  const { openSheet } = useNav()
  return (
    <ul className="-mx-2">
      {lines.map(({ product, qty, total }) => {
        const title = name(product)
        return (
          <li key={product.id} className="flex animate-[fade-in_0.2s_ease_both] items-center gap-3 rounded-[14px] px-2 py-2.5">
            <button
              type="button"
              onClick={() => openSheet({ type: 'product', id: product.id })}
              aria-label={title}
              className="size-[58px] shrink-0 overflow-hidden rounded-[14px]"
            >
              <ProductImage src={product.image} name={title} className="size-full" letterClassName="text-xl" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14.5px] font-bold">{title}</div>
              <div className="tabular mt-0.5 text-[13.5px] font-bold text-muted">{money(total)}</div>
            </div>
            <Stepper
              variant="soft"
              value={qty}
              name={title}
              trashAtMin
              onIncrement={() => {
                cart.increment(product.id)
                haptic('light')
              }}
              onDecrement={() => {
                cart.decrement(product.id)
                haptic('select')
              }}
            />
          </li>
        )
      })}
    </ul>
  )
}

/** Minimum-order progress and the total. */
export function CartSummary() {
  const { t, money } = useI18n()
  const { total, minOrder, left } = useCart()
  const progress = minOrder > 0 ? Math.min(100, Math.round((total / minOrder) * 100)) : 100
  return (
    <div>
      {left > 0 && (
        <div className="mb-3 rounded-xl bg-amber-soft px-3 py-2.5 text-[13px] font-bold text-amber">
          <div className="flex items-start gap-2">
            <Icon name="info" className="mt-px size-4" />
            <span>{t('minOrderLeft', { min: money(minOrder), left: money(left) })}</span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--amber)_20%,transparent)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={minOrder}
            aria-valuenow={total}
            aria-label={t('minOrderChip', { amount: money(minOrder) })}
          >
            <div className="h-full rounded-full bg-amber transition-[width] duration-500 ease-smooth" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      <div className="mb-3.5 flex items-baseline justify-between text-xl font-extrabold tracking-[-0.02em]">
        <span>{t('total')}</span>
        <span className="tabular" data-testid="cart-total">
          {money(total)}
        </span>
      </div>
    </div>
  )
}
