import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { getMe, updateMe } from '../api/shop'
import type { Lang } from '../api/types'
import { useI18n } from '../i18n/i18n'
import { haptic } from '../lib/telegram'
import { useAuth } from './auth'
import { useCart } from './cart'
import { useCatalog } from './catalog'
import { useNav } from './nav'
import { useToast } from './toast'

/** Switches the UI language and remembers it on the account (PATCH /me) when signed in. */
export function useChangeLanguage() {
  const { setLang } = useI18n()
  const { token, setClient } = useAuth()
  return useCallback(
    (lang: Lang) => {
      setLang(lang)
      haptic('select')
      if (token) {
        updateMe(token, { lang })
          .then(({ client }) => setClient(client))
          .catch(() => {
            /* the language is still saved on this device */
          })
      }
    },
    [setLang, token, setClient],
  )
}

/** "Checkout" from the cart: needs a signed-in customer and the minimum order. */
export function useStartCheckout() {
  const { token, status } = useAuth()
  const { count, belowMinimum } = useCart()
  const { go, openSheet, sheet } = useNav()
  return useCallback(() => {
    if (!count || belowMinimum) {
      haptic('error')
      return
    }
    const fromSheet = sheet !== null
    if (!token && status === 'ready') openSheet({ type: 'auth', next: '/checkout' }, { replace: fromSheet })
    else go('/checkout', { replace: fromSheet })
  }, [count, belowMinimum, token, status, go, openSheet, sheet])
}

/** Empties the cart with an "undo" toast. */
export function useClearCart() {
  const { t } = useI18n()
  const cart = useCart()
  const toast = useToast()
  return useCallback(() => {
    const previous = cart.clear()
    haptic('medium')
    toast(t('cartCleared'), { action: { label: t('undo'), onClick: () => cart.replace(previous) } })
  }, [cart, t, toast])
}

/** `<title>`: "Screen · Business". */
export function useDocumentTitle(title?: string) {
  const { business } = useCatalog()
  useEffect(() => {
    const name = business?.name
    document.title = [title, name].filter(Boolean).join(' · ') || document.title
  }, [title, business?.name])
}

/** Refreshes the customer's profile from GET /me while a screen that shows it is open. */
export function useFreshClient() {
  const { token, setClient } = useAuth()
  const me = useQuery({
    queryKey: ['me', token],
    queryFn: ({ signal }) => getMe(token!, signal),
    enabled: Boolean(token),
    refetchOnMount: 'always',
    gcTime: 0,
  })
  const { data, isFetchedAfterMount } = me
  useEffect(() => {
    if (data && isFetchedAfterMount) setClient(data.client)
  }, [data, isFetchedAfterMount, setClient])
}
