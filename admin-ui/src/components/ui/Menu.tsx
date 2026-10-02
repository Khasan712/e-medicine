import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface MenuProps {
  /** Renders the trigger button; spread the props on it. */
  trigger: (props: {
    onClick: () => void
    'aria-expanded': boolean
    'aria-haspopup': 'menu'
    'aria-controls': string
    id: string
  }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  className?: string
  placement?: 'bottom' | 'top'
}

/** Dropdown menu: closes on outside click, Escape, or after choosing an item. */
export function Menu({ trigger, children, align = 'right', className, placement = 'bottom' }: MenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const triggerId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        document.getElementById(triggerId)?.focus()
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
        if (!items.length) return
        event.preventDefault()
        const index = items.indexOf(document.activeElement as HTMLElement)
        const next = event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length
        items[next].focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, triggerId])

  const close = () => setOpen(false)

  return (
    <div ref={rootRef} className="relative">
      {trigger({
        onClick: () => setOpen((value) => !value),
        'aria-expanded': open,
        'aria-haspopup': 'menu',
        'aria-controls': menuId,
        id: triggerId,
      })}
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          className={cn(
            'absolute z-40 min-w-56 animate-pop-in overflow-hidden rounded-2xl border border-line bg-card p-1.5 shadow-pop',
            align === 'right' ? 'right-0' : 'left-0',
            placement === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2',
            className,
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  children,
  onSelect,
  icon,
  danger,
}: {
  children: ReactNode
  onSelect: () => void
  icon?: ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium outline-none transition-colors',
        danger
          ? 'text-rose-600 hover:bg-rose-50 focus:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 dark:focus:bg-rose-500/10'
          : 'text-fg-soft hover:bg-subtle hover:text-fg focus:bg-subtle focus:text-fg',
      )}
    >
      {icon && <span className="text-faint">{icon}</span>}
      {children}
    </button>
  )
}
