import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../i18n/context'
import { cn } from '../../lib/cn'
import { IconX } from '../icons'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Open modals, topmost last — only the topmost one reacts to Escape / Tab. */
const stack: symbol[] = []
let lockedScroll = 0

function lockScroll() {
  if (lockedScroll++ === 0) {
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`
  }
}

function unlockScroll() {
  if (--lockedScroll === 0) {
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  }
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Escape / backdrop / × close the dialog (off while a request is running). */
  dismissible?: boolean
  initialFocus?: RefObject<HTMLElement | null>
  icon?: ReactNode
  /** Centered layout for confirmations and short messages. */
  centered?: boolean
  className?: string
}

const WIDTHS = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
  initialFocus,
  icon,
  centered,
  className,
}: ModalProps) {
  const { t } = useI18n()
  const panelRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const latest = useRef({ onClose, dismissible, initialFocus })

  useEffect(() => {
    latest.current = { onClose, dismissible, initialFocus }
  })

  useEffect(() => {
    if (!open) return
    const token = Symbol('modal')
    stack.push(token)
    const previouslyFocused = document.activeElement as HTMLElement | null
    lockScroll()

    const panel = panelRef.current
    const focusTarget =
      latest.current.initialFocus?.current ??
      panel?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(focusTarget ?? panel)?.focus({ preventScroll: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token) return
      if (event.key === 'Escape') {
        event.stopPropagation()
        if (latest.current.dismissible) latest.current.onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => !element.closest('[hidden], [aria-hidden="true"]'),
      )
      if (!items.length) {
        event.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      const index = stack.indexOf(token)
      if (index >= 0) stack.splice(index, 1)
      unlockScroll()
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus({ preventScroll: true })
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-slate-950/50 backdrop-blur-[2px]"
        aria-hidden="true"
        onMouseDown={() => {
          if (dismissible) onClose()
        }}
      />
      <dialog
        open
        ref={panelRef}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative m-0 flex max-h-[min(92dvh,52rem)] w-full max-w-none flex-col overflow-hidden rounded-t-3xl border border-line bg-card p-0 text-fg shadow-pop outline-none',
          'animate-slide-up sm:animate-pop-in sm:rounded-2xl',
          WIDTHS[size],
          className,
        )}
      >
        <div
          className={cn(
            'flex gap-4 px-5 pt-5 sm:px-6',
            centered ? 'flex-col items-center text-center' : description ? 'items-start' : 'items-center',
          )}
        >
          {icon}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold leading-snug text-fg">
              {title}
            </h2>
            {description && (
              <div id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-muted">
                {description}
              </div>
            )}
          </div>
          {dismissible && !centered && (
            <button
              type="button"
              onClick={onClose}
              className={cn(
                '-mr-2 flex size-9 shrink-0 items-center justify-center rounded-xl text-faint transition-colors hover:bg-subtle hover:text-fg',
                description ? '-mt-1' : null,
              )}
              aria-label={t('close')}
            >
              <IconX size={20} />
            </button>
          )}
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-1 pt-4 sm:px-6">{children}</div>}
        {footer && (
          <div
            className={cn(
              'mt-4 flex flex-col-reverse gap-2 border-t border-line bg-subtle/40 px-5 py-4 sm:flex-row sm:px-6',
              centered ? 'sm:justify-center' : 'sm:justify-end',
            )}
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
        {!footer && <div className="h-5" />}
      </dialog>
    </div>,
    document.body,
  )
}
