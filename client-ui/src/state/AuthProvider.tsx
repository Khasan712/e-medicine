import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { onUnauthorized } from '../api/client'
import { signInWithWebApp } from '../api/shop'
import type { AuthResult, Client } from '../api/types'
import { useI18n } from '../i18n/i18n'
import { readStorage, removeStorage, writeStorage } from '../lib/storage'
import { telegram } from '../lib/telegram'
import { AuthContext, type AuthStatus, type SignOutReason } from './auth'
import { useToast } from './toast'

/**
 * Website: the token lives in localStorage (per host). Telegram Mini App: every launch signs in with the
 * signed `initData` (POST /auth/telegram/webapp), so the account always matches the Telegram user.
 * Any 401 on an authenticated request signs the customer out (inside Telegram: signs in again).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const webApp = telegram()
  const inTelegram = webApp !== null
  const queryClient = useQueryClient()
  const { t, adoptLang } = useI18n()
  const toast = useToast()

  const [token, setToken] = useState<string | null>(() => (inTelegram ? null : readStorage<string | null>('token', null)))
  const [client, setClientState] = useState<Client | null>(null)
  const [status, setStatus] = useState<AuthStatus>(inTelegram ? 'loading' : 'ready')
  const tokenRef = useRef(token)

  const setClient = useCallback(
    (next: Client) => {
      setClientState(next)
      adoptLang(next.lang)
    },
    [adoptLang],
  )

  const signIn = useCallback(
    (result: AuthResult) => {
      tokenRef.current = result.token
      setToken(result.token)
      if (!inTelegram) writeStorage('token', result.token)
      setClient(result.client)
      for (const key of ['orders', 'order', 'me']) queryClient.removeQueries({ queryKey: [key] })
    },
    [inTelegram, queryClient, setClient],
  )

  const signInWithTelegram = useCallback(async () => {
    if (!webApp) return
    setStatus('loading')
    try {
      signIn(await signInWithWebApp(webApp.initData))
    } catch {
      /* invalid init data or offline: the customer can still sign in by phone */
    } finally {
      setStatus('ready')
    }
  }, [signIn, webApp])

  const signOut = useCallback(
    (reason: SignOutReason = 'user') => {
      tokenRef.current = null
      setToken(null)
      setClientState(null)
      removeStorage('token')
      for (const key of ['orders', 'order', 'me']) queryClient.removeQueries({ queryKey: [key] })
      if (reason === 'expired') {
        if (inTelegram) void signInWithTelegram()
        else toast(t('sessionExpired'), { type: 'error' })
      }
    },
    [inTelegram, queryClient, signInWithTelegram, t, toast],
  )

  // Telegram Mini App: automatic sign-in once per launch.
  const startedTelegramSignIn = useRef(false)
  useEffect(() => {
    if (!inTelegram || startedTelegramSignIn.current) return
    startedTelegramSignIn.current = true
    void signInWithTelegram()
  }, [inTelegram, signInWithTelegram])

  // 401 on any authenticated request → the token is no longer valid.
  useEffect(
    () =>
      onUnauthorized((rejected) => {
        if (rejected === tokenRef.current) signOut('expired')
      }),
    [signOut],
  )

  const syncFromShop = useCallback(
    (shopClient: Client | null, requestedWithToken: string | null) => {
      if (!requestedWithToken || requestedWithToken !== tokenRef.current) return
      if (shopClient) setClient(shopClient)
      else signOut('silent') // the stored token belongs to nobody any more
    },
    [setClient, signOut],
  )

  const value = useMemo(
    () => ({ token, client, status, signIn, signOut, setClient, syncFromShop }),
    [token, client, status, signIn, signOut, setClient, syncFromShop],
  )
  return <AuthContext value={value}>{children}</AuthContext>
}
