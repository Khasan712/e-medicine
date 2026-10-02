import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { Icon, type IconName } from './Icon'

interface EmptyStateProps {
  icon: IconName
  title: ReactNode
  text?: ReactNode
  action?: ReactNode
  tone?: 'neutral' | 'brand' | 'danger'
  className?: string
}

export function EmptyState({ icon, title, text, action, tone = 'neutral', className }: EmptyStateProps) {
  return (
    <div className={cn('animate-rise-in px-4 py-12 text-center', className)}>
      <div
        className={cn(
          'mx-auto mb-4 grid size-[84px] place-items-center rounded-[28px]',
          tone === 'neutral' && 'bg-surface-2 text-ink-2',
          tone === 'brand' && 'bg-brand-soft text-brand-text',
          tone === 'danger' && 'bg-red-soft text-red',
        )}
      >
        <Icon name={icon} className="size-9" strokeWidth={1.75} />
      </div>
      <h3 className="text-lg font-extrabold tracking-[-0.02em] text-ink">{title}</h3>
      {text && <p className="mx-auto mt-1.5 max-w-[300px] text-sm text-muted">{text}</p>}
      {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />
}
