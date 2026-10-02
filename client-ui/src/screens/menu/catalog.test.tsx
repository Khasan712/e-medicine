import { waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { business } from '../../test/fixtures'
import { requestsTo } from '../../test/handlers'
import { findCard, pattern, renderApp, screen, som, uz, within } from '../../test/render'

describe('catalog', () => {
  it('shows the business, the hero, categories, the popular row and product cards', async () => {
    renderApp()

    // Skeletons first, then the menu from GET /api/v1/shop.
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: business.tagline })).toBeInTheDocument()

    expect(screen.getByRole('link', { name: business.name })).toBeInTheDocument()
    expect(screen.getAllByText('30–45 daqiqa').length).toBeGreaterThan(0)
    expect(screen.getByText(`Minimal buyurtma ${som(50000)}`)).toBeInTheDocument()

    const chips = within(screen.getByRole('navigation', { name: uz.categories }))
    expect(chips.getAllByRole('button').map((chip) => chip.textContent)).toEqual(['Burgerlar', 'Ichimliklar', uz.other])

    expect(screen.getByRole('heading', { name: uz.popular })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^Burgerlar/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^Ichimliklar/ })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^Desertlar/ })).not.toBeInTheDocument() // empty category

    const burger = await findCard('Klassik burger')
    expect(within(burger).getByText(som(35000))).toBeInTheDocument()
    expect(within(burger).getByText('1 dona')).toBeInTheDocument()
    expect(within(burger).getByText(uz.top)).toBeInTheDocument()
    expect(within(await findCard('Fri kartoshka')).queryByText(uz.top)).not.toBeInTheDocument()

    expect(document.title).toBe(business.name)
    expect(requestsTo('GET', 'shop')).toHaveLength(1)
  })

  it('applies the brand colour of the business to the CSS variables', async () => {
    renderApp()
    await screen.findByRole('heading', { level: 1, name: business.tagline })
    const style = document.documentElement.style
    expect(style.getPropertyValue('--brand')).toBe('#ff6b00')
    expect(style.getPropertyValue('--brand-ink')).toBe('#ffffff')
    expect(style.getPropertyValue('--brand-2')).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('searches by name in both languages and shows an empty state', async () => {
    const { user } = renderApp()
    const search = await screen.findByRole('searchbox', { name: uz.searchPlaceholder })

    await user.type(search, 'чизбургер')
    expect(await screen.findByRole('heading', { name: new RegExp(uz.results) })).toHaveTextContent('1')
    expect(screen.getAllByRole('article').map((card) => card.getAttribute('aria-label'))).toEqual(['Chizburger'])
    expect(screen.queryByRole('navigation', { name: uz.categories })).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'pitsa')
    expect(await screen.findByText(uz.nothingFound)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: uz.clearSearch }))
    expect(await screen.findByRole('heading', { name: uz.popular })).toBeInTheDocument()
  })

  it('adds and removes products with the card stepper and keeps the cart per shop host', async () => {
    const { user } = renderApp()
    const card = await findCard('Kola 0.5 l')

    await user.click(within(card).getByRole('button', { name: uz.add }))
    const stepper = within(card).getByRole('group', { name: 'Kola 0.5 l: miqdori' })
    expect(within(stepper).getByText('1')).toBeInTheDocument()

    await user.click(within(stepper).getByRole('button', { name: uz.increase }))
    await user.click(within(stepper).getByRole('button', { name: uz.increase }))
    expect(within(stepper).getByText('3')).toBeInTheDocument()

    // The floating cart bar sums it up; the cart is stored under this host's key.
    expect(screen.getByRole('button', { name: pattern(`${uz.openCart}: 3 ta mahsulot, ${som(27000)}`) })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(`dh:${window.location.host}:cart`)!)).toEqual([{ id: 3, qty: 3 }])

    await user.click(within(stepper).getByRole('button', { name: uz.decrease }))
    await user.click(within(stepper).getByRole('button', { name: uz.decrease }))
    await user.click(within(stepper).getByRole('button', { name: uz.decrease }))
    expect(within(card).getByRole('button', { name: uz.add })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(`dh:${window.location.host}:cart`)!)).toEqual([])
  })

  it('opens the product details sheet and adds the chosen quantity', async () => {
    const { user } = renderApp()
    const card = await findCard('Klassik burger')
    await user.click(within(card).getByRole('button', { name: 'Klassik burger' }))

    const sheet = await screen.findByRole('dialog', { name: 'Klassik burger' })
    expect(within(sheet).getByText('Mol go‘shti, cheddar pishlog‘i va maxsus sous')).toBeInTheDocument()
    expect(within(sheet).getByRole('img', { name: 'Klassik burger' })).toBeInTheDocument()

    await user.click(within(sheet).getByRole('button', { name: uz.increase }))
    await user.click(within(sheet).getByRole('button', { name: pattern(uz.add, som(70000)) }))

    expect(await screen.findByText(uz.addedToCart)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(within(card).getByRole('group', { name: 'Klassik burger: miqdori' })).toHaveTextContent('2')
  })

  it('shows an error state with retry when the menu cannot be loaded', async () => {
    const { server } = await import('../../test/server')
    const { http, HttpResponse } = await import('msw')
    server.use(http.get('/api/v1/shop', () => HttpResponse.error(), { once: true }))
    const { user } = renderApp()

    expect(await screen.findByText(uz.loadError)).toBeInTheDocument()
    expect(screen.getByText(uz.errNetwork)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: uz.retry }))
    expect(await screen.findByRole('heading', { level: 1, name: business.tagline })).toBeInTheDocument()
  })

  it('shows a full-page notice when the business is suspended', async () => {
    const { server } = await import('../../test/server')
    const { http, HttpResponse } = await import('msw')
    server.use(http.get('/api/v1/shop', () => HttpResponse.json({ error: 'business_suspended' }, { status: 503 })))
    renderApp()
    expect(await screen.findByText(uz.shopSuspended)).toBeInTheDocument()
  })

  it('does not hide a suspension behind the menu kept from an earlier visit', async () => {
    const { server } = await import('../../test/server')
    const { http, HttpResponse } = await import('msw')
    const { storageKey } = await import('../../lib/storage')
    const cached = { business, bot_username: null, categories: [], products: [], popular: [], client: null }
    window.localStorage.setItem(storageKey('catalog'), JSON.stringify({ savedAt: Date.now() - 60_000, data: cached }))
    server.use(http.get('/api/v1/shop', () => HttpResponse.json({ error: 'business_suspended' }, { status: 503 })))
    renderApp()
    expect(await screen.findByText(uz.shopSuspended)).toBeInTheDocument()
    await waitFor(() => expect(window.localStorage.getItem(storageKey('catalog'))).toBeNull())
  })
})
