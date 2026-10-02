import type { BusinessStatus } from '../api/types'
import { cx } from '../lib/cx'

export function StatusBadge({ status, size = 'md' }: { status: BusinessStatus; size?: 'sm' | 'md' }) {
  const active = status === 'active'
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full font-bold ring-1 ring-inset',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs',
        active ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-slate-100 text-slate-600 ring-slate-500/20',
      )}
    >
      <span className={cx('size-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-slate-400')} />
      {active ? 'Faol' : "To'xtatilgan"}
    </span>
  )
}
