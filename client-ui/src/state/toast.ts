import { createContext, useContext } from 'react'

export type ToastType = 'info' | 'success' | 'error'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  type?: ToastType
  action?: ToastAction
  /** Milliseconds; default 3 s (5 s when there is an action). */
  duration?: number
}

export interface Toast extends Required<Pick<ToastOptions, 'type'>> {
  id: number
  text: string
  action?: ToastAction
  leaving: boolean
}

export interface ToastContextValue {
  toasts: Toast[]
  toast: (text: string, options?: ToastOptions) => number
  dismiss: (id: number) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue['toast'] {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast() must be used inside <ToastProvider>')
  return context.toast
}

export function useToasts(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToasts() must be used inside <ToastProvider>')
  return context
}
