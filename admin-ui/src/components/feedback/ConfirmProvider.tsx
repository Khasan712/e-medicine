import { useCallback, useRef, useState, type ReactNode } from 'react'
import { errorMessage } from '../../api/errors'
import { useI18n } from '../../i18n/context'
import { IconAlert, IconInfo } from '../icons'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { ConfirmContext, type ConfirmFn, type ConfirmOptions } from './feedback'

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [current, setCurrent] = useState<PendingConfirm | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setError(null)
        setBusy(false)
        setCurrent({ ...options, resolve })
      }),
    [],
  )

  const close = (result: boolean) => {
    current?.resolve(result)
    setCurrent(null)
    setBusy(false)
    setError(null)
  }

  const accept = async () => {
    if (!current) return
    if (!current.onConfirm) {
      close(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await current.onConfirm()
      close(true)
    } catch (caught) {
      setBusy(false)
      setError(errorMessage(caught, t))
    }
  }

  const tone = current?.tone ?? 'danger'

  return (
    <ConfirmContext value={confirm}>
      {children}
      <Modal
        open={!!current}
        onClose={() => close(false)}
        dismissible={!busy}
        size="sm"
        centered
        initialFocus={confirmRef}
        icon={
          current?.icon ?? (
            <span
              className={
                tone === 'danger'
                  ? 'flex size-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20'
                  : 'flex size-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100 dark:bg-primary-500/10 dark:text-primary-300 dark:ring-primary-500/20'
              }
            >
              {tone === 'danger' ? <IconAlert size={24} /> : <IconInfo size={24} />}
            </span>
          )
        }
        title={current?.title ?? ''}
        description={
          <>
            {current?.message}
            {error && (
              <span role="alert" className="mt-3 block rounded-xl bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                {error}
              </span>
            )}
          </>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)} disabled={busy} className="sm:min-w-28">
              {current?.cancelLabel ?? t('cancel')}
            </Button>
            <Button
              ref={confirmRef}
              variant={tone === 'danger' ? 'danger' : 'primary'}
              onClick={() => void accept()}
              loading={busy}
              className="sm:min-w-28"
            >
              {current?.confirmLabel ?? t('yes_delete')}
            </Button>
          </>
        }
      />
    </ConfirmContext>
  )
}
