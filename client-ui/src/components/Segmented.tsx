import { useId } from 'react'
import { cn } from '../lib/cn'
import { Icon, type IconName } from './Icon'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: IconName
}

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  size?: 'md' | 'sm'
  className?: string
}

/**
 * A segmented control with a sliding thumb. Built from native radio buttons, so arrow keys, Tab and
 * screen readers work as for any radio group.
 */
export function Segmented<T extends string>({ label, value, options, onChange, size = 'md', className }: SegmentedProps<T>) {
  const name = useId()
  const index = Math.max(0, options.findIndex((option) => option.value === value))

  return (
    <fieldset
      className={cn('relative grid min-w-0 rounded-[17px] bg-surface-2 p-[5px]', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <legend className="sr-only">{label}</legend>
      <span
        aria-hidden="true"
        className="absolute top-[5px] bottom-[5px] left-[5px] rounded-[13px] bg-thumb shadow-[0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_rgb(0_0_0/0.07)] transition-transform duration-300 ease-smooth"
        style={{
          width: `calc((100% - 10px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((option) => {
        const selected = option.value === value
        return (
          <label
            key={option.value}
            className={cn(
              'relative z-[1] flex min-w-0 cursor-pointer items-center justify-center gap-2 rounded-[13px] font-extrabold transition-colors duration-200',
              'has-[:focus-visible]:outline-[2.5px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand has-[:focus-visible]:outline-solid',
              size === 'md' ? 'h-[46px] text-sm' : 'h-9 text-[13px]',
              selected ? 'text-ink' : 'text-muted hover:text-ink-2',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.icon && (
              <Icon name={option.icon} className={cn(size === 'md' ? 'size-5' : 'size-4', selected && 'text-brand-text')} />
            )}
            <span className="truncate">{option.label}</span>
          </label>
        )
      })}
    </fieldset>
  )
}
