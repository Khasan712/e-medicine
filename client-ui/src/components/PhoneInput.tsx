import { useCallback, useRef, type FormEvent, type Ref } from 'react'
import { cn } from '../lib/cn'
import { useFocusOnMount } from '../lib/focus'
import { formatLocalPhone, localDigits } from '../lib/format'

interface PhoneInputProps {
  id?: string
  /** Local digits (up to 9), without +998. */
  value: string
  onChange: (digits: string) => void
  invalid?: boolean
  size?: 'lg' | 'md'
  /** Focus the input when it appears (the current step of a dialog). */
  focusOnMount?: boolean
  label?: string
  describedBy?: string
  ref?: Ref<HTMLInputElement>
}

/** Uzbek phone number: a fixed "+998" prefix and 9 digits shown as "90 123 45 67". */
export function PhoneInput({ id, value, onChange, invalid, size = 'md', focusOnMount = false, label, describedBy, ref }: PhoneInputProps) {
  const input = useRef<HTMLInputElement | null>(null)
  const setRefs = useCallback(
    (element: HTMLInputElement | null) => {
      input.current = element
      if (typeof ref === 'function') ref(element)
      else if (ref) ref.current = element
    },
    [ref],
  )
  useFocusOnMount(input, focusOnMount)

  const onInput = (event: FormEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const raw = input.value
    const caret = input.selectionStart ?? raw.length
    const digitsBeforeCaret = Math.min(9, localDigits(raw.slice(0, caret)).length)
    const digits = localDigits(raw)
    onChange(digits)
    // Keep the caret after the same digit once the value is re-formatted.
    requestAnimationFrame(() => {
      if (document.activeElement !== input) return
      const formatted = formatLocalPhone(digits)
      let position = 0
      let seen = 0
      while (position < formatted.length && seen < digitsBeforeCaret) {
        if (/\d/.test(formatted[position] ?? '')) seen += 1
        position += 1
      }
      input.setSelectionRange(position, position)
    })
  }

  return (
    <div
      className={cn(
        'flex items-center rounded-2xl border-[1.5px] border-transparent bg-surface-2 transition-[border-color,background-color,box-shadow] duration-150',
        'focus-within:border-brand focus-within:bg-surface focus-within:shadow-[0_0_0_4px_var(--brand-soft)]',
        size === 'lg' ? 'h-14' : 'h-[50px] rounded-[14px]',
        invalid && 'border-red! bg-red-soft focus-within:shadow-[0_0_0_4px_var(--red-soft)]',
      )}
    >
      <span className={cn('pr-1 pl-3.5 font-extrabold select-none', size === 'lg' ? 'text-lg' : 'text-base')} aria-hidden="true">
        +998
      </span>
      <input
        ref={setRefs}
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="90 123 45 67"
        value={formatLocalPhone(value)}
        onChange={onInput}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        maxLength={16}
        className={cn(
          'h-full min-w-0 flex-1 bg-transparent pr-3.5 font-bold tracking-[0.02em] outline-none',
          size === 'lg' ? 'text-lg' : 'text-base',
        )}
      />
    </div>
  )
}
