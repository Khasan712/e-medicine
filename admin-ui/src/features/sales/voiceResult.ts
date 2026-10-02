import { ApiError } from '../../api/client'
import type { CartItem, SaleForm, VoiceResult } from '../../api/types'
import type { DictKey } from '../../i18n/dict'
import { MAX_QTY, statusFor } from './cart'

export const FORM_FIELDS = ['customer_name', 'phone', 'address', 'delivery_type', 'payment_method', 'status', 'comment'] as const
export type FormField = (typeof FORM_FIELDS)[number]

const CHOICES: Partial<Record<FormField, readonly string[]>> = {
  delivery_type: ['pickup', 'delivery'],
  payment_method: ['cash', 'card'],
  status: ['ordered', 'on_the_way', 'completed'],
}

/** The order form at one moment — what "Undo" restores. */
export interface Snapshot {
  items: CartItem[]
  form: SaleForm
  /** The status still follows the delivery type (the user / AI has not chosen one). */
  statusAuto: boolean
}

export interface ApplyOutcome {
  next: Snapshot
  changedFields: FormField[]
  changedItems: number[]
  changes: number
}

/**
 * Applies the AI result (the complete updated form) to the current form — ported from the old panel:
 * empty choice values are ignored, an explicit status stops following the delivery type, a new delivery
 * type still moves an automatic status, items of unknown products are dropped.
 */
export function applyVoiceResult(current: Snapshot, result: VoiceResult, isKnownProduct: (id: number) => boolean): ApplyOutcome {
  const form: SaleForm = { ...current.form }
  let statusAuto = current.statusAuto
  const changedFields: FormField[] = []

  for (const field of FORM_FIELDS) {
    const raw = result[field]
    const value = typeof raw === 'string' ? raw : raw == null ? '' : String(raw)
    const choices = CHOICES[field]
    if (choices && (!value || !choices.includes(value))) continue
    if (value === current.form[field]) continue
    changedFields.push(field)
    ;(form as unknown as Record<FormField, string>)[field] = value
    if (field === 'status') statusAuto = false
    if (field === 'delivery_type' && statusAuto) form.status = statusFor(form.delivery_type)
  }

  const next = (result.items ?? [])
    .filter((item) => isKnownProduct(item.product_id) && Number(item.quantity) > 0)
    .map((item) => ({ product_id: item.product_id, quantity: Math.min(Math.trunc(Number(item.quantity)), MAX_QTY) }))
  const previous = new Map(current.items.map((item) => [item.product_id, item.quantity]))
  const changedItems = next.filter((item) => previous.get(item.product_id) !== item.quantity).map((item) => item.product_id)
  const removed = current.items.some((item) => !next.some((line) => line.product_id === item.product_id))

  return {
    next: { items: next, form, statusAuto },
    changedFields,
    changedItems,
    changes: changedFields.length + changedItems.length + (removed ? 1 : 0),
  }
}

/** /voice/parse errors → message (the precise texts of the old panel). */
export function voiceErrorKey(error: unknown): DictKey {
  if (!(error instanceof ApiError)) return 'voice_ai_failed'
  switch (error.code) {
    case 'not_configured':
      return 'voice_not_configured'
    case 'empty':
    case 'empty_transcript':
      return 'voice_nothing_heard'
    case 'audio_too_large':
      return 'voice_too_long'
    case 'network':
      return 'voice_network'
    case 'too_many_requests':
      return 'voice_rate_limited'
    default:
      return 'voice_ai_failed'
  }
}

/** Web Speech API error codes → message. */
export function speechErrorKey(code: string | null | undefined): DictKey {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'voice_speech_denied'
    case 'audio-capture':
      return 'voice_speech_no_mic'
    case 'language-not-supported':
      return 'voice_speech_language'
    case 'network':
    case 'bad-grammar':
      return 'voice_speech_unavailable'
    default:
      return 'voice_nothing_heard'
  }
}

/** getUserMedia errors → message. */
export function microphoneErrorKey(error: unknown): DictKey {
  const name = error instanceof DOMException || error instanceof Error ? error.name : ''
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'voice_speech_no_mic'
  if (name === 'NotReadableError' || name === 'AbortError') return 'voice_mic_busy'
  if (name === 'SecurityError') return 'voice_insecure'
  return 'voice_mic_denied'
}
