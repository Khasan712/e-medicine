import { Outlet, ScrollRestoration, useRouteError } from 'react-router'
import { SessionProvider } from '../auth/SessionProvider'
import { ConfirmProvider } from '../components/feedback/ConfirmProvider'
import { ToastProvider } from '../components/feedback/ToastProvider'
import { IconAlert, IconRefresh } from '../components/icons'
import { Button } from '../components/ui/Button'
import { useI18n } from '../i18n/context'

/** Session, toasts and confirmations live inside the router (they use links and navigation). */
export function AppRoot() {
  return (
    <SessionProvider>
      <ToastProvider>
        <ConfirmProvider>
          <Outlet />
          {/* New pages start at the top; back/forward restores the position (filters only change ?query). */}
          <ScrollRestoration getKey={(location) => location.pathname} />
        </ConfirmProvider>
      </ToastProvider>
    </SessionProvider>
  )
}

/** Last-resort screen for a render error inside a route. */
export function RouteError() {
  const error = useRouteError()
  const { t } = useI18n()
  console.error(error)
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-app px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 ring-1 ring-rose-100 dark:bg-rose-500/10 dark:ring-rose-500/20">
        <IconAlert size={26} />
      </span>
      <div>
        <p className="text-lg font-semibold text-fg">{t('error_generic')}</p>
        <p className="mt-1 text-sm text-muted">{t('error_server')}</p>
      </div>
      <Button variant="secondary" icon={<IconRefresh size={16} />} onClick={() => window.location.reload()}>
        {t('retry')}
      </Button>
    </div>
  )
}
