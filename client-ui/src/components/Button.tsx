import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn'
import { Icon, type IconName } from './Icon'

type Variant = 'primary' | 'soft' | 'ghost' | 'telegram' | 'danger' | 'dark' | 'outline'
type Size = 'lg' | 'md' | 'sm'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink shadow-brand hover:brightness-[1.06] disabled:shadow-none',
  soft: 'bg-surface-2 text-ink hover:bg-surface-3',
  ghost: 'text-ink-2 hover:bg-surface-2',
  telegram: 'bg-tg text-white shadow-[0_10px_24px_rgb(42_171_238/0.3)] hover:brightness-105',
  danger: 'bg-red-soft text-red hover:brightness-95',
  dark: 'bg-ink text-bg hover:opacity-90',
  outline: 'border-[1.5px] border-line bg-surface text-ink hover:border-surface-3 hover:bg-surface-2',
}

const SIZES: Record<Size, string> = {
  lg: 'h-[52px] gap-2 rounded-2xl px-5 text-[15.5px]',
  md: 'h-11 gap-2 rounded-[14px] px-4 text-[14.5px]',
  sm: 'h-9 gap-1.5 rounded-xl px-3 text-[13.5px]',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  block?: boolean
  loading?: boolean
  icon?: IconName
  iconRight?: IconName
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'lg',
  block = false,
  loading = false,
  icon,
  iconRight,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center font-extrabold tracking-[-0.01em] whitespace-nowrap',
        'transition-[transform,filter,background-color,box-shadow,opacity] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span className="spinner" aria-hidden="true" />
      ) : (
        <>
          {icon && <Icon name={icon} className={size === 'sm' ? 'size-4' : 'size-5'} />}
          {children}
          {iconRight && <Icon name={iconRight} className={size === 'sm' ? 'size-4' : 'size-5'} />}
        </>
      )}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  label: string
  variant?: 'ghost' | 'soft' | 'glass'
  size?: 'md' | 'sm'
  badge?: number
  iconClassName?: string
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  badge,
  className,
  iconClassName,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'relative grid shrink-0 place-items-center transition-[transform,background-color] duration-150 active:scale-[0.94] disabled:opacity-50',
        size === 'md' ? 'size-[42px] rounded-[13px]' : 'size-9 rounded-full',
        variant === 'ghost' && 'text-ink-2 hover:bg-surface-2',
        variant === 'soft' && 'bg-surface-2 text-ink-2 hover:bg-surface-3',
        variant === 'glass' && 'bg-white/92 text-[#16161a] shadow-card backdrop-blur hover:bg-white',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} className={iconClassName} />
      {badge ? (
        <span className="tabular absolute -top-0.5 -right-0.5 grid h-[19px] min-w-[19px] place-items-center rounded-full border-2 border-bg bg-brand px-1 text-[10.5px] font-extrabold text-brand-ink">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </button>
  )
}
