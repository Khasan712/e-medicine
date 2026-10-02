import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { useI18n } from '../../i18n/context'
import { cn } from '../../lib/cn'
import { IconAlert, IconChevronDown, IconEye, IconEyeOff, IconSearch, IconX } from '../icons'
import { Spinner } from './Spinner'
import { controlClass } from './styles'

export interface ControlProps {
  id: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'aria-required'?: boolean
}

interface FieldProps {
  label: ReactNode
  error?: string | null
  hint?: ReactNode
  required?: boolean
  className?: string
  /** Extra element on the right of the label (e.g. "+ New"). */
  labelAction?: ReactNode
  /** Badge next to the label (e.g. "AI"). */
  labelBadge?: ReactNode
  id?: string
  children: (props: ControlProps) => ReactNode
}

/** Label + control + hint/error, with the a11y attributes wired up. */
export function Field({ label, error, hint, required, className, labelAction, labelBadge, id, children }: FieldProps) {
  const autoId = useId()
  const controlId = id ?? `field${autoId}`
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={controlId} className="flex items-center gap-1.5 text-[13px] font-medium text-fg-soft">
          {label}
          {required && (
            <span className="text-rose-500" aria-hidden="true">
              *
            </span>
          )}
          {labelBadge}
        </label>
        {labelAction}
      </div>
      {children({
        id: controlId,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })}
      {error ? (
        <p id={errorId} className="mt-1.5 flex items-center gap-1 text-[13px] font-medium text-rose-600 dark:text-rose-400">
          <IconAlert size={14} className="shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>
  /** Element shown inside the field on the left (icon). */
  leading?: ReactNode
  /** Element shown inside the field on the right (button, unit). */
  trailing?: ReactNode
  inputSize?: 'sm' | 'md' | 'lg'
}

const INPUT_HEIGHTS = { sm: 'h-9', md: 'h-10', lg: 'h-12 text-[15px]' }

export function Input({ className, leading, trailing, inputSize = 'md', ref, ...rest }: InputProps) {
  if (!leading && !trailing) {
    return <input ref={ref} className={cn(controlClass, INPUT_HEIGHTS[inputSize], className)} {...rest} />
  }
  return (
    <div className="relative">
      {leading && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-faint">{leading}</span>
      )}
      <input
        ref={ref}
        className={cn(controlClass, INPUT_HEIGHTS[inputSize], leading ? 'pl-10' : null, trailing ? 'pr-11' : null, className)}
        {...rest}
      />
      {trailing && <span className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</span>}
    </div>
  )
}

export function Textarea({
  className,
  ref,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea ref={ref} className={cn(controlClass, 'min-h-24 resize-y py-2.5 leading-relaxed', className)} {...rest} />
}

export function Select({
  className,
  selectClassName,
  children,
  selectSize = 'md',
  ref,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  selectSize?: 'sm' | 'md'
  /** Classes of the <select> itself (`className` styles the wrapper). */
  selectClassName?: string
  ref?: Ref<HTMLSelectElement>
}) {
  return (
    <div className={cn('relative', className)}>
      <select
        ref={ref}
        className={cn(controlClass, INPUT_HEIGHTS[selectSize], 'appearance-none truncate pr-10', selectClassName)}
        {...rest}
      >
        {children}
      </select>
      <IconChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint"
      />
    </div>
  )
}

export function PasswordInput(props: Omit<InputProps, 'type' | 'trailing'>) {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)
  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="flex size-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-subtle hover:text-fg"
          aria-label={visible ? t('hide_password') : t('show_password')}
          aria-pressed={visible}
        >
          {visible ? <IconEyeOff size={18} /> : <IconEye size={18} />}
        </button>
      }
    />
  )
}

interface SearchInputProps {
  value: string
  /** Called with the trimmed value after the user stops typing. */
  onSearch: (value: string) => void
  placeholder?: string
  loading?: boolean
  delay?: number
  className?: string
  label?: string
  inputRef?: Ref<HTMLInputElement>
  shortcut?: string
}

/** Debounced search box (Escape clears it). */
export function SearchInput({
  value,
  onSearch,
  placeholder,
  loading,
  delay = 300,
  className,
  label,
  inputRef,
  shortcut,
}: SearchInputProps) {
  const { t } = useI18n()
  const [text, setText] = useState(value)
  const lastSent = useRef(value)
  const onSearchRef = useRef(onSearch)

  useEffect(() => {
    onSearchRef.current = onSearch
  })

  // Back/forward navigation or a "reset filters" button changes the value from outside.
  useEffect(() => {
    if (value !== lastSent.current) {
      lastSent.current = value
      setText(value)
    }
  }, [value])

  useEffect(() => {
    const next = text.trim()
    if (next === lastSent.current) return
    const timer = window.setTimeout(() => {
      lastSent.current = next
      onSearchRef.current(next)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [text, delay])

  return (
    <div className={cn('relative', className)}>
      <IconSearch size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
      <input
        ref={inputRef}
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && text) {
            event.stopPropagation()
            setText('')
          }
        }}
        placeholder={placeholder}
        aria-label={label ?? placeholder ?? t('search')}
        className={cn(controlClass, 'h-10 pl-10', text || loading || shortcut ? 'pr-10' : 'pr-3')}
        autoComplete="off"
        spellCheck={false}
      />
      <span className="absolute inset-y-0 right-2 flex items-center">
        {loading ? (
          <Spinner size={16} className="mr-1 text-primary-500" />
        ) : text ? (
          <button
            type="button"
            onClick={() => setText('')}
            className="flex size-7 items-center justify-center rounded-lg text-faint hover:bg-subtle hover:text-fg"
            aria-label={t('clear')}
          >
            <IconX size={16} />
          </button>
        ) : shortcut ? (
          <kbd className="pointer-events-none mr-1 rounded-md border border-line bg-subtle px-1.5 py-0.5 font-sans text-[11px] font-medium text-faint pointer-coarse:hidden">
            {shortcut}
          </kbd>
        ) : null}
      </span>
    </div>
  )
}
