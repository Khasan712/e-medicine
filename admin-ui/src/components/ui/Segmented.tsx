import { useId, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  disabled?: boolean
}

interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: Array<SegmentedOption<T>>
  /** Group name (the fieldset legend). */
  label: ReactNode
  /** Show the legend above the control (otherwise it is only announced). */
  showLabel?: boolean
  className?: string
  size?: 'sm' | 'md'
  disabled?: boolean
  /** Highlight (e.g. the AI just changed this value). */
  glow?: boolean
}

/** A native radio group styled as a segmented control (arrow keys work like in any radio group). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  showLabel = false,
  className,
  size = 'md',
  disabled,
  glow,
}: SegmentedProps<T>) {
  const name = useId()
  return (
    <fieldset className={cn('min-w-0', className)} disabled={disabled}>
      <legend
        className={cn(
          showLabel ? 'mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-fg-soft' : 'sr-only',
        )}
      >
        {label}
      </legend>
      <div
        className={cn(
          'grid gap-1 rounded-xl border border-transparent bg-subtle p-1 transition-[box-shadow,border-color] duration-300',
          glow && 'border-ai-2 ring-4 ring-ai-2/20',
        )}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const selected = option.value === value
          return (
            <label
              key={option.value}
              className={cn(
                'relative flex min-w-0 cursor-pointer select-none items-center justify-center gap-1.5 rounded-lg font-semibold transition-all duration-150',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-primary-500',
                'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60',
                size === 'sm' ? 'h-8 px-2 text-xs' : 'h-9 px-3 text-[13px]',
                selected
                  ? 'bg-card text-fg shadow-sm ring-1 ring-line dark:bg-slate-700 dark:ring-slate-600'
                  : 'text-muted hover:text-fg',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                disabled={option.disabled}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.icon}
              <span className="truncate">{option.label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
