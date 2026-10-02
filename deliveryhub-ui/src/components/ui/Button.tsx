import type { ButtonHTMLAttributes, Ref } from 'react'
import { cx } from '../../lib/cx'
import { Spinner } from './Spinner'
import { buttonClass, type ButtonSize, type ButtonVariant } from './styles'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  /** Shows a spinner and blocks clicks while an action runs. */
  loading?: boolean
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant,
  size,
  block,
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonClass({ variant, size, block }), className)}
      {...props}
    >
      {loading && <Spinner size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  )
}
