import { useI18n } from '../../i18n/context'
import { cn } from '../../lib/cn'
import { formatNumber } from '../../lib/format'
import { pageList } from '../../lib/pagination'
import { IconChevronLeft, IconChevronRight } from '../icons'

interface PaginationProps {
  page: number
  pages: number
  count: number
  pageSize: number
  onPageChange: (page: number) => void
  className?: string
}

export function Pagination({ page, pages, count, pageSize, onPageChange, className }: PaginationProps) {
  const { t } = useI18n()
  if (count <= 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(count, page * pageSize)

  const arrow =
    'inline-flex size-9 items-center justify-center rounded-lg border border-line-strong bg-card text-fg-soft shadow-xs transition-colors hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40'

  return (
    <nav
      aria-label={t('page_of', { page, pages })}
      className={cn('flex flex-col items-center justify-between gap-3 border-t border-line px-5 py-3.5 sm:flex-row', className)}
    >
      <p className="text-[13px] text-muted tabular">
        {t('showing_range', { from: formatNumber(from), to: formatNumber(to), count: formatNumber(count) })}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={arrow}
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label={t('previous')}
          >
            <IconChevronLeft size={18} />
          </button>
          <span className="px-2 text-[13px] font-medium text-fg-soft tabular sm:hidden">
            {page} / {pages}
          </span>
          <div className="hidden items-center gap-1 sm:flex">
            {pageList(page, pages).map((item, index) =>
              item === 'gap' ? (
                <span key={`gap-${index}`} className="w-6 text-center text-faint" aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPageChange(item)}
                  aria-current={item === page ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-[13px] font-semibold tabular transition-colors',
                    item === page
                      ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/25 dark:bg-primary-500'
                      : 'text-fg-soft hover:bg-subtle hover:text-fg',
                  )}
                >
                  {item}
                </button>
              ),
            )}
          </div>
          <button
            type="button"
            className={arrow}
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pages}
            aria-label={t('next')}
          >
            <IconChevronRight size={18} />
          </button>
        </div>
      )}
    </nav>
  )
}
