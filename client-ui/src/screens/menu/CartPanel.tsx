import { Button } from '../../components/Button'
import { CartLines, CartSummary } from '../../components/CartLines'
import { EmptyState } from '../../components/EmptyState'
import { useI18n } from '../../i18n/i18n'
import { useCart } from '../../state/cart'
import { useClearCart, useStartCheckout } from '../../state/hooks'

/** The cart next to the menu on wide screens. */
export function CartPanel() {
  const { t } = useI18n()
  const { lines, count, belowMinimum } = useCart()
  const clear = useClearCart()
  const startCheckout = useStartCheckout()

  return (
    <section
      aria-label={t('cart')}
      className="flex max-h-[calc(100dvh-var(--header-h)-32px)] flex-col overflow-hidden rounded-[28px] border border-line bg-surface shadow-card"
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-2">
        <div>
          <h2 className="text-[21px] font-extrabold tracking-[-0.025em]">{t('cart')}</h2>
          {count > 0 && <p className="text-[13px] font-semibold text-muted">{t('itemsCount', { count })}</p>}
        </div>
        {lines.length > 0 && (
          <Button variant="soft" size="sm" icon="trash" onClick={clear}>
            {t('clear')}
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">
        {lines.length ? (
          <CartLines lines={lines} />
        ) : (
          <EmptyState icon="bag" title={t('cartEmpty')} text={t('cartEmptyText')} className="py-10" />
        )}
      </div>
      {lines.length > 0 && (
        <div className="border-t border-line px-5 pt-3.5 pb-5">
          <CartSummary />
          <Button block iconRight="arrow-right" disabled={belowMinimum} onClick={startCheckout}>
            {t('checkout')}
          </Button>
        </div>
      )}
    </section>
  )
}
