import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastOptions {
  description?: string
  durationMs?: number
}

export interface ToastApi {
  success: (title: string, options?: ToastOptions) => void
  error: (title: string, options?: ToastOptions) => void
  info: (title: string, options?: ToastOptions) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast must be used inside <ToastProvider>')
  return toast
}
