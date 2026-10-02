import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { resetDb } from '../mocks/data'
import { renderApp } from './render'
import { recordRequests, server } from './server'

describe('Telegram bot page', () => {
  it('connects your Telegram: one-time link, QR code, copy and open in Telegram with the expiry', async () => {
    resetDb((db) => {
      db.links = db.links.filter((link) => link.user.id !== 1)
    })
    const invites = recordRequests('post', '/api/v1/telegram/invites')
    const { user } = renderApp('/telegram')

    expect(await screen.findByText('Ishlayapti')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Botni ochish/ })).toHaveAttribute('href', 'https://t.me/burger_house_staff_bot')
    await user.click(screen.getByRole('button', { name: "Telegram'ni ulash" }))

    const dialog = await screen.findByRole('dialog', { name: "Telegram'ni ulash" })
    const qr = await within(dialog).findByRole('img', { name: 'Ulanish havolasining QR kodi' })
    expect(qr.getAttribute('src')).toMatch(/^data:image\/svg\+xml;charset=utf-8,%3Csvg/)
    expect(invites[0].body).toEqual({})
    expect(dialog).toHaveTextContent('Kim uchun: Aziz Karimov')

    const link = within(dialog).getByRole('textbox', { name: "Telegram'ni ulash" }) as HTMLInputElement
    expect(link.value).toMatch(/^https:\/\/t\.me\/burger_house_staff_bot\?start=inv_/)
    expect(within(dialog).getByRole('link', { name: "Telegram'da ochish" })).toHaveAttribute('href', link.value)
    expect(dialog).toHaveTextContent(/Bir martalik havola, \d{2}:\d{2} gacha amal qiladi/)
    expect(dialog).toHaveTextContent(/\((9|10):\d{2}\)/)

    const write = vi.spyOn(navigator.clipboard, 'writeText')
    await user.click(within(dialog).getByRole('button', { name: 'Nusxa olish' }))
    expect(within(dialog).getByRole('button', { name: 'Nusxalandi' })).toBeInTheDocument()
    expect(write).toHaveBeenCalledWith(link.value)

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('lets an admin create a link for a team member', async () => {
    const invites = recordRequests('post', '/api/v1/telegram/invites')
    const { user } = renderApp('/telegram')

    const team = await screen.findByRole('region', { name: 'Jamoa' })
    await user.selectOptions(within(team).getByRole('combobox', { name: 'Xodimni tanlang' }), 'Dilnoza Rahimova')
    await user.click(within(team).getByRole('button', { name: 'Havola yaratish' }))

    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Dilnoza Rahimova')).toBeInTheDocument()
    expect(invites[0].body).toEqual({ user_id: 2 })
  })

  it('hides the team for managers', async () => {
    renderApp('/telegram', { as: 'manager' })
    expect(await screen.findByRole('heading', { name: 'Mening Telegram akkauntim' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Jamoa' })).not.toBeInTheDocument()
  })

  it('explains a missing bot and a failed link', async () => {
    resetDb((db) => {
      db.bot = null
      db.links = []
    })
    renderApp('/telegram')
    expect(await screen.findByText(/Xodimlar boti hali ulanmagan/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "Telegram'ni ulash" })).toBeDisabled()
  })

  it('shows the API error inside the invite dialog', async () => {
    server.use(http.post('/api/v1/telegram/invites', () => HttpResponse.json({ error: 'bot_missing' }, { status: 400 })))
    const { user } = renderApp('/telegram')
    await user.click(await screen.findByRole('button', { name: /Yana akkaunt ulash/ }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("Xodimlar boti ulanmagan — havola yaratib bo'lmaydi.")
  })

  it('switches order notifications and unlinks an account after confirmation', async () => {
    const patches = recordRequests('patch', '/api/v1/telegram/links/1')
    const deletes = recordRequests('delete', '/api/v1/telegram/links/1')
    const { user } = renderApp('/telegram')

    const mine = await screen.findByRole('region', { name: 'Mening Telegram akkauntim' })
    const toggle = within(mine).getByRole('switch', { name: 'Yangi buyurtmalar: Aziz' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await user.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
    expect(patches[0].body).toEqual({ notify_orders: false })
    expect(await screen.findByText("Yangi buyurtmalar xabari o'chirildi")).toBeInTheDocument()

    await user.click(within(mine).getByRole('button', { name: 'Uzish' }))
    const dialog = await screen.findByRole('dialog', { name: 'Telegram akkaunt uzilsinmi?' })
    await user.click(within(dialog).getByRole('button', { name: 'Uzish' }))
    expect(await screen.findByText('Telegram akkaunt uzildi')).toBeInTheDocument()
    expect(deletes).toHaveLength(1)
    expect(await within(mine).findByText(/Telegram hali ulanmagan/)).toBeInTheDocument()
  })
})
