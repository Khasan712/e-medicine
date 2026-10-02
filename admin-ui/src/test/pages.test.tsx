import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { store } from '../mocks/data'
import { locationOf, renderApp } from './render'
import { recordRequests } from './server'

describe('dashboard', () => {
  it('shows KPI cards, both charts and the latest orders', async () => {
    renderApp('/')

    expect(await screen.findByText('Jami buyurtmalar')).toBeInTheDocument()
    const total = screen.getByText('Jami buyurtmalar').closest('a')!
    expect(total).toHaveAttribute('href', '/orders')
    expect(await within(total).findByText('64')).toBeInTheDocument()
    expect(screen.getByText('Yangi buyurtmalar').closest('a')).toHaveAttribute('href', '/orders?status=ordered')
    expect(screen.getByRole('heading', { name: "Holat bo'yicha buyurtmalar" })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: "So'nggi 7 kundagi buyurtmalar" })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: "So'nggi buyurtmalar" })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '#163' })).toHaveAttribute('href', '/orders/163')
  })

  it('switches the whole interface to Russian', async () => {
    const { user } = renderApp('/')
    await screen.findByText('Jami buyurtmalar')
    await user.click(screen.getByRole('radio', { name: 'Русский' }))
    expect(await screen.findByText('Всего заказов')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Заказы/ })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('ru')
    expect(window.localStorage.getItem('admin.lang')).toBe('ru')
  })

  it('toggles and remembers the dark theme', async () => {
    const { user } = renderApp('/')
    await screen.findByText('Jami buyurtmalar')
    await user.click(screen.getByRole('button', { name: 'Tungi rejim' }))
    expect(document.documentElement).toHaveClass('dark')
    expect(window.localStorage.getItem('admin.theme')).toBe('dark')
    await user.click(screen.getByRole('button', { name: 'Kunduzgi rejim' }))
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('collapses the sidebar and keeps the choice', async () => {
    const { user } = renderApp('/')
    await user.click(await screen.findByRole('button', { name: "Panelni yig'ish" }))
    expect(screen.getByRole('button', { name: 'Panelni yoyish' })).toHaveAttribute('aria-expanded', 'false')
    expect(window.localStorage.getItem('admin.sidebar')).toBe('collapsed')
    // Icons keep their accessible names when the labels are hidden.
    expect(screen.getByRole('link', { name: /^Buyurtmalar/ })).toBeInTheDocument()
  })
})

describe('clients', () => {
  it('lists, opens and edits a client', async () => {
    const patches = recordRequests('patch', '/api/v1/clients/1')
    const { user, router } = renderApp('/clients')

    await user.click(await screen.findByRole('link', { name: 'Jasur Toshmatov' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Jasur Toshmatov' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Buyurtmalar tarixi' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Mijozni tahrirlash' }))
    const first = await screen.findByDisplayValue('Jasur')
    await user.clear(first)
    await user.type(first, 'Jasurbek')
    await user.clear(screen.getByLabelText('Manzil'))
    await user.type(screen.getByLabelText('Manzil'), 'Yunusobod 7')
    await user.click(screen.getByRole('button', { name: "O'zgarishlarni saqlash" }))

    expect(await screen.findByText("Mijoz ma'lumotlari saqlandi")).toBeInTheDocument()
    expect(locationOf(router)).toBe('/clients/1')
    expect(patches[0].body).toEqual({
      first_name: 'Jasurbek',
      last_name: 'Toshmatov',
      phone: '+998901112233',
      location: 'Yunusobod 7',
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'Jasurbek Toshmatov' })).toBeInTheDocument()
  })

  it('searches clients', async () => {
    const requests = recordRequests('get', '/api/v1/clients')
    const { user } = renderApp('/clients')
    await screen.findByRole('link', { name: 'Jasur Toshmatov' })
    await user.type(screen.getByRole('searchbox'), 'madina')
    await waitFor(() => expect(requests.at(-1)!.url.searchParams.get('search')).toBe('madina'))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Jasur Toshmatov' })).not.toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Madina Yusupova' })).toBeInTheDocument()
  })
})

