import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  side?: 'right' | 'top' | 'bottom'
  disabled?: boolean
}

/**
 * Visual hint on hover / keyboard focus, rendered in a portal (works inside scrolling containers).
 * The wrapped control keeps its own accessible name — the tooltip only repeats it for sighted users.
 */
export function Tooltip({ content, children, side = 'top', disabled }: TooltipProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  if (disabled) return children

  const show = (wrapper: HTMLElement) => {
    const target = wrapper.firstElementChild ?? wrapper
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const rect = target.getBoundingClientRect()
      if (side === 'right') setPosition({ x: rect.right + 10, y: rect.top + rect.height / 2 })
      else if (side === 'bottom') setPosition({ x: rect.left + rect.width / 2, y: rect.bottom + 8 })
      else setPosition({ x: rect.left + rect.width / 2, y: rect.top - 8 })
    }, 120)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    setPosition(null)
  }

  const transform =
    side === 'right' ? 'translate(0, -50%)' : side === 'bottom' ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'

  return (
    <span
      className="contents"
      onMouseEnter={(event) => show(event.currentTarget)}
      onMouseLeave={hide}
      onFocus={(event) => show(event.currentTarget)}
      onBlur={hide}
    >
      {children}
      {position &&
        createPortal(
          <div
            aria-hidden="true"
            className="pointer-events-none fixed z-[70] animate-fade-in whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-slate-700"
            style={{ left: position.x, top: position.y, transform }}
          >
            {content}
          </div>,
          document.body,
        )}
    </span>
  )
}
