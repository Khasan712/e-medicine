import { useCallback, useEffect, useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n/i18n'
import { cn } from '../lib/cn'
import { lockScroll, usePresence } from '../lib/motion'
import { IconButton } from './Button'
import { SheetContext, useSheet, type SheetContextValue } from './sheet-context'

const CLOSE_MS = 280
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface SheetProps {
  open: boolean
  onClose: () => void
  /** Accessible name when the sheet has no <SheetHeader title>. */
  label?: string
  wide?: boolean
  className?: string
  /** Element to focus when the sheet opens (default: the dialog itself). */
  initialFocus?: RefObject<HTMLElement | null>
  children: ReactNode
}

/** A bottom sheet on phones and a centred dialog on wider screens; closes with Esc, backdrop or drag. */
export function Sheet({ open, onClose, label, wide, className, initialFocus, children }: SheetProps) {
  const { mounted, closing } = usePresence(open, CLOSE_MS)
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const drag = useRef<{ startY: number; startTime: number; dy: number; pointerId: number } | null>(null)

  useLayoutEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const close = useCallback(() => onCloseRef.current(), [])

  // Scroll lock + focus management while open.
  useEffect(() => {
    if (!open) return
    const unlock = lockScroll()
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = requestAnimationFrame(() => {
      // Something inside (e.g. an input of the current step) may already have taken the focus.
      if (panelRef.current?.contains(document.activeElement)) return
      const target = initialFocus?.current ?? panelRef.current
      target?.focus({ preventScroll: true })
    })
    return () => {
      cancelAnimationFrame(frame)
      unlock()
      const previous = returnFocus.current
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [open, initialFocus])

  // A new open after a drag-dismiss starts from a clean state.
  useLayoutEffect(() => {
    const panel = panelRef.current
    if (open && panel) {
      panel.style.transform = ''
      panel.removeAttribute('data-dragged')
      panel.removeAttribute('data-dragging')
    }
  }, [open, mounted])

  // Esc closes; Tab stays inside the dialog.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      const panel = panelRef.current
      if (!panel) return
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => !element.closest('[hidden], [aria-hidden="true"]'),
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) {
        event.preventDefault()
        return
      }
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === panel || !panel.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  // Drag the grabber / header down to dismiss (phones).
  const dragProps: SheetContextValue['dragProps'] = {
    onPointerDown: (event) => {
      if (!open || window.matchMedia?.('(min-width: 640px)').matches) return
      if ((event.target as HTMLElement).closest('button, a, input, textarea')) return
      drag.current = { startY: event.clientY, startTime: event.timeStamp, dy: 0, pointerId: event.pointerId }
      event.currentTarget.setPointerCapture?.(event.pointerId)
      panelRef.current?.setAttribute('data-dragging', '')
    },
    onPointerMove: (event) => {
      const state = drag.current
      const panel = panelRef.current
      if (!state || !panel || state.pointerId !== event.pointerId) return
      const dy = event.clientY - state.startY
      state.dy = dy > 0 ? dy : dy / 6 // rubber band upwards
      panel.style.transform = `translateY(${state.dy}px)`
    },
    onPointerUp: (event) => {
      const state = drag.current
      const panel = panelRef.current
      drag.current = null
      if (!state || !panel) return
      panel.removeAttribute('data-dragging')
      const velocity = state.dy / Math.max(1, event.timeStamp - state.startTime)
      if (state.dy > 110 || (state.dy > 30 && velocity > 0.6)) {
        panel.setAttribute('data-dragged', '')
        panel.style.transform = 'translateY(100%)'
        close()
      } else {
        panel.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)'
        panel.style.transform = ''
        window.setTimeout(() => {
          panel.style.transition = ''
        }, 260)
      }
    },
    onPointerCancel: () => {
      drag.current = null
      const panel = panelRef.current
      if (!panel) return
      panel.removeAttribute('data-dragging')
      panel.style.transform = ''
    },
  }

  if (!mounted) return null

  return createPortal(
    <SheetContext value={{ titleId, close, dragProps }}>
      <div className="sheet-backdrop" data-closing={closing || undefined} onClick={close} aria-hidden="true" />
      <div className="sheet-layer">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          aria-labelledby={label ? undefined : titleId}
          tabIndex={-1}
          data-closing={closing || undefined}
          className={cn('sheet-panel', wide && 'sheet-wide', className)}
        >
          {children}
        </div>
      </div>
    </SheetContext>,
    document.body,
  )
}

export function SheetGrabber() {
  const { dragProps } = useSheet()
  return (
    <div className="flex shrink-0 touch-none justify-center pt-2.5 pb-1 sm:hidden" {...dragProps}>
      <div className="h-[5px] w-[42px] rounded-full bg-surface-3" />
    </div>
  )
}

interface SheetHeaderProps {
  title?: ReactNode
  subtitle?: ReactNode
  /** Rendered before the title (e.g. a back button). */
  leading?: ReactNode
  /** Rendered before the close button. */
  actions?: ReactNode
  hideClose?: boolean
  className?: string
}

export function SheetHeader({ title, subtitle, leading, actions, hideClose, className }: SheetHeaderProps) {
  const { titleId, close, dragProps } = useSheet()
  const { t } = useI18n()
  return (
    <div className={cn('flex shrink-0 touch-none items-center gap-3 px-5 pt-3 pb-2', className)} {...dragProps}>
      {leading}
      <div className="min-w-0 flex-1">
        {title && (
          <h2 id={titleId} className="truncate text-[22px] leading-tight font-extrabold tracking-[-0.025em]">
            {title}
          </h2>
        )}
        {subtitle && <div className="mt-0.5 text-[13px] font-semibold text-muted">{subtitle}</div>}
      </div>
      {actions}
      {!hideClose && <IconButton icon="x" label={t('close')} variant="soft" size="sm" onClick={close} />}
    </div>
  )
}

export function SheetBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1 pb-5', className)}>{children}</div>
}

export function SheetFooter({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('shrink-0 border-t border-line bg-surface px-5 pt-3 pb-4', className)}>{children}</div>
}
