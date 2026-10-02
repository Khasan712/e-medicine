import type { Client, DeliveryType, Lang, NewOrder, PaymentMethod } from '../../api/types'
import type { MessageKey } from '../../i18n/messages'
import { isCompleteLocalPhone, localDigits, toE164, toNumber } from '../../lib/format'
import { readSession, readStorage, removeSession, writeSession, writeStorage } from '../../lib/storage'
import type { CartLine } from '../../state/cart'

export interface CheckoutForm {
  name: string
  /** Local digits without +998. */
  phone: string
  delivery_type: DeliveryType
  address: string
  lat: number | null
  lng: number | null
  payment_method: PaymentMethod
  comment: string
}

export type CheckoutField = 'name' | 'phone' | 'address'
export type CheckoutErrors = Partial<Record<CheckoutField, MessageKey>>

export const EMPTY_FORM: CheckoutForm = {
  name: '',
  phone: '',
  delivery_type: 'delivery',
  address: '',
  lat: null,
  lng: null,
  payment_method: 'cash',
  comment: '',
}

const DRAFT_KEY = 'checkout-draft'

function sanitize(raw: unknown): Partial<CheckoutForm> {
  if (!raw || typeof raw !== 'object') return {}
  const value = raw as Record<string, unknown>
  const form: Partial<CheckoutForm> = {}
  if (typeof value.name === 'string') form.name = value.name
  if (typeof value.phone === 'string') form.phone = localDigits(value.phone)
  if (value.delivery_type === 'delivery' || value.delivery_type === 'pickup') form.delivery_type = value.delivery_type
  if (typeof value.address === 'string') form.address = value.address
  if (value.lat !== undefined) form.lat = toNumber(value.lat as string | number | null)
  if (value.lng !== undefined) form.lng = toNumber(value.lng as string | number | null)
  if (value.payment_method === 'cash' || value.payment_method === 'card') form.payment_method = value.payment_method
  if (typeof value.comment === 'string') form.comment = value.comment
  if ((form.lat !== undefined || form.lng !== undefined) && (form.lat == null || form.lng == null)) {
    form.lat = null
    form.lng = null
  }
  return form
}

/** The draft of this tab, else the contact details of the last order on this device. */
export function initialForm(): CheckoutForm {
  return { ...EMPTY_FORM, ...sanitize(readStorage<unknown>('contact', null)), ...sanitize(readSession<unknown>(DRAFT_KEY, null)) }
}

export function saveDraft(form: CheckoutForm): void {
  writeSession(DRAFT_KEY, form)
}

/** After an order: remember the contact details (not the comment) and forget the draft. */
export function rememberContact(form: CheckoutForm): void {
  const { comment: _comment, ...contact } = form
  writeStorage('contact', contact)
  removeSession(DRAFT_KEY)
}

/**
 * Fills empty fields from the customer's account (name, phone, last delivery address); fields the customer
 * already edited are left alone.
 */
export function fillFromClient(
  form: CheckoutForm,
  client: Client,
  fullName: string,
  touched: ReadonlySet<keyof CheckoutForm> = new Set(),
): CheckoutForm {
  const next = { ...form }
  if (!touched.has('name') && !next.name.trim() && fullName) next.name = fullName
  if (!touched.has('phone') && !next.phone) {
    const digits = localDigits(client.phone)
    if (isCompleteLocalPhone(digits)) next.phone = digits
  }
  if (!touched.has('address') && !touched.has('lat') && !next.address.trim() && next.lat === null) {
    const lat = toNumber(client.lat)
    const lng = toNumber(client.lng)
    if (client.address) next.address = client.address
    if (lat !== null && lng !== null) {
      next.lat = lat
      next.lng = lng
    }
  }
  return next
}

export function validate(form: CheckoutForm): CheckoutErrors {
  const errors: CheckoutErrors = {}
  if (!form.name.trim()) errors.name = 'required'
  if (!form.phone) errors.phone = 'required'
  else if (!isCompleteLocalPhone(form.phone)) errors.phone = 'invalidPhone'
  if (form.delivery_type === 'delivery' && !form.address.trim() && form.lat === null) errors.address = 'addressOrLocation'
  return errors
}

export function orderBody(form: CheckoutForm, lines: CartLine[], lang: Lang, platform: NewOrder['platform']): NewOrder {
  const delivery = form.delivery_type === 'delivery'
  return {
    items: lines.map((line) => ({ product_id: line.product.id, quantity: line.qty })),
    name: form.name.trim(),
    phone: toE164(form.phone),
    delivery_type: form.delivery_type,
    address: delivery ? form.address.trim() : '',
    lat: delivery ? form.lat : null,
    lng: delivery ? form.lng : null,
    payment_method: form.payment_method,
    comment: form.comment.trim(),
    platform,
    lang,
  }
}
