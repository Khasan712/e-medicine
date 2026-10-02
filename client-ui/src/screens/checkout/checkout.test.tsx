import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { TOKEN } from '../../test/fixtures'
import { requestsTo } from '../../test/handlers'
import { location, pattern, renderApp, screen, som, uz, within } from '../../test/render'
import { server } from '../../test/server'

const storedCart = () => JSON.parse(localStorage.getItem(`dh:${window.location.host}:cart`) ?? 'null')

describe('cart sheet', () => {
  it('sums up lines, enforces the minimum order and clears with undo', async () => {
    const { user } = renderApp({ cart: [{ id: 3, qty: 2 }] })
    await user.click(await screen.findByRole('button', { name: pattern(uz.openCart, '2 ta mahsulot', som(18000)) }))

    const sheet = await screen.findByRole('dialog', { name: uz.cart })
    expect(within(sheet).getByText('Kola 0.5 l')).toBeInTheDocument()
    // 18 000 of the 50 000 minimum: a hint, a progress bar and no checkout yet.
    expect(within(sheet).getByText(`Minimal buyurtma ${som(50000)}. Yana ${som(32000)} qo‘shing`)).toBeInTheDocument()
    expect(within(sheet).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '18000')
    expect(within(sheet).getByRole('button', { name: pattern(uz.checkout) })).toBeDisabled()

    const stepper = within(sheet).getByRole('group', { name: 'Kola 0.5 l: miqdori' })
    for (let i = 0; i < 4; i++) await user.click(within(stepper).getByRole('button', { name: uz.increase }))
    expect(within(sheet).getByTestId('cart-total')).toHaveTextContent(pattern(som(54000)))
    expect(within(sheet).queryByRole('progressbar')).not.toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: pattern(uz.checkout) })).toBeEnabled()

    await user.click(within(sheet).getByRole('button', { name: uz.clear }))
    expect(await within(sheet).findByText(uz.cartEmpty)).toBeInTheDocument()
    expect(storedCart()).toEqual([])
    await user.click(screen.getByRole('button', { name: uz.undo }))
    expect(await within(sheet).findByText('Kola 0.5 l')).toBeInTheDocument()
    expect(storedCart()).toEqual([{ id: 3, qty: 6 }])
  })

  it('asks a guest to sign in before checkout', async () => {
    const { user } = renderApp({ cart: [{ id: 1, qty: 2 }] })
    await user.click(await screen.findByRole('button', { name: pattern(uz.openCart, som(70000)) }))
    await user.click(within(await screen.findByRole('dialog', { name: uz.cart })).getByRole('button', { name: pattern(uz.checkout) }))
    expect(await screen.findByRole('heading', { name: uz.loginTitle })).toBeInTheDocument()
  })
})

