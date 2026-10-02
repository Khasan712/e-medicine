import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import type { VoiceResult } from '../api/types'
import { DEFAULT_SALE_FORM } from '../features/sales/cart'
import { applyVoiceResult, microphoneErrorKey, speechErrorKey, voiceErrorKey } from '../features/sales/voiceResult'
import { renderApp } from './render'
import { recordRequests, server } from './server'

describe('applying an AI result', () => {
  const known = (id: number) => id < 100
  const current = { items: [{ product_id: 1, quantity: 2 }], form: DEFAULT_SALE_FORM, statusAuto: true }

  it('takes the complete updated form, drops unknown products and counts the changes', () => {
    const outcome = applyVoiceResult(
      current,
      {
        customer_name: 'Aziz',
        phone: '',
        items: [
          { product_id: 1, quantity: 2 },
          { product_id: 5, quantity: 1 },
          { product_id: 404, quantity: 1 },
        ],
      },
      known,
    )
    expect(outcome.next.items).toEqual([
      { product_id: 1, quantity: 2 },
      { product_id: 5, quantity: 1 },
    ])
    expect(outcome.next.form.customer_name).toBe('Aziz')
    expect(outcome.changedFields).toEqual(['customer_name'])
    expect(outcome.changedItems).toEqual([5])
    expect(outcome.changes).toBe(2)
  })

  it('moves an automatic status with the delivery type, keeps an explicit one', () => {
    const delivery = applyVoiceResult(current, { delivery_type: 'delivery', status: 'completed' }, known)
    expect(delivery.next.form.status).toBe('ordered')
    expect(delivery.next.statusAuto).toBe(true)

    const explicit = applyVoiceResult(current, { delivery_type: 'delivery', status: 'on_the_way' }, known)
    expect(explicit.next.form.status).toBe('on_the_way')
    expect(explicit.next.statusAuto).toBe(false)
  })

  it('ignores empty or unknown choice values and counts removed items', () => {
    const outcome = applyVoiceResult(current, { payment_method: '', delivery_type: 'teleport', items: [] }, known)
    expect(outcome.next.form.payment_method).toBe('cash')
    expect(outcome.next.form.delivery_type).toBe('pickup')
    expect(outcome.next.items).toEqual([])
    expect(outcome.changes).toBe(1)
  })
})

describe('voice error messages', () => {
  it('maps API, speech and microphone errors to precise texts', () => {
    expect(voiceErrorKey(new ApiError(400, 'not_configured'))).toBe('voice_not_configured')
    expect(voiceErrorKey(new ApiError(400, 'empty_transcript'))).toBe('voice_nothing_heard')
    expect(voiceErrorKey(new ApiError(400, 'audio_too_large'))).toBe('voice_too_long')
    expect(voiceErrorKey(new ApiError(502, 'transcription_failed'))).toBe('voice_ai_failed')
    expect(voiceErrorKey(new ApiError(0, 'network'))).toBe('voice_network')
    expect(speechErrorKey('not-allowed')).toBe('voice_speech_denied')
    expect(speechErrorKey('language-not-supported')).toBe('voice_speech_language')
    expect(speechErrorKey('audio-capture')).toBe('voice_speech_no_mic')
    expect(speechErrorKey('network')).toBe('voice_speech_unavailable')
    expect(speechErrorKey(null)).toBe('voice_nothing_heard')
    expect(microphoneErrorKey(new DOMException('', 'NotAllowedError'))).toBe('voice_mic_denied')
    expect(microphoneErrorKey(new DOMException('', 'NotFoundError'))).toBe('voice_speech_no_mic')
    expect(microphoneErrorKey(new DOMException('', 'NotReadableError'))).toBe('voice_mic_busy')
  })
})

const AI_RESULT: VoiceResult = {
  customer_name: 'Aziz',
  phone: '+998901234567',
  address: 'Chilonzor 9',
  delivery_type: 'delivery',
  payment_method: 'card',
  status: 'completed',
  comment: '',
  items: [
    { product_id: 5, quantity: 2 },
    { product_id: 8, quantity: 1 },
    { product_id: 999, quantity: 3 },
  ],
  unmatched: ['lavash'],
  submit: true,
  reply: 'Tushundim: 2 ta pepperoni va 1 kola',
  transcript: 'ikkita pepperoni bitta kola lavash mijoz Aziz',
}

function panel() {
  return screen.getByRole('region', { name: 'Yangi buyurtma' })
}

