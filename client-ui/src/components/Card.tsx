import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

interface CardProps {
  title?: ReactNode
  titleId?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}

/** A white section on the page background (checkout groups, order details, profile). */
export function Card({ title, titleId, action, className, children }: CardProps) {
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className={cn('rounded-[22px] border border-line bg-surface p-4 shadow-sm sm:p-5', className)}
    >
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && (
            <h2 id={titleId} className="text-xs font-extrabold tracking-[0.08em] text-muted uppercase">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mt-[18px] mb-4 flex items-center justify-between gap-3">
      <h1 className="text-[28px] leading-tight font-extrabold tracking-[-0.035em]">{children}</h1>
      {actions}
    </div>
  )
}
