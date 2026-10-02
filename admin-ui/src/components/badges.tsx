import type { OrderSource, OrderStatus, Role } from '../api/types'
import { useI18n } from '../i18n/context'
import { formatMoney } from '../lib/format'
import { Badge } from './ui/Badge'
import { STATUS_KEYS, STATUS_TONES, SOURCE_KEYS, SOURCE_TONES } from './statusMeta'

export function StatusBadge({ status, size = 'sm' }: { status: OrderStatus | string; size?: 'xs' | 'sm' | 'md' }) {
  const { t } = useI18n()
  const key = STATUS_KEYS[status as OrderStatus]
  return (
    <Badge tone={STATUS_TONES[status as OrderStatus] ?? 'gray'} dot size={size}>
      {key ? t(key) : status}
    </Badge>
  )
}

export function SourceBadge({ source, size = 'xs' }: { source: OrderSource | string; size?: 'xs' | 'sm' | 'md' }) {
  const { t } = useI18n()
  const key = SOURCE_KEYS[source as OrderSource]
  if (!source) return null
  return (
    <Badge tone={SOURCE_TONES[source as OrderSource] ?? 'gray'} size={size}>
      {key ? t(key) : source}
    </Badge>
  )
}

export function RoleBadge({ role }: { role: Role }) {
  const { t } = useI18n()
  return <Badge tone={role === 'admin' ? 'violet' : 'blue'}>{role === 'admin' ? t('role_admin') : t('role_manager')}</Badge>
}

export function ActiveBadge({ active }: { active: boolean }) {
  const { t } = useI18n()
  return (
    <Badge tone={active ? 'green' : 'red'} dot>
      {active ? t('active') : t('inactive')}
    </Badge>
  )
}

export function Money({ value, className }: { value: number | null | undefined; className?: string }) {
  const { lang } = useI18n()
  return <span className={className ? `tabular ${className}` : 'tabular'}>{formatMoney(value, lang)}</span>
}
