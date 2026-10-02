/* `npm run dev:mock` — the whole Admin API answered in the browser by MSW (no backend needed).
   Sign in with +998 90 123 45 67 / admin12345 (admin) or +998 93 555 77 88 / manager12345 (manager). */
import { getResponse } from 'msw'
import { setupWorker } from 'msw/browser'
import { store } from './data'
import { handlers, setMockLatency } from './handlers'

const SESSION_KEY = 'mock.session'

/** Where service workers are unavailable (some embedded browsers), answer `fetch` in the page itself. */
function patchFetch() {
  const original = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    if (new URL(request.url).pathname.startsWith('/api/')) {
      const response = await getResponse(handlers, request)
      if (response) return response
    }
    return original(input, init)
  }
}

export async function startMockApi() {
  const params = new URLSearchParams(window.location.search)
  setMockLatency(params.has('mock-fast') ? 0 : 350)
  // Keep the mock session across page reloads; `?mock-as=admin|manager` signs in directly (screenshots, demos).
  const saved = Number(sessionStorage.getItem(SESSION_KEY))
  if (saved) store.db.sessionUserId = saved
  const as = params.get('mock-as')
  if (as === 'admin' || as === 'manager') store.db.sessionUserId = as === 'admin' ? 1 : 2
  window.addEventListener('beforeunload', () => {
    if (store.db.sessionUserId) sessionStorage.setItem(SESSION_KEY, String(store.db.sessionUserId))
    else sessionStorage.removeItem(SESSION_KEY)
  })
  try {
    await setupWorker(...handlers).start({
      onUnhandledRequest: 'bypass',
      quiet: true,
      serviceWorker: { url: '/mockServiceWorker.js' },
    })
  } catch (error) {
    console.warn('[mock] Service worker unavailable, mocking fetch in the page instead:', error)
    patchFetch()
  }
  console.info('[mock] Admin API is mocked — sign in with +998901234567 / admin12345')
}
