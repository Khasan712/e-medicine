import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { FullPageLoader, NoAccess, SessionErrorScreen } from './SystemScreens'
import { useSession } from './session'

/** Protected routes: waits for the session, sends anonymous users to /login?next=<path>. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession()
  const location = useLocation()

  if (session.status === 'loading') return <FullPageLoader />
  if (session.status === 'error') return <SessionErrorScreen error={session.error} onRetry={session.retry} />
  if (session.status === 'anonymous') {
    const path = location.pathname + location.search
    const next = session.signedOut === 'logout' || path === '/' ? '' : `?next=${encodeURIComponent(path)}`
    return <Navigate to={`/login${next}`} replace state={{ reason: session.signedOut }} />
  }
  return children
}

/** Admin-only sections (staff users). Managers see a "no access" page. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useSession()
  return isAdmin ? children : <NoAccess />
}
