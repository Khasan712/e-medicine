import { useState } from 'react'
import { cn } from '../../lib/cn'
import { initials } from '../../lib/format'

const PALETTE = [
  'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
]

function hash(text: string): number {
  let value = 0
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0
  return value
}

const SIZES = {
  xs: 'size-7 text-[11px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-20 text-2xl',
}

interface AvatarProps {
  name: string
  /** Second name part for two-letter initials. */
  secondary?: string | null
  src?: string | null
  size?: keyof typeof SIZES
  className?: string
  /** Fixed colour classes instead of the name-based palette. */
  colorClass?: string
  shape?: 'circle' | 'rounded'
}

export function Avatar({ name, secondary, src, size = 'md', className, colorClass, shape = 'circle' }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const radius = shape === 'circle' ? 'rounded-full' : 'rounded-xl'
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        className={cn('shrink-0 object-cover', SIZES[size], radius, className)}
        loading="lazy"
        decoding="async"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center font-semibold',
        SIZES[size],
        radius,
        colorClass ?? PALETTE[hash(name || '?') % PALETTE.length],
        className,
      )}
    >
      {initials(name, secondary)}
    </span>
  )
}
