import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { cardClass } from './styles'

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn(cardClass, className)} {...rest}>
      {children}
    </section>
  )
}

interface CardHeaderProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  icon?: ReactNode
  className?: string
  id?: string
}

export function CardHeader({ title, description, actions, icon, className, id }: CardHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon}
        <div className="min-w-0">
          <h2 id={id} className="truncate text-[15px] font-semibold text-fg">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('p-5', className)}>{children}</div>
}

/** Definition list row used on detail pages. */
export function InfoRow({ label, children, icon }: { label: ReactNode; children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      {icon && <span className="mt-0.5 text-faint">{icon}</span>}
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
        <dd className="mt-1 break-words text-sm text-fg">{children}</dd>
      </div>
    </div>
  )
}
