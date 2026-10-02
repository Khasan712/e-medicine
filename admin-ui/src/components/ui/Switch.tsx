import { cn } from '../../lib/cn'
import { Spinner } from './Spinner'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  id?: string
  disabled?: boolean
  loading?: boolean
  className?: string
  'aria-describedby'?: string
  tone?: 'primary' | 'green'
}

export function Switch({ checked, onChange, label, id, disabled, loading, className, tone = 'primary', ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      aria-describedby={rest['aria-describedby']}
      disabled={disabled || loading}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-60',
        checked ? (tone === 'green' ? 'bg-emerald-500' : 'bg-primary-600 dark:bg-primary-500') : 'bg-slate-300 dark:bg-slate-600',
        className,
      )}
    >
      <span
        className={cn(
          'flex size-5 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      >
        {loading && <Spinner size={12} className="text-slate-400" />}
      </span>
    </button>
  )
}
