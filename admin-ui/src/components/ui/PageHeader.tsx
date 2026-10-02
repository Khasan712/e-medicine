import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useSession } from '../../auth/session'
import { cn } from '../../lib/cn'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { IconArrowLeft } from '../icons'

interface PageHeaderProps {
  title: ReactNode
  /** Browser tab title when `title` is not plain text. */
  documentTitle?: string
  description?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
  meta?: ReactNode
  className?: string
}

export function PageHeader({ title, documentTitle, description, actions, back, meta, className }: PageHeaderProps) {
  const { business } = useSession()
  useDocumentTitle(documentTitle ?? (typeof title === 'string' ? title : null), business?.name)

  return (
    <div className={cn('mb-6', className)}>
      {back && (
        <Link
          to={back.to}
          className="mb-3 inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium text-muted transition-colors hover:text-fg"
        >
          <IconArrowLeft size={16} />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-[26px]">{title}</h1>
            {meta}
          </div>
          {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