describe('voice assistant on the point of sale', () => {
  it('sends a typed command with the current form, applies the result and undoes it', async () => {
    server.use(http.post('/api/v1/voice/parse', () => HttpResponse.json({ result: AI_RESULT, engine: 'gemini' })))
    const parses = recordRequests('post', '/api/v1/voice/parse')
    const { user } = renderApp('/sales')

    await user.click(await screen.findByRole('button', { name: /^Buyurtmaga qo'shish: Chizburger,/ }))
    const command = screen.getByRole('textbox', { name: 'Yoki yozib yuboring…' })
    await user.type(command, 'ikkita pepperoni bitta kola, mijoz Aziz{Enter}')

    expect(await screen.findByText('Tushundim: 2 ta pepperoni va 1 kola')).toBeInTheDocument()
    expect(parses[0].body).toEqual({
      text: 'ikkita pepperoni bitta kola, mijoz Aziz',
      state: { ...DEFAULT_SALE_FORM, items: [{ product_id: 1, quantity: 1 }] },
      lang: 'uz',
    })
    expect(command).toHaveValue('')

    // The bubble: what was heard, words that matched nothing, the "create" hint.
    expect(screen.getByText('“ikkita pepperoni bitta kola lavash mijoz Aziz”')).toBeInTheDocument()
    expect(screen.getByText('lavash')).toBeInTheDocument()
    expect(screen.getByText(/«Yarat» dedingiz/)).toBeInTheDocument()
    expect(screen.getByText('Gemini AI')).toBeInTheDocument()

    // The form is filled, AI-filled fields are marked, the unknown product (999) is dropped.
    const order = panel()
    expect(within(order).getByLabelText(/Mijoz ismi/)).toHaveValue('Aziz')
    expect(within(order).getByLabelText(/^Telefon/)).toHaveValue('+998901234567')
    expect(within(order).getByLabelText(/^Manzil/)).toHaveValue('Chilonzor 9')
    expect(within(order).getByRole('radio', { name: 'Yetkazib berish' })).toBeChecked()
    expect(within(order).getByRole('radio', { name: 'Karta' })).toBeChecked()
    // The AI kept "completed", but the status still follows delivery automatically.
    expect(within(order).getByLabelText(/^Holat/)).toHaveValue('ordered')
    expect(within(order).getAllByText('AI').length).toBeGreaterThanOrEqual(5)
    const lines = within(order).getByRole('list', { name: 'Buyurtma mahsulotlari' })
    expect(within(lines).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Pepperoni'),
      expect.stringContaining('Coca-Cola 0.5'),
    ])
    expect(within(order).getByRole('button', { name: 'Buyurtma yaratish' })).toHaveClass('is-hinted')

    // Editing a field takes the AI mark away from it.
    const name = within(order).getByLabelText(/Mijoz ismi/)
    await user.type(name, ' Karimov')
    expect(within(name.closest('div')!).queryByText('AI')).not.toBeInTheDocument()
    expect(within(within(order).getByLabelText(/^Telefon/).closest('div')!).getByText('AI')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Qaytarish' }))
    expect(within(order).getByLabelText(/Mijoz ismi/)).toHaveValue('')
    expect(within(order).getByRole('radio', { name: 'Olib ketish' })).toBeChecked()
    expect(within(order).getByLabelText(/^Holat/)).toHaveValue('completed')
    expect(within(order).queryAllByText('AI')).toHaveLength(0)
    expect(within(within(order).getByRole('list', { name: 'Buyurtma mahsulotlari' })).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.queryByText('Tushundim: 2 ta pepperoni va 1 kola')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Qaytarish' })).not.toBeInTheDocument()
  })

  it('asks for the reply in the interface language', async () => {
    const parses = recordRequests('post', '/api/v1/voice/parse')
    const { user } = renderApp('/sales', { lang: 'ru' })
    await user.type(await screen.findByRole('textbox', { name: 'Или напишите…' }), 'две пепперони{Enter}')
    await waitFor(() => expect(parses).toHaveLength(1))
    expect(parses[0].body).toMatchObject({ text: 'две пепперони', lang: 'ru' })
    expect(await screen.findByText(/Понял: 2 шт/)).toBeInTheDocument()
  })

  it('shows precise errors from the parser', async () => {
    server.use(http.post('/api/v1/voice/parse', () => HttpResponse.json({ error: 'ai_failed' }, { status: 502 })))
    const { user } = renderApp('/sales')
    await user.type(await screen.findByRole('textbox', { name: 'Yoki yozib yuboring…' }), 'nimadir{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent("AI javob bermadi. Qayta urinib ko'ring")

    server.use(http.post('/api/v1/voice/parse', () => HttpResponse.json({ error: 'not_configured' }, { status: 400 })))
    await user.type(screen.getByRole('textbox', { name: 'Yoki yozib yuboring…' }), 'yana{Enter}')
    expect(await screen.findByText('Ovozli AI (Gemini) sozlanmagan')).toBeInTheDocument()
  })

  it('explains when the browser cannot record', async () => {
    const { user } = renderApp('/sales')
    await user.click(await screen.findByRole('button', { name: 'Gapirishni boshlash' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Brauzer mikrofonni qo'llab-quvvatlamaydi")
  })
})
