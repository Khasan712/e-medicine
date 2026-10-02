import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { store } from '../mocks/data'
import { locationOf, renderApp } from './render'
import { recordRequests } from './server'

function rows() {
  const table = screen.getByRole('table', { name: 'Buyurtmalar' })
  return within(table).getAllByRole('row').slice(1)
}

describe('orders list', () => {
  it('lists the newest orders with source badges and paginates', async () => {
    const requests = recordRequests('get', '/api/v1/orders')
    const { user, router } = renderApp('/orders')

    expect(await screen.findByRole('link', { name: '#163' })).toBeInTheDocument()
    expect(rows()).toHaveLength(20)
    expect(screen.getByText('64 ta buyurtma')).toBeInTheDocument()
    expect(screen.getByText("1–20 ko'rsatilmoqda, jami 64")).toBeInTheDocument()

    // Every row shows where the order came from.
    const sources = ['Veb-sayt', 'Mini App', 'Telegram bot', 'Sotuv (admin)']
    for (const row of rows()) {
      expect(sources.some((label) => within(row).queryByText(label))).toBe(true)
    }

    await user.click(screen.getByRole('button', { name: 'Keyingi' }))
    expect(await screen.findByRole('link', { name: '#143' })).toBeInTheDocument()
    expect(locationOf(router)).toBe('/orders?page=2')
    const last = requests.at(-1)!
    expect(last.url.searchParams.get('page')).toBe('2')
    expect(last.url.searchParams.get('page_size')).toBe('20')
  })

  it('filters by status, source and search (kept in the URL)', async () => {
    const requests = recordRequests('get', '/api/v1/orders')
    const { user, router } = renderApp('/orders?page=2')
    await screen.findByRole('link', { name: '#143' })

    await user.click(screen.getByRole('button', { name: "Yo'lda" }))
    await waitFor(() => expect(requests.at(-1)!.url.searchParams.get('status')).toBe('on_the_way'))
    // A new filter starts from the first page.
    expect(requests.at(-1)!.url.searchParams.get('page')).toBe('1')
    await waitFor(() => {
      for (const row of rows()) expect(within(row).getByText("Yo'lda")).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: "Yo'lda" })).toHaveAttribute('aria-pressed', 'true')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Manba' }), 'Mini App')
    await waitFor(() => expect(requests.at(-1)!.url.searchParams.get('source')).toBe('miniapp'))
    expect(locationOf(router)).toBe('/orders?status=on_the_way&source=miniapp')

    await user.click(screen.getByRole('button', { name: 'Barcha holatlar' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Manba' }), '')
    await user.type(screen.getByRole('searchbox'), 'Bekzod')
    await waitFor(() => expect(requests.at(-1)!.url.searchParams.get('search')).toBe('Bekzod'))
    expect(locationOf(router)).toBe('/orders?search=Bekzod')
    await waitFor(() => {
      for (const row of rows()) expect(within(row).getByText('Bekzod')).toBeInTheDocument()
    })
  })

  it('offers to reset filters when nothing matches', async () => {
    const { user } = renderApp('/orders?search=nobody-here')

    expect(await screen.findByText('Buyurtmalar topilmadi')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Filtrlarni tozalash' }))
    expect(await screen.findByRole('link', { name: '#163' })).toBeInTheDocument()
  })

  it('opens an order from its row', async () => {
    const { user, router } = renderApp('/orders')
    await user.click(await screen.findByRole('link', { name: '#162' }))
    expect(await screen.findByRole('heading', { name: /Buyurtma\s+#162/ })).toBeInTheDocument()
    expect(locationOf(router)).toBe('/orders/162')
  })
})

describe('order detail', () => {
  it('shows items, customer and delivery address with map links', async () => {
    const order = store.db.orders.find((item) => item.delivery_type === 'delivery' && item.client && item.lat)!
    renderApp(`/orders/${order.id}`)

    expect(await screen.findByRole('heading', { name: new RegExp(`Buyurtma\\s+#${order.id}`) })).toBeInTheDocument()
    expect(await screen.findByText(order.items[0].name_uz)).toBeInTheDocument()
    for (const item of order.items) expect(screen.getByText(item.name_uz)).toBeInTheDocument()
    expect(screen.getByText(order.address)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: "Xaritada ko'rish" })).toHaveAttribute(
      'href',
      `https://maps.google.com/?q=${Number(order.lat)},${Number(order.lng)}`,
    )
    expect(screen.getByRole('link', { name: "Mijoz profilini ko'rish" })).toHaveAttribute('href', `/clients/${order.client!.id}`)
  })

  it('changes the status, asking first before rejecting', async () => {
    const order = store.db.orders.find((item) => item.status === 'ordered')!
    const patches = recordRequests('patch', `/api/v1/orders/${order.id}`)
    const { user } = renderApp(`/orders/${order.id}`)

    await user.click(await screen.findByRole('radio', { name: "Yo'lda" }))
    await waitFor(() => expect(screen.getByRole('radio', { name: "Yo'lda" })).toBeChecked())
    expect(patches[0].body).toEqual({ status: 'on_the_way' })
    expect(await screen.findByText('Holat yangilandi')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Bekor qilingan' }))
    const dialog = await screen.findByRole('dialog', { name: 'Buyurtmani bekor qilasizmi?' })
    await user.click(within(dialog).getByRole('button', { name: 'Orqaga' }))
    expect(patches).toHaveLength(1)

    await user.click(screen.getByRole('radio', { name: 'Bekor qilingan' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Ha, bekor qilish' }))
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Bekor qilingan' })).toBeChecked())
    expect(patches[1].body).toEqual({ status: 'rejected' })
  })

  it('shows "not found" for an unknown order', async () => {
    renderApp('/orders/99999')
    expect(await screen.findByRole('heading', { name: 'Sahifa topilmadi' })).toBeInTheDocument()
  })
})
