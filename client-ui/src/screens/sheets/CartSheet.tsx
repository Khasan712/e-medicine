import { Button } from '../../components/Button'
import { CartLines, CartSummary } from '../../components/CartLines'
import { EmptyState } from '../../components/EmptyState'
import { Sheet, SheetBody, SheetFooter, SheetGrabber, SheetHeader } from '../../components/Sheet'
import { useI18n } from '../../i18n/i18n'
import { isTelegram } from '../../lib/telegram'
import { MAIN_BUTTON_SHEET, useMainButton } from '../../lib/useTelegram'
import { useCart } from '../../state/cart'
import { useClearCart, useStartCheckout } from '../../state/hooks'
import { useNav } from '../../state/nav'

export function CartSheet() {
  const { sheet, closeSheet } = useNav()
  const open = sheet?.type === 'cart'
  return (
    <Sheet open={open} onClose={closeSheet}>
      <CartSheetContent open={open} onClose={closeSheet} />
    </Sheet>
  )
}

function CartSheetContent({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, money } = useI18n()
  const cart = useCart()
  const clear = useClearCart()
  const startCheckout = useStartCheckout()
  const inTelegram = isTelegram()
  const hasItems = cart.lines.length > 0

  useMainButton(
    open && hasItems
      ? {
          text: cart.belowMinimum ? t('minOrderChip', { amount: money(cart.minOrder) }) : `${t('checkout')} · ${money(cart.total)}`,
          onClick: startCheckout,
          disabled: cart.belowMinimum,
        }
      : null,
    MAIN_BUTTON_SHEET,
  )

  return (
    <>
      <SheetGrabber />
      <SheetHeader
        title={t('cart')}
        subtitle={cart.count ? t('itemsCount', { count: cart.count }) : undefined}
        actions={
          hasItems ? (
            <Button variant="soft" size="sm" icon="trash" onClick={clear}>
              {t('clear')}
            </Button>
          ) : null
        }
      />
      <SheetBody>
        {hasItems ? (
          <CartLines lines={cart.lines} />
        ) : (
          <EmptyState icon="bag" title={t('cartEmpty')} text={t('cartEmptyText')} className="py-8" />
        )}
      </SheetBody>
      <SheetFooter>
        {hasItems ? (
          <>
            <CartSummary showDelivery />
            {!inTelegram && (
              <Button block disabled={cart.belowMinimum} onClick={startCheckout}>
                <span className="flex-1 text-left">{t('checkout')}</span>
                <span className="tabular">{money(cart.total)}</span>
              </Button>
            )}
          </>
        ) : (
          <Button variant="soft" block onClick={onClose}>
            {t('toMenu')}
          </Button>
        )}
      </SheetFooter>
    </>
  )
}
