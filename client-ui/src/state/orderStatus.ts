import type { Order } from '../api/types'
import type { I18n } from '../i18n/i18n'
import type { MessageKey } from '../i18n/messages'
import type { IconName } from '../components/Icon'

export type OrderLike = Pick<Order, 'status' | 'delivery_type'>

export const isPickup = (order: OrderLike) => order.delivery_type === 'pickup'

export function statusLabel(order: OrderLike, t: I18n['t']): string {
  if (order.status === 'completed' && isPickup(order)) return t('status_completed_pickup')
  return t(`status_${order.status}` as MessageKey)
}

export function statusText(order: OrderLike, t: I18n['t']): string {
  if (order.status === 'rejected') return t('rejectedText')
  if (isPickup(order) && (order.status === 'ordered' || order.status === 'completed')) {
    return t(order.status === 'ordered' ? 'statusText_ordered_pickup' : 'statusText_completed_pickup')
  }
  return t(`statusText_${order.status}` as MessageKey)
}

export function statusIcon(order: OrderLike): IconName {
  switch (order.status) {
    case 'ordered':
      return 'chef-hat'
    case 'on_the_way':
      return 'bike'
    case 'completed':
      return isPickup(order) ? 'bag' : 'home'
    default:
      return 'ban'
  }
}