describe('checkout', () => {
  const open = async () => {
    const view = renderApp({ route: '/checkout', signedIn: true, cart: [{ id: 1, qty: 2 }] })
    await screen.findByRole('heading', { level: 1, name: uz.checkoutTitle })
    await screen.findByDisplayValue('Aziz Karimov') // the account has been loaded and prefilled the form
    return view
  }

  it('prefills the contact details of the account', async () => {
    await open()
    expect(await screen.findByLabelText(uz.yourName)).toHaveValue('Aziz Karimov')
    expect(screen.getByLabelText(uz.phone)).toHaveValue('90 123 45 67')
    expect(screen.getByLabelText(uz.address)).toHaveValue('Chilonzor 9, 12-uy')
  })

  it('validates required fields before sending anything', async () => {
    const { user } = await open()
    await user.clear(await screen.findByLabelText(uz.yourName))
    await user.clear(screen.getByLabelText(uz.address))
    const phone = screen.getByLabelText(uz.phone)
    await user.clear(phone)
    await user.type(phone, '90 12')

    await user.click(screen.getAllByRole('button', { name: pattern(uz.placeOrder) })[0]!)

    expect(await screen.findByText(uz.required)).toBeInTheDocument()
    expect(screen.getByText(uz.invalidPhone)).toBeInTheDocument()
    expect(screen.getByText(uz.addressOrLocation)).toBeInTheDocument()
    expect(screen.getByLabelText(uz.yourName)).toHaveAttribute('aria-invalid', 'true')
    expect(requestsTo('POST', 'orders')).toHaveLength(0)

    // Typing fixes the field and clears its error.
    await user.type(screen.getByLabelText(uz.yourName), 'Aziz')
    expect(screen.queryByText(uz.required)).not.toBeInTheDocument()
  })

  it('does not ask for an address for pickup', async () => {
    const { user } = await open()
    await user.click(await screen.findByRole('radio', { name: uz.pickup }))
    expect(screen.queryByLabelText(uz.address)).not.toBeInTheDocument()
    expect(screen.getByText(uz.pickupNote)).toBeInTheDocument()
  })

  it('maps server validation errors to the fields', async () => {
    server.use(
      http.post('/api/v1/orders', () =>
        HttpResponse.json({ error: 'validation', fields: { phone: ['invalid'], address: ['required'] } }, { status: 400 }),
      ),
    )
    const { user } = await open()
    await user.click(screen.getAllByRole('button', { name: pattern(uz.placeOrder) })[0]!)
    expect(await screen.findByText(uz.invalidPhone)).toBeInTheDocument()
    expect(screen.getByText(uz.required)).toBeInTheDocument()
    expect(screen.getByLabelText(uz.address)).toHaveAttribute('aria-invalid', 'true')
  })

  it('explains a minimum order rejected by the server', async () => {
    server.use(http.post('/api/v1/orders', () => HttpResponse.json({ error: 'min_order', min_order: 100000 }, { status: 400 })))
    const { user } = await open()
    await user.click(screen.getAllByRole('button', { name: pattern(uz.placeOrder) })[0]!)
    expect((await screen.findAllByText(`Minimal buyurtma summasi — ${som(100000)}`)).length).toBeGreaterThan(0)
  })

  it('places the order, clears the cart and opens the order tracker', async () => {
    const { user } = await open()
    await user.click(await screen.findByRole('radio', { name: uz.card }))
    await user.type(screen.getByRole('textbox', { name: pattern(uz.comment) }), 'Domofon 25')
    await user.click(screen.getAllByRole('button', { name: pattern(uz.placeOrder, som(70000)) })[0]!)

    expect(await screen.findByRole('heading', { name: uz.orderPlaced })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Buyurtma #200' })).toBeInTheDocument()
    expect(location.current?.pathname).toBe('/orders/200')
    expect(storedCart()).toEqual([])

    const [request] = requestsTo('POST', 'orders')
    expect(request?.auth).toBe(`Bearer ${TOKEN}`)
    expect(request?.body).toEqual({
      items: [{ product_id: 1, quantity: 2 }],
      name: 'Aziz Karimov',
      phone: '+998901234567',
      delivery_type: 'delivery',
      address: 'Chilonzor 9, 12-uy',
      lat: null,
      lng: null,
      payment_method: 'card',
      comment: 'Domofon 25',
      platform: 'web',
      lang: 'uz',
    })
    // Contact details are remembered for the next order (without the comment).
    expect(JSON.parse(localStorage.getItem(`dh:${window.location.host}:contact`)!)).toMatchObject({
      name: 'Aziz Karimov',
      payment_method: 'card',
    })
  })

  it('signs the customer out when the token is rejected', async () => {
    server.use(http.post('/api/v1/orders', () => HttpResponse.json({ error: 'auth_required' }, { status: 401 })))
    const { user } = await open()
    await user.click(screen.getAllByRole('button', { name: pattern(uz.placeOrder) })[0]!)
    expect(await screen.findByText(uz.sessionExpired)).toBeInTheDocument()
    expect(localStorage.getItem(`dh:${window.location.host}:token`)).toBeNull()
    expect(await screen.findByRole('heading', { name: uz.signInToOrder })).toBeInTheDocument()
  })

  it('removes products that disappeared from the menu', async () => {
    server.use(
      http.post('/api/v1/orders', () => HttpResponse.json({ error: 'product_not_found', detail: [1] }, { status: 400 })),
    )
    const { user } = await open()
    await user.click(screen.getAllByRole('button', { name: pattern(uz.placeOrder) })[0]!)
    expect(await screen.findByText(uz.productGone)).toBeInTheDocument()
    expect(storedCart()).toEqual([])
  })
})
