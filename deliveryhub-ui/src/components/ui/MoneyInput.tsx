import { useLayoutEffect, useRef, type InputHTMLAttributes } from 'react'
import { inputClass } from './styles'


/** "50000" → "50 000" (plain spaces, easy to edit). */
function group(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Digits only ("" — empty). */
  value: string
  onValueChange: (digits: string) => void
  invalid?: boolean
  suffix?: string
  maxDigits?: number
}

/** An integer amount in so'm with thousands grouped while typing; the caret stays after the same digit. */
export function MoneyInput({
  value,
  onValueChange,
  invalid,
  suffix = "so'm",
  maxDigits = 9,
  className,
  ...props
}: MoneyInputProps) {
  const ref = useRef<HTMLInputElement>(null)
  const digitsBeforeCaret = useRef<number | null>(null)

  useLayoutEffect(() => {
    const input = ref.current
    const target = digitsBeforeCaret.current
    digitsBeforeCaret.current = null
    if (!input || target === null || document.activeElement !== input) return
    let position = 0
    for (let seen = 0; position < input.value.length && seen < target; position++) {
      if (/\d/.test(input.value.charAt(position))) seen++
    }
    input.setSelectionRange(position, position)
  })

  return (
    <div className="relative">
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={group(value)}
        onChange={(event) => {
          const input = event.target
          const caret = input.selectionStart ?? input.value.length
          digitsBeforeCaret.current = input.value.slice(0, caret).replace(/\D/g, '').length
          onValueChange(input.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, maxDigits))
        }}
        className={inputClass(invalid, `h-11 pr-14 text-[15px] tabular-nums ${className ?? ''}`)}
        {...props}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm font-semibold text-slate-400">
        {suffix}
      </span>
    </div>
  )
}
