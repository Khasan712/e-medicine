/* A tiny rule-based order parser for the mock API (the real one is Gemini on the backend). Good enough to demo
   the voice / text command flow: products with quantities, phone, name, delivery, payment, "create". */
import type { CartItem, Product, VoiceResult, VoiceState } from '../api/types'

const NUMBER_WORDS: Record<string, number> = {
  bir: 1, bitta: 1, ikki: 2, ikkita: 2, uch: 3, uchta: 3, "to'rt": 4, "to'rtta": 4, tort: 4, besh: 5, beshta: 5,
  один: 1, одна: 1, одну: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5,
}

const ALIASES: Record<string, string[]> = {
  'coca-cola 0.5': ['kola', 'cola', 'кола', 'колу', 'coca'],
  'fanta 0.5': ['fanta', 'фанта', 'фанту'],
  'kartoshka fri': ['fri', 'фри', 'kartoshka'],
  'kofe latte': ['latte', 'латте', 'kofe', 'кофе'],
  pepperoni: ['pepperoni', 'пепперони'],
  chizburger: ['chizburger', 'чизбургер', 'чизбургера', 'чизбургеров'],
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,!?;:]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function quantityBefore(words: string[], index: number): number {
  for (let offset = 1; offset <= 2; offset++) {
    const word = words[index - offset]
    if (!word) break
    if (word === 'ta') continue
    if (/^\d+$/.test(word)) return Math.min(99, Number(word))
    if (word in NUMBER_WORDS) return NUMBER_WORDS[word]
  }
  return 1
}

export function localParse(text: string, state: VoiceState, products: Product[], lang: 'uz' | 'ru'): VoiceResult {
  const lower = text.toLowerCase()
  const words = tokens(text)
  const items = new Map<number, number>((state.items ?? []).map((item: CartItem) => [item.product_id, item.quantity]))
  const removing = /olib tashla|o'chir|убери|удали/.test(lower)

  for (const product of products) {
    const names = [product.name_uz, product.name_ru].map((name) => name.toLowerCase())
    const aliases = [...names, ...(ALIASES[product.name_uz.toLowerCase()] ?? [])]
    const index = words.findIndex((word) => aliases.some((alias) => alias === word || (alias.length > 4 && word.startsWith(alias.slice(0, -1)))))
    if (index < 0) continue
    if (removing) items.delete(product.id)
    else items.set(product.id, quantityBefore(words, index))
  }

  const phone = /(?:\+?998[\s-]?)?\(?(\d{2})\)?[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})/.exec(text)
  const name = /(?:mijoz|klient|ismi|клиент|имя)\s+([A-Za-zА-Яа-яЁёʻ'’-]{2,})/i.exec(text)
  const address = /((?:chilonzor|yunusobod|sergeli|olmazor|mirzo|чиланзар|юнусабад|сергели)[^,]*)/i.exec(text)
  const delivery = /yetkaz|dostav|достав|address|manzil|адрес/.test(lower) || !!address
  const pickup = /olib ket|самовывоз|o'zi olib/.test(lower)
  const card = /karta|карт|card|click|payme/.test(lower)
  const cash = /naqd|налич|cash/.test(lower)

  const result: VoiceResult = {
    ...state,
    items: [...items].map(([product_id, quantity]) => ({ product_id, quantity })),
    customer_name: name ? name[1].charAt(0).toUpperCase() + name[1].slice(1) : state.customer_name,
    phone: phone ? `+998${phone[1]}${phone[2]}${phone[3]}${phone[4]}` : state.phone,
    delivery_type: pickup ? 'pickup' : delivery ? 'delivery' : state.delivery_type,
    address: address ? address[1].trim() : state.address,
    payment_method: card ? 'card' : cash ? 'cash' : state.payment_method,
    unmatched: [],
    submit: /yarat|saqla|tasdiqla|создай|сохрани|оформи|подтверди/.test(lower),
    transcript: text,
    reply: '',
  }
  const count = result.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0
  result.reply =
    lang === 'ru'
      ? `Понял: ${count} шт.${result.customer_name ? `, клиент ${result.customer_name}` : ''}`
      : `Tushundim: ${count} ta mahsulot${result.customer_name ? `, mijoz ${result.customer_name}` : ''}`
  return result
}
