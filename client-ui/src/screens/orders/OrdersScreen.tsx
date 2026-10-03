import { Link } from 'react-router'
import type { Order } from '../../api/types'
import { Button, IconButton } from '../../components/Button'
import { PageTitle } from '../../components/Card'
import { EmptyState, Skeleton } from '../../components/EmptyState'
import { StatusPill } from '../../components/OrderStatus'
import { ProductImage } from '../../components/ProductImage'
import { useI18n } from '../../i18n/i18n'
import { cn } from '../../lib/cn'
import { errorMessageKey } from '../../lib/errors'
import { useAuth } from '../../state/auth'
import { useDocumentTitle } from '../../state/hooks'
import { useNav } from '../../state/nav'
import { isActiveOrder, useOrders } from '../../state/orders'

export function OrdersScreen() {
  const { t } = useI18n()
  useDocumentTitle(t('orders'))
  const { token, status } = useAuth()
  const { openSheet, go } = useNav()
  const orders = useOrders({ poll: true })

  const refresh = token ? (
    <IconButton
      icon="refresh"
      label={t('refresh')}
      onClick={() => void orders.refetch()}
      iconClassName={cn(orders.isFetching && 'animate-spin')}
    />
  ) : null

  let content
  if (!token && status === 'ready') {
    content = (
      <EmptyState
        icon="lock"
        tone="brand"
        title={t('ordersSignIn')}
        text={t('loginPrompt')}
        action={
          <Button size="md" iconRight="arrow-right" onClick={() => openSheet({ type: 'auth' })}>
            {t('login')}
          </Button>
        }
      />
    )
  } else if (!orders.data && (status === 'loading' || orders.isPending) && !orders.isError) {
    content = (
      <div className="grid gap-3 md:grid-cols-2" aria-busy="true">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[150px] rounded-[20px]" />
        ))}
      </div>
    )
  } else if (!orders.data) {
    content = (
      <EmptyState
        icon="wifi-off"
        title={t('ordersError')}
        text={t(errorMessageKey(orders.error))}
        action={
          <Button variant="dark" size="md" icon="refresh" onClick={() => void orders.refetch()}>
            {t('retry')}
          </Button>
        }
      />
    )
  } else if (!orders.data.length) {
    content = (
      <EmptyState
        icon="receipt"
        title={t('ordersEmpty')}
        text={t('ordersEmptyText')}
        action={
          <Button size="md" onClick={() => go('/')}>
            {t('toMenu')}
          </Button>
        }
      />
    )
  } else {
    const active = orders.data.filter(isActiveOrder)
    const past = orders.data.filter((order) => !isActiveOrder(order))
    content = (
      <div className="space-y-6">
        {active.length > 0 && <OrderGroup id="active-orders" title={t('activeOrders')} orders={active} />}
        {past.length > 0 && <OrderGroup id="past-orders" title={active.length ? t('pastOrders') : undefined} orders={past} />}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[880px] pb-12">
      <PageTitle actions={refresh}>{t('orders')}</PageTitle>
      {content}
    </div>
  )
}

function OrderGroup({ id, title, orders }: { id: string; title?: string; orders: Order[] }) {
  return (
    <section aria-labelledby={title ? id : undefined}>
      {title && (
        <h2 id={id} className="mb-3 text-xs font-extrabold tracking-[0.08em] text-muted uppercase">
          {title}
        </h2>
      )}
      <ul className="grid gap-3 md:grid-cols-2">
        {orders.map((order) => (
          <li key={order.id}>
            <OrderCard order={order} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function OrderCard({ order }: { order: Order }) {
  const { t, name, money, date } = useI18n()
  const thumbs = order.items.slice(0, 4)
  return (
    <Link
      to={`/orders/${order.id}`}
      className={cn(
        'flex animate-rise-in flex-col gap-3 rounded-[20px] border border-line bg-surface p-4 shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-card',
        isActiveOrder(order) && 'border-[color-mix(in_srgb,var(--brand)_35%,var(--line))]',
      )}
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="min-w-0">
          <div className="text-[16.5px] font-extrabold tracking-[-0.01em]">{t('orderNo', { id: order.id })}</div>
          <div className="mt-0.5 text-[13px] font-semibold text-muted">{date(order.created_at)}</div>
        </div>
        <StatusPill order={order} />
      </div>
      <p className="line-clamp-1 text-[13.5px] text-ink-2">
        {order.items.map((item) => `${name(item)} × ${item.quantity}`).join(', ')}
      </p>
      <div className="flex items-center justify-between gap-3">
        <div className="flex">
          {thumbs.map((item, index) => (
            <ProductImage
              key={`${item.product_id}-${index}`}
              src={item.image}
              name={name(item)}
              className={cn('size-10 rounded-[13px] border-[2.5px] border-surface', index > 0 && '-ml-2.5')}
              letterClassName="text-sm"
            />
          ))}
          {order.items.length > 4 && (
            <span className="-ml-2.5 grid size-10 place-items-center rounded-[13px] border-[2.5px] border-surface bg-surface-2 text-xs font-extrabold text-ink-2">
              +{order.items.length - 4}
            </span>
          )}
        </div>
        <span className="tabular text-[17px] font-extrabold">{money(order.total)}</span>
      </div>
    </Link>
  )
}