describe('categories', () => {
  it('creates, renames and deletes a category in a modal', async () => {
    const creates = recordRequests('post', '/api/v1/categories')
    const { user } = renderApp('/categories')
    await screen.findByText('Burgerlar')

    await user.click(screen.getByRole('button', { name: "Kategoriya qo'shish" }))
    let dialog = await screen.findByRole('dialog', { name: 'Kategoriya yaratish' })
    await user.click(within(dialog).getByRole('button', { name: 'Yaratish' }))
    expect(within(dialog).getAllByText('Majburiy maydon')).toHaveLength(2)
    expect(creates).toHaveLength(0)

    await user.type(within(dialog).getByLabelText(/Nomi \(O'zbekcha\)/), 'Lavashlar')
    await user.type(within(dialog).getByLabelText(/Nomi \(Ruscha\)/), 'Лаваши')
    await user.click(within(dialog).getByRole('button', { name: 'Yaratish' }))
    expect(await screen.findByText('Kategoriya yaratildi')).toBeInTheDocument()
    expect(creates[0].body).toEqual({ name_uz: 'Lavashlar', name_ru: 'Лаваши' })
    expect(await screen.findByText('Lavashlar')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tahrirlash: Lavashlar' }))
    dialog = await screen.findByRole('dialog', { name: 'Kategoriyani tahrirlash' })
    const name = within(dialog).getByLabelText(/Nomi \(O'zbekcha\)/)
    expect(name).toHaveValue('Lavashlar')
    await user.clear(name)
    await user.type(name, 'Lavash')
    await user.click(within(dialog).getByRole('button', { name: "O'zgarishlarni saqlash" }))
    expect(await screen.findByText('Lavash')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: "O'chirish: Lavash" }))
    dialog = await screen.findByRole('dialog', { name: "Kategoriyani o'chirish" })
    await user.click(within(dialog).getByRole('button', { name: "Ha, o'chirish" }))
    expect(await screen.findByText("Kategoriya o'chirildi")).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Lavash')).not.toBeInTheDocument())
  })

  it('warns that products stay when a category with products is deleted', async () => {
    const { user } = renderApp('/categories')
    await user.click(await screen.findByRole('button', { name: "O'chirish: Burgerlar" }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent("Mahsulotlar o'chirilmaydi, kategoriyasiz qoladi: 4 ta mahsulot.")
    await user.click(within(dialog).getByRole('button', { name: "Ha, o'chirish" }))
    await waitFor(() => expect(store.db.products.filter((product) => product.category === null)).toHaveLength(4))
  })
})

describe('units', () => {
  it('lists units and adds a new one', async () => {
    const creates = recordRequests('post', '/api/v1/units')
    const { user } = renderApp('/units')
    expect(await screen.findByText('porsiya')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: "O'lchov birligi qo'shish" }))
    const dialog = await screen.findByRole('dialog', { name: "O'lchov birligini yaratish" })
    await user.type(within(dialog).getByLabelText(/Nomi \(O'zbekcha\)/), 'kg')
    await user.type(within(dialog).getByLabelText(/Nomi \(Ruscha\)/), 'кг')
    await user.click(within(dialog).getByRole('button', { name: 'Yaratish' }))

    expect(await screen.findByText("O'lchov birligi qo'shildi")).toBeInTheDocument()
    expect(creates[0].body).toEqual({ name_uz: 'kg', name_ru: 'кг' })
    expect(await screen.findByText('кг')).toBeInTheDocument()
  })
})

describe('navigation', () => {
  it('shows a 404 page for unknown addresses', async () => {
    renderApp('/no-such-page')
    expect(await screen.findByRole('heading', { name: 'Sahifa topilmadi' })).toBeInTheDocument()
  })

  it('shows the number of orders waiting in the menu', async () => {
    renderApp('/')
    const nav = await screen.findByRole('navigation', { name: 'Admin panel' })
    expect(await within(nav).findByLabelText('17 ta yangi buyurtma')).toBeInTheDocument()
  })
})
