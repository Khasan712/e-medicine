import { createContext, use, type ReactNode } from 'react'

// ------------------------------------------------------------------ toasts
export type ToastType = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  /** In-app link. */
  to?: string
  onClick?: () => void
}

export interface ToastOptions {
  description?: string
  action?: ToastAction
  duration?: number
}

export interface ToastItem extends ToastOptions {
  id: number
  type: ToastType
  title: string
}

export interface ToastApi {
  show: (type: ToastType, title: string, options?: ToastOptions) => number
  success: (title: string, options?: ToastOptions) => number
  error: (title: string, options?: ToastOptions) => number
  info: (title: string, options?: ToastOptions) => number
  dismiss: (id: number) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const value = use(ToastContext)
  if (!value) throw new Error('useToast must be used inside <ToastProvider>')
  return value
}

// ------------------------------------------------------------------ confirm dialog
export interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  icon?: ReactNode
  /** Runs while the dialog shows a spinner; an error keeps the dialog open and is shown in it. */
  onConfirm?: () => Promise<unknown> | unknown
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

export const ConfirmContext = createContext<ConfirmFn | null>(null)

export function useConfirm(): ConfirmFn {
  const value = use(ConfirmContext)
  if (!value) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return value
}
