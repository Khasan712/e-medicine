import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { TONES, type Tone } from './styles'

interface BadgeProps {
  tone?: Tone
  dot?: boolean
  size?: 'xs' | 'sm' | 'md'
  className?: string
  children: ReactNode
  title?: string
}

const SIZES = {
  xs: 'px-1.5 py-px text-[10.5px] gap-1',
  sm: 'px-2 py-0.5 text-xs gap-1.5',
  md: 'px-2.5 py-1 text-[13px] gap-1.5',
}

export function Badge({ tone = 'gray', dot, size = 'sm', className, children, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full font-semibold ring-1 ring-inset',
        SIZES[size],
        TONES[tone].badge,
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 shrink-0 rounded-full', TONES[tone].dot)} aria-hidden="true" />}
      {children}
    </span>
  )
}

/** Small gradient "AI" / "NEW" marker. */
export function AiBadge({ children = 'AI', className }: { children?: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md bg-linear-to-r from-ai-1 to-ai-3 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white',
        className,
      )}
    >
      {children}
    </span>
  )
}
