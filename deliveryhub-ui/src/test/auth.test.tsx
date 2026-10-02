import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { backend } from './backend'
import { makeBusiness, STAFF_PASSWORD } from './fixtures'
import { renderApp } from './render'
import { server } from './server'

describe('auth', () => {
  it('restores the session with /auth/me', async () => {
    backend.state.businesses = [makeBusiness()]
    renderApp('/')

    expect(await screen.findByRole('heading', { level: 1, name: 'Bizneslar' })).toBeInTheDocument()
    expect(screen.getByText('Xasan')).toBeInTheDocument()
    expect(backend.requests('GET', '/auth/me')).toHaveLength(1)
  })

  it('signs in with the CSRF token and returns to the page that asked for it', async () => {
    backend.state.session = null
    backend.state.businesses = [makeBusiness()]
    const { user, router } = renderApp('/b/burger-house')

    // No session: the login page, with the return path.
    expect(await screen.findByRole('button', { name: 'Kirish' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toBe('?next=%2Fb%2Fburger-house')

    await user.type(screen.getByLabelText('Telefon'), '90 123 45 67')
    await user.type(screen.getByLabelText('Parol'), STAFF_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Kirish' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Burger House' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/b/burger-house')

    // The cookie came from GET /auth/csrf and went back as X-CSRFToken.
    const csrfIndex = backend.state.requests.findIndex((request) => request.path === '/api/v1/auth/csrf')
    const [login] = backend.requests('POST', '/auth/login')
    expect(csrfIndex).toBeGreaterThanOrEqual(0)
    expect(backend.state.requests.indexOf(login!)).toBeGreaterThan(csrfIndex)
    expect(login!.headers['x-csrftoken']).toBe('csrf-token-1')
    expect(login!.body).toEqual({ phone: '90 123 45 67', password: STAFF_PASSWORD })

    // Login rotates the token: the next unsafe request reads the new cookie.
    await user.click(screen.getByRole('button', { name: 'Chiqish' }))
    await screen.findByRole('button', { name: 'Kirish' })
    expect(backend.requests('POST', '/auth/logout')[0]?.headers['x-csrftoken']).toBe('csrf-token-2')
  })

  it('shows the API error for wrong credentials and checks empty fields first', async () => {
    backend.state.session = null
    const { user } = renderApp('/login')

    await user.click(await screen.findByRole('button', { name: 'Kirish' }))
    expect(screen.getByText('Telefon raqamini kiriting')).toBeInTheDocument()
    expect(screen.getByText('Parolni kiriting')).toBeInTheDocument()
    expect(screen.getByLabelText('Telefon')).toHaveFocus()
    expect(backend.requests('POST', '/auth/login')).toHaveLength(0)

    await user.type(screen.getByLabelText('Telefon'), '+998 90 123 45 67')
    await user.type(screen.getByLabelText('Parol'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Telefon yoki parol noto'g'ri")
    expect(screen.getByRole('button', { name: 'Kirish' })).toBeEnabled()
  })

  it('repeats a request once with a fresh CSRF cookie when the old one is rejected', async () => {
    backend.state.session = null
    document.cookie = 'csrftoken=stale-token; path=/'
    const { user, router } = renderApp('/login')

    await user.type(await screen.findByLabelText('Telefon'), '901234567')
    await user.type(screen.getByLabelText('Parol'), STAFF_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Kirish' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    const logins = backend.requests('POST', '/auth/login')
    expect(logins.map((request) => request.headers['x-csrftoken'])).toEqual(['stale-token', 'csrf-token-1'])
  })

  it('sends the user to the login page when the session expires (401) and back afterwards', async () => {
    backend.state.businesses = [makeBusiness()]
    const { user, router } = renderApp('/')
    await screen.findByRole('link', { name: 'Burger House' })

    // The session ends on the server; the next request answers 401.
    backend.state.session = null
    await user.click(screen.getByRole('link', { name: 'Burger House' }))

    expect(await screen.findByRole('button', { name: 'Kirish' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?next=%2Fb%2Fburger-house')

    await user.type(screen.getByLabelText('Telefon'), '+998901234567')
    await user.type(screen.getByLabelText('Parol'), STAFF_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Burger House' })).toBeInTheDocument()
  })

  it('logs out', async () => {
    const { user, router } = renderApp('/')
    await screen.findByRole('heading', { level: 1, name: 'Bizneslar' })

    await user.click(screen.getByRole('button', { name: 'Chiqish' }))

    expect(await screen.findByRole('button', { name: 'Kirish' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toBe('')
    const [logout] = backend.requests('POST', '/auth/logout')
    expect(logout?.headers['x-csrftoken']).toBe('csrf-token-1')
    expect(backend.state.session).toBeNull()
  })

  it('offers a retry when the server cannot be reached', async () => {
    server.use(http.get('/api/v1/auth/me', () => HttpResponse.error(), { once: true }))
    const { user } = renderApp('/')

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText("Panelni ochib bo'lmadi")).toBeInTheDocument()
    expect(within(alert).getByText(/Server bilan aloqa yo'q/)).toBeInTheDocument()

    await user.click(within(alert).getByRole('button', { name: 'Qayta urinish' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Bizneslar' })).toBeInTheDocument()
  })
})
