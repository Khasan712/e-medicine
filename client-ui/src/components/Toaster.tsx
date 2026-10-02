import { cn } from '../lib/cn'
import { useToasts } from '../state/toast'
import { Icon } from './Icon'

export function Toaster() {
  const { toasts, dismiss } = useToasts()
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-[calc(12px+var(--safe-top))] left-1/2 z-[100] flex w-[min(420px,calc(100vw-24px))] -translate-x-1/2 flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.type === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex items-center gap-2.5 rounded-[15px] py-3 pr-3 pl-4 text-sm font-bold shadow-lg',
            toast.leaving ? 'toast-leave' : 'toast-enter',
            toast.type === 'error' ? 'bg-red text-white' : 'bg-ink text-bg',
          )}
        >
          <Icon
            name={toast.type === 'error' ? 'alert' : toast.type === 'success' ? 'check' : 'info'}
            className={cn('size-[18px]', toast.type === 'success' && 'text-[#3ddc84]')}
          />
          <span className="min-w-0 flex-1">{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              className="-my-1 shrink-0 rounded-lg px-2.5 py-1.5 font-extrabold text-brand underline-offset-2 hover:underline"
              onClick={() => {
                toast.action?.onClick()
                dismiss(toast.id)
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
