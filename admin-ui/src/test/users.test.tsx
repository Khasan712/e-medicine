import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { locationOf, renderApp } from './render'
import { recordRequests } from './server'

describe('staff users', () => {
  it('are hidden from managers (no menu item, no page)', async () => {
    const requests = recordRequests('get', '/api/v1/users')
    renderApp('/', { as: 'manager' })

    const nav = await screen.findByRole('navigation', { name: 'Admin panel' })
    expect(within(nav).getByRole('link', { name: 'Mahsulotlar' })).toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Foydalanuvchilar' })).not.toBeInTheDocument()

    renderApp('/users', { as: 'manager' })
    expect(await screen.findByRole('heading', { name: "Ruxsat yo'q" })).toBeInTheDocument()
    expect(requests).toHaveLength(0)
  })

  it('are listed for admins, without a delete button for yourself', async () => {
    renderApp('/users')

    const nav = await screen.findByRole('navigation', { name: 'Admin panel' })
    expect(within(nav).getByRole('link', { name: 'Foydalanuvchilar' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Dilnoza Rahimova' })).toBeInTheDocument()

    const table = screen.getByRole('table', { name: 'Tizim foydalanuvchilari' })
    const me = within(table).getByRole('link', { name: 'Aziz Karimov' }).closest('tr')!
    expect(within(me).getByText('siz')).toBeInTheDocument()
    expect(within(me).queryByRole('button', { name: /O'chirish/ })).not.toBeInTheDocument()
    const other = within(table).getByRole('link', { name: 'Sardor Aliyev' }).closest('tr')!
    expect(within(other).getByText('Nofaol')).toBeInTheDocument()
    expect(within(other).getByRole('button', { name: "O'chirish: Sardor Aliyev" })).toBeInTheDocument()
  })

  it('creates a staff member, checking the password first', async () => {
    const creates = recordRequests('post', '/api/v1/users')
    const { user, router } = renderApp('/users/new')

    await user.type(await screen.findByLabelText(/^Telefon/), '93 111 22 33')
    await user.type(screen.getByLabelText('Ism'), 'Kamola')
    await user.type(screen.getByLabelText(/^Parol\*?$/), 'short')
    await user.type(screen.getByLabelText(/Parolni tasdiqlang/), 'other')
    await user.click(screen.getByRole('button', { name: 'Foydalanuvchi yaratish' }))

    expect(screen.getByText('Kamida 8 ta belgi', { selector: 'p[id$="-error"]' })).toBeInTheDocument()
    expect(screen.getByText('Parollar mos emas')).toBeInTheDocument()
    expect(creates).toHaveLength(0)

    await user.clear(screen.getByLabelText(/^Parol\*?$/))
    await user.type(screen.getByLabelText(/^Parol\*?$/), 'secret-pass-1')
    await user.clear(screen.getByLabelText(/Parolni tasdiqlang/))
    await user.type(screen.getByLabelText(/Parolni tasdiqlang/), 'secret-pass-1')
    await user.click(screen.getByRole('radio', { name: /Administrator/ }))
    await user.click(screen.getByRole('button', { name: 'Foydalanuvchi yaratish' }))

    expect(await screen.findByText('Foydalanuvchi yaratildi')).toBeInTheDocument()
    expect(locationOf(router)).toBe('/users')
    expect(creates[0].body).toEqual({
      phone_number: '93 111 22 33',
      first_name: 'Kamola',
      last_name: '',
      role: 'admin',
      is_active: true,
      password: 'secret-pass-1',
    })
    expect(await screen.findByRole('link', { name: 'Kamola' })).toBeInTheDocument()
  })

  it('maps a duplicate phone to the field', async () => {
    const { user } = renderApp('/users/new')
    await user.type(await screen.findByLabelText(/^Telefon/), '+998901234567')
    await user.type(screen.getByLabelText(/^Parol\*?$/), 'password-123')
    await user.type(screen.getByLabelText(/Parolni tasdiqlang/), 'password-123')
    await user.click(screen.getByRole('button', { name: 'Foydalanuvchi yaratish' }))
    expect(await screen.findByText('Bu qiymat allaqachon band')).toBeInTheDocument()
  })

  it('does not let you change your own role or status', async () => {
    const patches = recordRequests('patch', '/api/v1/users/1')
    const { user } = renderApp('/users/1/edit')

    expect(await screen.findByDisplayValue('Aziz')).toBeInTheDocument()
    expect(screen.getByText("O'z rolingiz va holatingizni o'zgartira olmaysiz")).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Administrator/ })).toBeDisabled()
    expect(screen.getByRole('switch', { name: 'Faol' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: "O'chirish" })).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText('Familiya'))
    await user.type(screen.getByLabelText('Familiya'), 'Karimov-Aliyev')
    await user.click(screen.getByRole('button', { name: "O'zgarishlarni saqlash" }))

    await waitFor(() => expect(patches).toHaveLength(1))
    expect(patches[0].body).toEqual({ phone_number: '+998901234567', first_name: 'Aziz', last_name: 'Karimov-Aliyev' })
  })

  it('deletes another staff member after confirmation', async () => {
    const deletes = recordRequests('delete', '/api/v1/users/3')
    const { user } = renderApp('/users')

    await user.click(await screen.findByRole('button', { name: "O'chirish: Sardor Aliyev" }))
    const dialog = await screen.findByRole('dialog', { name: "Foydalanuvchini o'chirish" })
    await user.click(within(dialog).getByRole('button', { name: "Ha, o'chirish" }))

    expect(await screen.findByText("Foydalanuvchi o'chirildi")).toBeInTheDocument()
    expect(deletes).toHaveLength(1)
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Sardor Aliyev' })).not.toBeInTheDocument())
  })
})
