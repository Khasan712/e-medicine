import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type Toast, type ToastOptions } from './toast'

const LEAVE_MS = 220
const MAX_TOASTS = 3

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  const nextId = useRef(0)

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((toast) => toast.id !== id))
  }, [])

  const dismiss = useCallback(
    (id: number) => {
      clearTimeout(timers.current.get(id))
      setToasts((list) => list.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)))
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id)
          remove(id)
        }, LEAVE_MS),
      )
    },
    [remove],
  )

  const toast = useCallback(
    (text: string, options: ToastOptions = {}) => {
      const id = ++nextId.current
      const item: Toast = { id, text, type: options.type ?? 'info', action: options.action, leaving: false }
      setToasts((list) => [...list.filter((existing) => existing.text !== text), item].slice(-MAX_TOASTS))
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), options.duration ?? (options.action ? 5000 : 3000)),
      )
      return id
    },
    [dismiss],
  )

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => clearTimeout(timer))
  }, [])

  const value = useMemo(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss])
  return <ToastContext value={value}>{children}</ToastContext>
}
