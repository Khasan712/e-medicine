import { act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { db, requestsTo } from '../../test/handlers'
import { location, renderApp, screen, uz, within } from '../../test/render'
import { TELEGRAM_POLL_MS } from './AuthSheet'

const tokenKey = () => `dh:${window.location.host}:token`

describe('sign-in on the website', () => {
  it('signs in with a phone number and an SMS code, then asks for the name of a new account', async () => {
    const { user } = renderApp({ route: '/profile' })
    await user.click(await screen.findByRole('button', { name: uz.login }))

    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByRole('heading', { name: uz.loginTitle })).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: uz.viaPhone }))

    // Phone step: "+998" is fixed, the rest is formatted while typing; the button waits for 9 digits.
    const phone = await within(sheet).findByRole('textbox', { name: uz.phone })
    expect(phone).toHaveFocus()
    const getCode = within(sheet).getByRole('button', { name: uz.getCode })
    await user.type(phone, '90123')
    expect(phone).toHaveValue('90 123')
    expect(getCode).toBeDisabled()
    await user.type(phone, '4567')
    expect(phone).toHaveValue('90 123 45 67')
    await user.click(getCode)

    // Code step: the code went to the number, the dev code and the resend timer are shown.
    expect(await within(sheet).findByRole('heading', { name: uz.codeTitle })).toBeInTheDocument()
    expect(requestsTo('POST', 'auth/phone/request')[0]?.body).toEqual({ phone: '+998901234567' })
    expect(within(sheet).getByText('+998 90 123 45 67')).toBeInTheDocument()
    expect(within(sheet).getByText('123456')).toBeInTheDocument()
    expect(within(sheet).getByText('Qayta yuborish — 1:00')).toBeInTheDocument()

    // A wrong code tells how many attempts are left and empties the boxes.
    const code = within(sheet).getByLabelText(uz.codeInput)
    await user.type(code, '111111')
    expect(await within(sheet).findByText('Kod noto‘g‘ri. 4 ta urinish qoldi')).toBeInTheDocument()
    expect(code).toHaveValue('')

    // The right code signs in (new account → name step) and stores the token for this host.
    await user.type(within(sheet).getByLabelText(uz.codeInput), '123456')
    expect(await within(sheet).findByRole('heading', { name: uz.nameTitle })).toBeInTheDocument()
    expect(requestsTo('POST', 'auth/phone/verify').at(-1)?.body).toEqual({ phone: '+998901234567', code: '123456', lang: 'uz' })
    expect(JSON.parse(localStorage.getItem(tokenKey())!)).toBe('phone-token')

    await user.type(within(sheet).getByRole('textbox', { name: uz.yourName }), 'Aziz Karimov')
    await user.click(within(sheet).getByRole('button', { name: uz.continue }))

    expect(await screen.findByText('Xush kelibsiz, Aziz!')).toBeInTheDocument()
    expect(requestsTo('PATCH', 'me')[0]).toMatchObject({
      auth: 'Bearer phone-token',
      body: { first_name: 'Aziz', last_name: 'Karimov', lang: 'uz' },
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('heading', { name: 'Aziz Karimov' })).toBeInTheDocument()
    expect(location.current?.pathname).toBe('/profile')
  })

  it('continues to checkout after signing in from the cart', async () => {
    const { user } = renderApp({ cart: [{ id: 1, qty: 2 }] })
    await user.click(await screen.findByRole('button', { name: /^Savatni ochish:.*so‘m/ }))
    await user.click(within(await screen.findByRole('dialog', { name: uz.cart })).getByRole('button', { name: /Rasmiylashtirish/ }))
    const sheet = await screen.findByRole('dialog')
    await user.click(within(sheet).getByRole('button', { name: uz.viaPhone }))
    await user.type(await within(sheet).findByRole('textbox', { name: uz.phone }), '901234567')
    await user.click(within(sheet).getByRole('button', { name: uz.getCode }))
    await user.type(await within(sheet).findByLabelText(uz.codeInput), '123456')
    await user.click(await within(sheet).findByRole('button', { name: uz.skip }))

    expect(await screen.findByRole('heading', { level: 1, name: uz.checkoutTitle })).toBeInTheDocument()
    expect(location.current?.pathname).toBe('/checkout')
  })

  it('signs in through the Telegram bot: opens the deep link and polls every 2 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const open = vi.spyOn(window, 'open')
    try {
      const { user } = renderApp({ route: '/profile' })
      await user.click(await screen.findByRole('button', { name: uz.login }))
      const sheet = await screen.findByRole('dialog')
      await user.click(within(sheet).getByRole('button', { name: uz.viaTelegram }))

      expect(await within(sheet).findByRole('heading', { name: uz.tgTitle })).toBeInTheDocument()
      const deepLink = 'https://t.me/burger_house_bot?start=login_login-1'
      expect(open).toHaveBeenCalledWith(deepLink, '_blank', 'noopener,noreferrer')
      expect(within(sheet).getByRole('link', { name: uz.openTelegram })).toHaveAttribute('href', deepLink)
      expect(within(sheet).getByText(uz.waiting)).toBeInTheDocument()

      await act(() => vi.advanceTimersByTimeAsync(TELEGRAM_POLL_MS))
      await vi.waitFor(() => expect(requestsTo('GET', 'auth/telegram/check')).toHaveLength(1))

      db.telegramLogin = 'confirmed' // the customer pressed "Start" in the bot
      await act(() => vi.advanceTimersByTimeAsync(TELEGRAM_POLL_MS))

      expect(await screen.findByText('Xush kelibsiz, Aziz!')).toBeInTheDocument()
      expect(JSON.parse(localStorage.getItem(tokenKey())!)).toBe('tg-login-token')
      expect(await screen.findByText('@aziz_tg')).toBeInTheDocument() // Telegram account row in the profile
    } finally {
      vi.useRealTimers()
    }
  })

  it('offers a new link when the Telegram link expires', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      db.telegramLogin = 'expired'
      const { user } = renderApp({ route: '/profile' })
      await user.click(await screen.findByRole('button', { name: uz.login }))
      const sheet = await screen.findByRole('dialog')
      await user.click(within(sheet).getByRole('button', { name: uz.viaTelegram }))
      await within(sheet).findByRole('heading', { name: uz.tgTitle })
      await act(() => vi.advanceTimersByTimeAsync(TELEGRAM_POLL_MS))
      expect(await within(sheet).findByText(uz.linkExpired)).toBeInTheDocument()
      expect(within(sheet).getByRole('button', { name: uz.tryAgain })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('signs out from the profile', async () => {
    const { user } = renderApp({ route: '/profile', signedIn: true })
    expect(await screen.findByRole('heading', { name: 'Aziz Karimov' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: uz.logout }))
    expect(await screen.findByText(uz.loggedOut)).toBeInTheDocument()
    expect(localStorage.getItem(tokenKey())).toBeNull()
    expect(location.current?.pathname).toBe('/')
  })

  it('drops a token the shop no longer accepts', async () => {
    localStorage.setItem(tokenKey(), JSON.stringify('expired-token'))
    renderApp({ route: '/profile' })
    expect(await screen.findByRole('button', { name: uz.login })).toBeInTheDocument()
    expect(localStorage.getItem(tokenKey())).toBeNull()
  })
})
