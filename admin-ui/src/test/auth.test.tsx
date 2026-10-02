import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { readCookie } from '../api/client'
import { renderApp, locationOf } from './render'
import { recordRequests, server } from './server'

describe('login', () => {
  it('gets a CSRF cookie, sends it back as X-CSRFToken and returns to the requested page', async () => {
    const order: string[] = []
    let headerAtLogin: string | null = null
    let cookieAtLogin: string | null = null
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url)
      order.push(`${request.method} ${url.pathname}`)
      if (url.pathname === '/api/v1/auth/login') {
        headerAtLogin = request.headers.get('x-csrftoken')
        cookieAtLogin = readCookie('csrftoken')
      }
    })

    const { user, router } = renderApp('/orders?status=ordered', { as: null })

    expect(await screen.findByRole('heading', { name: 'Hisobingizga kiring' })).toBeInTheDocument()
    expect(locationOf(router)).toBe('/login?next=%2Forders%3Fstatus%3Dordered')

    await user.type(screen.getByLabelText('Telefon raqami'), '90 123 45 67')
    await user.type(screen.getByLabelText('Parol'), 'admin12345')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))

    expect(await screen.findByRole('heading', { name: 'Buyurtmalar' })).toBeInTheDocument()
    expect(locationOf(router)).toBe('/orders?status=ordered')

    const csrfIndex = order.indexOf('GET /api/v1/auth/csrf')
    const loginIndex = order.indexOf('POST /api/v1/auth/login')
    expect(csrfIndex).toBeGreaterThanOrEqual(0)
    expect(loginIndex).toBeGreaterThan(csrfIndex)
    expect(headerAtLogin).toBeTruthy()
    expect(headerAtLogin).toBe(cookieAtLogin)
    server.events.removeAllListeners()
  })

  it('validates the form before sending anything', async () => {
    const logins = recordRequests('post', '/api/v1/auth/login')
    const { user } = renderApp('/login', { as: null })

    await user.click(await screen.findByRole('button', { name: 'Kirish' }))

    expect(screen.getByText('Telefon raqamini kiriting')).toBeInTheDocument()
    expect(screen.getByText('Parolni kiriting')).toBeInTheDocument()
    expect(screen.getByLabelText('Telefon raqami')).toHaveAttribute('aria-invalid', 'true')
    expect(logins).toHaveLength(0)
  })

  it('explains wrong credentials', async () => {
    const { user } = renderApp('/login', { as: null })

    await user.type(await screen.findByLabelText('Telefon raqami'), '+998901234567')
    await user.type(screen.getByLabelText('Parol'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Telefon raqami yoki parol noto'g'ri")
  })

  it('shows the rate limit with the waiting time', async () => {
    server.use(
      http.post('/api/v1/auth/login', () =>
        HttpResponse.json({ error: 'too_many_requests', retry_after: 120 }, { status: 429 }),
      ),
    )
    const { user } = renderApp('/login', { as: null })

    await user.type(await screen.findByLabelText('Telefon raqami'), '901234567')
    await user.type(screen.getByLabelText('Parol'), 'whatever1')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("120 soniyadan so'ng")
  })
})

describe('session', () => {
  it('restores the session from /auth/me', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Xush kelibsiz, Aziz' })).toBeInTheDocument()
    expect(screen.getAllByText('Burger House').length).toBeGreaterThan(0)
  })

  it('goes back to the login page with the return path when a request answers 401', async () => {
    server.use(http.get('/api/v1/clients', () => HttpResponse.json({ error: 'auth_required' }, { status: 401 })))
    const { router } = renderApp('/clients?search=jasur')

    expect(await screen.findByText('Sessiya tugadi — qaytadan kiring')).toBeInTheDocument()
    expect(locationOf(router)).toBe('/login?next=%2Fclients%3Fsearch%3Djasur')
  })

  it('logs out', async () => {
    const logouts = recordRequests('post', '/api/v1/auth/logout')
    const { user, router } = renderApp('/')

    await user.click(await screen.findByRole('button', { name: 'Foydalanuvchi menyusi' }))
    const menu = screen.getByRole('menu')
    await user.click(within(menu).getByRole('menuitem', { name: 'Chiqish' }))

    expect(await screen.findByText('Tizimdan chiqdingiz')).toBeInTheDocument()
    expect(locationOf(router)).toBe('/login')
    expect(logouts).toHaveLength(1)
    expect(logouts[0].headers.get('x-csrftoken')).toBeTruthy()
  })

  it('shows a dedicated screen when the business is suspended', async () => {
    server.use(http.get('/api/v1/auth/me', () => HttpResponse.json({ error: 'business_suspended' }, { status: 503 })))
    renderApp('/')
    expect(await screen.findByText("Biznes vaqtincha to'xtatilgan")).toBeInTheDocument()
  })
})

describe('Telegram Mini App sign-in (/tg)', () => {
  function telegram(initData: string, language = 'uz') {
    ;(window as { Telegram?: unknown }).Telegram = {
      WebApp: {
        initData,
        initDataUnsafe: { user: { language_code: language } },
        colorScheme: 'light',
        ready: () => {},
        expand: () => {},
      },
    }
  }

  it('signs a linked staff member in and opens the point of sale', async () => {
    telegram('query_id=AA&user=%7B%22id%22%3A501234567%7D&hash=abc')
    const signIns = recordRequests('post', '/api/v1/auth/telegram')
    const { router } = renderApp('/tg', { as: null })

    expect(await screen.findByRole('heading', { name: 'Sotuv' })).toBeInTheDocument()
    expect(locationOf(router)).toBe('/sales')
    expect(signIns[0].body).toEqual({ init_data: 'query_id=AA&user=%7B%22id%22%3A501234567%7D&hash=abc' })
  })

  it('explains that the Telegram account is not linked yet', async () => {
    telegram('query_id=AA&user=%7B%22id%22%3A111%7D&hash=abc')
    renderApp('/tg', { as: null })
    expect(await screen.findByRole('heading', { name: 'Siz hali ulanmagansiz' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Telefon va parol bilan kirish' })).toHaveAttribute('href', '/login')
  })

  it('follows the Telegram language when the user has not chosen one', async () => {
    telegram('query_id=AA&user=%7B%22id%22%3A111%7D&hash=abc', 'ru')
    renderApp('/tg', { as: null })
    expect(await screen.findByRole('heading', { name: 'Вы ещё не подключены' })).toBeInTheDocument()
  })

  it('asks to open the page inside Telegram', async () => {
    renderApp('/tg', { as: null })
    expect(await screen.findByRole('heading', { name: 'Telegram ichida oching' })).toBeInTheDocument()
  })

  it('reports a broken init data', async () => {
    telegram('invalid-data')
    renderApp('/tg', { as: null })
    expect(await screen.findByRole('heading', { name: "Kirib bo'lmadi" })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Qayta urinish' })).toBeEnabled())
  })
})
