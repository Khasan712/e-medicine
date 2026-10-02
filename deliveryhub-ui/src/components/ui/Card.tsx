import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { cardClass } from './styles'

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  /** Names the section for assistive technology (aria-labelledby). */
  titleId?: string
}

export function Card({ title, description, icon, titleId, className, children, ...props }: CardProps) {
  return (
    <section aria-labelledby={title ? titleId : undefined} className={cx(cardClass, 'p-5 sm:p-6', className)} {...props}>
      {title && (
        <div className="mb-4 flex min-w-0 items-start gap-3">
          {icon && (
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">{icon}</span>
          )}
          <div className="min-w-0">
            <h2 id={titleId} className="text-[17px] font-extrabold tracking-tight text-slate-900">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
        </div>
      )}
      {children}
    </section>
  )
}
