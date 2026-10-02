import { describe, expect, it } from 'vitest'
import { requestsTo } from '../test/handlers'
import { renderApp, ru, screen, uz } from '../test/render'
import { messages } from './messages'

const langKey = () => `dh:${window.location.host}:lang`

describe('languages', () => {
  it('has every Uzbek string translated to Russian', () => {
    const missing = Object.keys(messages.uz).filter((key) => !messages.ru[key as keyof typeof messages.ru]?.trim())
    expect(missing).toEqual([])
  })

  it('switches the whole shop to Russian and remembers the choice', async () => {
    const { user, unmount } = renderApp({ route: '/profile' })
    expect(await screen.findByRole('heading', { level: 1, name: uz.profile })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('uz')

    await user.click(screen.getByRole('radio', { name: 'Русский' }))

    expect(await screen.findByRole('heading', { level: 1, name: ru.profile })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: ru.login })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('ru')
    expect(JSON.parse(localStorage.getItem(langKey())!)).toBe('ru')

    // A new visit starts in Russian; names of products come from name_ru.
    unmount()
    renderApp()
    expect(await screen.findByRole('heading', { name: ru.popular })).toBeInTheDocument()
    expect((await screen.findAllByRole('article', { name: 'Классический бургер' })).length).toBeGreaterThan(0)
    expect(screen.getAllByText('35 000 сум').length).toBeGreaterThan(0)
  })

  it('saves the language on the account when signed in', async () => {
    const { user } = renderApp({ route: '/profile', signedIn: true })
    await screen.findByRole('heading', { name: 'Aziz Karimov' })
    await user.click(screen.getByRole('radio', { name: 'Русский' }))
    expect(await screen.findByRole('heading', { level: 1, name: ru.profile })).toBeInTheDocument()
    expect(requestsTo('PATCH', 'me')[0]?.body).toEqual({ lang: 'ru' })
  })

  it('uses the language of the account when the customer has not picked one here', async () => {
    const { db } = await import('../test/handlers')
    const { TOKEN } = await import('../test/fixtures')
    db.clients.set(TOKEN, { ...db.clients.get(TOKEN)!, lang: 'ru' })
    renderApp({ signedIn: true })
    expect(await screen.findByRole('heading', { name: ru.popular })).toBeInTheDocument()
    expect(localStorage.getItem(langKey())).toBeNull() // adopted, not a device choice
  })
})
