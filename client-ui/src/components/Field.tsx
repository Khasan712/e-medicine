import type { InputHTMLAttributes, ReactNode, Ref, TextareaHTMLAttributes } from 'react'
import { cn } from '../lib/cn'
import { Icon } from './Icon'

const CONTROL =
  'w-full rounded-[14px] border-[1.5px] border-transparent bg-surface-2 px-3.5 text-base text-ink outline-none transition-[border-color,background-color,box-shadow] duration-150 focus:border-brand focus:bg-surface focus:shadow-[0_0_0_4px_var(--brand-soft)]'
const INVALID = 'border-red! bg-red-soft focus:shadow-[0_0_0_4px_var(--red-soft)]'

interface FieldProps {
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: string
  className?: string
  children: ReactNode
}

/** Label + control + error message (announced, linked with aria-describedby by the control). */
export function Field({ id, label, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn('mb-3', className)}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-1.5 text-[13px] font-bold text-ink-2">
        {label}
        {hint && <span className="text-xs font-semibold text-muted">{hint}</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-red">
          <Icon name="alert" className="size-3.5" />
          {error}
        </p>
      )}
    </div>
  )
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  ref?: Ref<HTMLInputElement>
}

export function TextInput({ invalid, className, id, ref, ...rest }: TextInputProps) {
  return (
    <input
      ref={ref}
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && id ? `${id}-error` : undefined}
      className={cn(CONTROL, 'h-[50px]', invalid && INVALID, className)}
      {...rest}
    />
  )
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
  ref?: Ref<HTMLTextAreaElement>
}

export function TextArea({ invalid, className, id, rows = 2, ref, ...rest }: TextAreaProps) {
  return (
    <textarea
      ref={ref}
      id={id}
      rows={rows}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && id ? `${id}-error` : undefined}
      className={cn(CONTROL, 'min-h-[84px] resize-y py-3 leading-[1.45]', invalid && INVALID, className)}
      {...rest}
    />
  )
}
