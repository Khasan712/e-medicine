import type { OrderSource, OrderStatus } from '../api/types'
import type { DictKey } from '../i18n/dict'
import type { Tone } from './ui/styles'

export const STATUS_KEYS: Record<OrderStatus, DictKey> = {
  ordered: 'status_ordered',
  on_the_way: 'status_on_the_way',
  completed: 'status_completed',
  rejected: 'status_rejected',
}

export const STATUS_TONES: Record<OrderStatus, Tone> = {
  ordered: 'blue',
  on_the_way: 'amber',
  completed: 'green',
  rejected: 'red',
}

/** Chart colours per status (same hues as the badges). */
export const STATUS_COLORS: Record<string, string> = {
  ordered: '#3b82f6',
  on_the_way: '#f59e0b',
  completed: '#10b981',
  rejected: '#ef4444',
  new: '#94a3b8',
}

export const SOURCE_KEYS: Record<OrderSource, DictKey> = {
  bot: 'source_bot',
  web: 'source_web',
  miniapp: 'source_miniapp',
  admin: 'source_admin',
}

export const SOURCE_TONES: Record<OrderSource, Tone> = {
  bot: 'sky',
  web: 'green',
  miniapp: 'indigo',
  admin: 'fuchsia',
}
