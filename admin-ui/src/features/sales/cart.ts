import type { CartItem, DeliveryType, SaleForm, SaleStatus, SalesProduct } from '../../api/types'

export const MAX_QTY = 99

export const DEFAULT_SALE_FORM: SaleForm = {
  customer_name: '',
  phone: '',
  address: '',
  delivery_type: 'pickup',
  payment_method: 'cash',
  status: 'completed',
  comment: '',
}

/** Default status of a sale: handed over at once for pickup, accepted for delivery (same rule as the API). */
export function statusFor(delivery: DeliveryType): SaleStatus {
  return delivery === 'delivery' ? 'ordered' : 'completed'
}

export function qtyOf(items: CartItem[], productId: number): number {
  return items.find((item) => item.product_id === productId)?.quantity ?? 0
}

/** Sets the quantity (0 or less removes the line, at most 99). */
export function setQty(items: CartItem[], productId: number, quantity: number): CartItem[] {
  const next = Math.min(Math.trunc(quantity), MAX_QTY)
  if (!(next > 0)) return items.filter((item) => item.product_id !== productId)
  if (items.some((item) => item.product_id === productId)) {
    return items.map((item) => (item.product_id === productId ? { ...item, quantity: next } : item))
  }
  return [...items, { product_id: productId, quantity: next }]
}

export function addOne(items: CartItem[], productId: number): CartItem[] {
  return setQty(items, productId, qtyOf(items, productId) + 1)
}

export interface CartLine extends CartItem {
  product: SalesProduct
}

/** Cart lines with their products (lines of products missing from the catalog are dropped). */
export function cartLines(items: CartItem[], byId: ReadonlyMap<number, SalesProduct>): CartLine[] {
  return items.flatMap((item) => {
    const product = byId.get(item.product_id)
    return product ? [{ ...item, product }] : []
  })
}

export function itemsCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0)
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.product.price, 0)
}

/** Product tiles of the picker: category filter + search in both languages. */
export function filterProducts(products: SalesProduct[], search: string, category: number | null): SalesProduct[] {
  const query = search.trim().toLowerCase()
  return products.filter(
    (product) =>
      (category === null || product.category_id === category) &&
      (!query || `${product.name_uz} ${product.name_ru}`.toLowerCase().includes(query)),
  )
}
