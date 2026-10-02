import { QueryClient } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { useLayoutEffect } from 'react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, type Location } from 'react-router'
import { AppShell } from '../app/AppShell'
import { Providers } from '../app/Providers'
import { messages } from '../i18n/messages'
import { formatMoney } from '../lib/format'
import { writeStorage } from '../lib/storage'
import type { CartItem } from '../state/cart'
import { TOKEN } from './fixtures'

/** Uzbek strings — tests look elements up by the same text the customer sees. */
export const uz = messages.uz
export const ru = messages.ru

/** "35 000 so‘m" with regular spaces (Testing Library normalises the non-breaking ones). */
export const som = (value: number) => formatMoney(value, uz.currency).replace(/\u00a0/g, ' ')

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A pattern matching the pieces in order; any space matches any whitespace (prices use NBSP). */
export const pattern = (...parts: string[]) =>
  new RegExp(parts.map((part) => escapeRegExp(part).replace(/[\s\u00a0]+/g, '\\s+')).join('.*'))

export const location: { current: Location | null } = { current: null }

function LocationProbe() {
  const current = useLocation()
  useLayoutEffect(() => {
    location.current = current
  }, [current])
  return null
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
}

interface RenderOptions {
  route?: string
  /** Signed-in customer (stores the token like a previous visit did). */
  signedIn?: boolean
  cart?: CartItem[]
}

export function renderApp({ route = '/', signedIn = false, cart }: RenderOptions = {}) {
  if (signedIn) writeStorage('token', TOKEN)
  if (cart) writeStorage('cart', cart)
  const user = userEvent.setup()
  const queryClient = createTestQueryClient()
  const result = render(
    <Providers queryClient={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AppShell />
        <LocationProbe />
      </MemoryRouter>
    </Providers>,
  )
  return { user, queryClient, ...result }
}

/** The product card of the menu with this name (popular rail cards are skipped). */
export async function findCard(name: string): Promise<HTMLElement> {
  const cards = await screen.findAllByRole('article', { name })
  return cards[cards.length - 1]!
}

export const dialog = (name?: string | RegExp) => screen.getByRole('dialog', name ? { name } : {})

export { screen, within }
