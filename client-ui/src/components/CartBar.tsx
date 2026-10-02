import { useLocation } from 'react-router'
import { useI18n } from '../i18n/i18n'
import { cn } from '../lib/cn'
import { usePresence } from '../lib/motion'
import { isTelegram } from '../lib/telegram'
import { useCart } from '../state/cart'
import { useNav } from '../state/nav'
import { Icon } from './Icon'

/** The floating "cart" bar of the menu on phones (Telegram uses its MainButton instead). */
export function CartBar() {
  const { t, money } = useI18n()
  const cart = useCart()
  const { sheet, openSheet } = useNav()
  const { pathname } = useLocation()
  const visible = pathname === '/' && cart.count > 0 && sheet === null && !isTelegram()
  const { mounted, closing } = usePresence(visible, 240)
  if (!mounted) return null

  return (
    <button
      type="button"
      onClick={() => openSheet({ type: 'cart' })}
      aria-label={`${t('openCart')}: ${t('itemsCount', { count: cart.count })}, ${money(cart.total)}`}
      className={cn(
        'fixed inset-x-3 bottom-[calc(12px+var(--safe-bottom))] z-[45] mx-auto flex h-[60px] max-w-[520px] items-center gap-3 rounded-[19px] bg-brand pr-[18px] pl-2.5 font-extrabold text-brand-ink shadow-[0_14px_34px_color-mix(in_srgb,var(--brand)_45%,transparent)] transition-transform active:scale-[0.985] lg:hidden',
        closing ? 'animate-[cartbar-out_0.24s_ease-in_both]' : 'animate-[cartbar-in_0.42s_cubic-bezier(0.2,0.8,0.2,1)_both]',
      )}
    >
      <span
        key={cart.pulse}
        className="relative grid size-[42px] animate-bump place-items-center rounded-[13px] bg-[color-mix(in_srgb,var(--brand-ink)_20%,transparent)]"
      >
        <Icon name="bag" />
        <b className="tabular absolute -top-[5px] -right-1.5 grid h-[21px] min-w-[21px] place-items-center rounded-full bg-brand-ink px-[5px] text-[11.5px] text-brand">
          {cart.count}
        </b>
      </span>
      <span>{t('cart')}</span>
      <span className="tabular ml-auto flex items-center gap-1.5 text-base">
        {money(cart.total)}
        <Icon name="arrow-right" className="size-4" />
      </span>
    </button>
  )
}
