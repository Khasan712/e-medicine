import { createContext, useContext } from 'react'
import type { AuthResult, Client } from '../api/types'

export type AuthStatus = 'loading' | 'ready'
export type SignOutReason = 'user' | 'expired' | 'silent'

export interface AuthContextValue {
  /** Bearer token of the customer (only for this shop host). */
  token: string | null
  /** Profile of the customer; can be null for a moment after start-up while the shop loads. */
  client: Client | null
  /** `loading` while the Telegram Mini App signs in automatically. */
  status: AuthStatus
  signIn: (result: AuthResult) => void
  signOut: (reason?: SignOutReason) => void
  setClient: (client: Client) => void
  /** `GET /shop` tells whether the stored token is still valid (client or null). */
  syncFromShop: (client: Client | null, requestedWithToken: string | null) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth() must be used inside <AuthProvider>')
  return context
}

export function clientName(client: Client | null | undefined): string {
  if (!client) return ''
  return [client.first_name, client.last_name].filter(Boolean).join(' ').trim()
}

/** The letter of the avatar: first name, else Telegram username (null → show a person icon). */
export function avatarLetter(client: Client | null | undefined): string | null {
  const source = clientName(client) || client?.tg_nick || ''
  const letter = source.trim()[0]
  return letter ? letter.toUpperCase() : null
}
