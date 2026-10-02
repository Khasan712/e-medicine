import type { OrderStatus as Status } from '../api/types'
import { useI18n } from '../i18n/i18n'
import type { MessageKey } from '../i18n/messages'
import { cn } from '../lib/cn'
import { isPickup, statusLabel, type OrderLike } from '../state/orderStatus'
import { orderSteps, stepState } from '../state/orders'
import { Icon, type IconName } from './Icon'

const PILL: Record<Status, string> = {
  ordered: 'bg-blue-soft text-blue',
  on_the_way: 'bg-amber-soft text-amber',
  completed: 'bg-green-soft text-green',
  rejected: 'bg-red-soft text-red',
}

export function StatusPill({ order, className }: { order: OrderLike; className?: string }) {
  const { t } = useI18n()
  return (
    <span
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-[11px] text-[12.5px] font-extrabold whitespace-nowrap',
        PILL[order.status],
        className,
      )}
    >
      <span aria-hidden="true" className={cn('size-[7px] rounded-full bg-current', order.status === 'on_the_way' && 'live-dot')} />
      {statusLabel(order, t)}
    </span>
  )
}

function stepIcon(order: OrderLike, step: Status): IconName {
  if (step === 'ordered') return order.status === 'ordered' ? 'chef-hat' : 'receipt'
  if (step === 'on_the_way') return 'bike'
  return isPickup(order) ? 'bag' : 'check'
}

/** ordered → on the way → delivered (pickup: ordered → handed over). */
export function OrderTracker({ order, className }: { order: OrderLike; className?: string }) {
  const { t } = useI18n()
  const steps = orderSteps(order)
  return (
    <ol aria-label={t('orderProgress')} className={cn('flex items-start', className)}>
      {steps.map((step, index) => {
        const state = stepState(order, step)
        const label = step === 'completed' && isPickup(order) ? t('status_completed_pickup') : t(`status_${step}` as MessageKey)
        return (
          <li
            key={step}
            aria-current={state === 'current' ? 'step' : undefined}
            data-state={state}
            className="relative flex flex-1 flex-col items-center gap-2 text-center text-xs font-bold"
          >
            {index > 0 && (
              <span aria-hidden="true" className="absolute top-[17px] right-1/2 h-[3px] w-full overflow-hidden rounded-full bg-surface-2">
                <span
                  className={cn(
                    'block h-full bg-green transition-[width] duration-700 ease-smooth',
                    state === 'upcoming' ? 'w-0' : 'w-full',
                  )}
                />
              </span>
            )}
            <span className={cn('relative z-[1] rounded-full', state === 'current' && 'pulse-ring text-brand')}>
              <span
                className={cn(
                  'grid size-9 place-items-center rounded-full transition-[background-color,color,box-shadow] duration-300',
                  state === 'done' && 'bg-green text-white',
                  state === 'current' && 'bg-brand text-brand-ink shadow-[0_0_0_6px_var(--brand-soft)]',
                  state === 'upcoming' && 'bg-surface-2 text-muted',
                )}
              >
                <Icon name={state === 'done' && step !== 'completed' ? 'check' : stepIcon(order, step)} className="size-[17px]" />
              </span>
            </span>
            <span className={state === 'upcoming' ? 'text-muted' : 'text-ink'}>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
