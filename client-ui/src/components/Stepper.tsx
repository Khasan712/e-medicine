import { useI18n } from '../i18n/i18n'
import { cn } from '../lib/cn'
import { Icon } from './Icon'

interface StepperProps {
  value: number
  /** Product name — part of the accessible label of the group. */
  name: string
  onIncrement: () => void
  onDecrement: () => void
  variant?: 'brand' | 'soft' | 'large'
  min?: number
  max?: number
  /** Show a bin instead of "−" when the next step removes the item. */
  trashAtMin?: boolean
  className?: string
}

const STYLES = {
  brand: {
    root: 'h-10 rounded-xl bg-brand px-1 text-brand-ink shadow-brand',
    button: 'size-8 rounded-[10px] hover:bg-white/18',
    value: 'text-[15px]',
    icon: 'size-4',
  },
  soft: {
    root: 'h-9 rounded-[11px] bg-surface-2',
    button: 'h-9 w-8 rounded-[11px] text-ink-2 hover:text-ink',
    value: 'min-w-[22px] text-[14.5px]',
    icon: 'size-4',
  },
  large: {
    root: 'h-[52px] rounded-2xl bg-surface-2 px-1',
    button: 'h-11 w-[42px] rounded-xl hover:bg-surface-3',
    value: 'min-w-7 text-[17px]',
    icon: 'size-5',
  },
} as const

export function Stepper({
  value,
  name,
  onIncrement,
  onDecrement,
  variant = 'brand',
  min = 0,
  max = 99,
  trashAtMin = false,
  className,
}: StepperProps) {
  const { t } = useI18n()
  const style = STYLES[variant]
  const removes = trashAtMin && value - 1 <= min
  return (
    <div
      role="group"
      aria-label={t('quantityOf', { name })}
      className={cn('flex shrink-0 items-center justify-between font-extrabold select-none', style.root, className)}
    >
      <button
        type="button"
        className={cn('grid place-items-center transition-[background-color,transform] active:scale-90 disabled:opacity-40', style.button)}
        onClick={onDecrement}
        disabled={value <= min}
        aria-label={removes ? t('removeFromCart') : t('decrease')}
      >
        <Icon name={removes ? 'trash' : 'minus'} className={style.icon} />
      </button>
      <output aria-live="polite" className={cn('tabular text-center', style.value)}>
        <span key={value} className="inline-block animate-[rise-in_0.22s_ease_both]">
          {value}
        </span>
      </output>
      <button
        type="button"
        className={cn('grid place-items-center transition-[background-color,transform] active:scale-90 disabled:opacity-40', style.button)}
        onClick={onIncrement}
        disabled={value >= max}
        aria-label={t('increase')}
      >
        <Icon name="plus" className={style.icon} />
      </button>
    </div>
  )
}
