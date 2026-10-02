import { createContext, use } from 'react'
import { ApiError } from '../api/client'
import { authApi } from '../api/endpoints'
import type { Business, MeResponse, StaffUser } from '../api/types'
import { STORAGE_KEYS, storage } from '../lib/storage'

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous' | 'error'

export interface SessionValue {
  status: SessionStatus
  user: StaffUser | null
  business: Business | null
  isAdmin: boolean
  error: unknown
  /** Why the user is signed out: the session expired (a 401 while signed in) or they logged out. */
  signedOut: 'expired' | 'logout' | null
  retry: () => void
  /** Stores the session returned by login / Telegram sign-in (same body as `/auth/me`). */
  signIn: (data: MeResponse) => void
  /** Reloads `/auth/me`. */
  refresh: () => Promise<MeResponse | null>
  logout: () => Promise<void>
}

export const SessionContext = createContext<SessionValue | null>(null)

export function useSession(): SessionValue {
  const value = use(SessionContext)
  if (!value) throw new Error('useSession must be used inside <SessionProvider>')
  return value
}

/** Signed-in user and business (inside protected routes). */
export function useAuthed(): { user: StaffUser; business: Business; isAdmin: boolean } {
  const { user, business, isAdmin } = useSession()
  if (!user || !business) throw new Error('useAuthed must be used inside protected routes')
  return { user, business, isAdmin }
}

/** `GET /auth/me`; `null` when not signed in. */
export async function fetchSession(): Promise<MeResponse | null> {
  try {
    const data = await authApi.me()
    rememberBusiness(data.business)
    return data
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export type RememberedBusiness = Pick<Business, 'name' | 'logo' | 'brand_color'>

/** The business is remembered so the login page of this host can show its name and logo. */
export function rememberBusiness(business: Business) {
  storage.setJSON(STORAGE_KEYS.business, { name: business.name, logo: business.logo, brand_color: business.brand_color })
}

export function rememberedBusiness(): RememberedBusiness | null {
  const value = storage.getJSON<RememberedBusiness>(STORAGE_KEYS.business)
  return value && typeof value.name === 'string' ? value : null
}

/** Only same-app paths are accepted as a return address (no open redirects). */
export function safeNext(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  if (value.startsWith('/login') || value.startsWith('/tg')) return fallback
  return value
}
