// Business address (subdomain) from its name: Uzbek Cyrillic → Latin, then `a-z`, `0-9`, `-` only.

export const SLUG_MIN = 3
export const SLUG_MAX = 30
const SLUG_SHAPE = new RegExp(`^[a-z0-9-]{${SLUG_MIN},${SLUG_MAX}}$`)

const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', ғ: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k',
  қ: 'q', л: 'l', м: 'm', н: 'n', о: 'o', ў: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x',
  ҳ: 'h', ц: 's', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
}
const VOWELS = new Set(['а', 'е', 'ё', 'и', 'о', 'у', 'ў', 'э', 'ю', 'я', 'ы'])
const LETTER = /\p{L}/u

/**
 * Uzbek Cyrillic → Latin (lower case). Follows the official rules where a letter depends on its place:
 * `е` is `ye` at the start of a word and after a vowel or `ъ`/`ь` (Ер → yer), `ц` is `ts` after a vowel
 * (лицей → litsey) and `s` elsewhere.
 */
export function transliterate(text: string): string {
  const chars = Array.from(text.normalize('NFC').toLowerCase())
  let result = ''
  chars.forEach((char, index) => {
    const prev = chars[index - 1] ?? ''
    const wordStart = prev === '' || !LETTER.test(prev)
    if (char === 'е') {
      result += wordStart || VOWELS.has(prev) || prev === 'ъ' || prev === 'ь' ? 'ye' : 'e'
    } else if (char === 'ц') {
      result += !wordStart && VOWELS.has(prev) ? 'ts' : 's'
    } else {
      result += CYRILLIC[char] ?? char
    }
  })
  return result
}

/** Latin letters without accents and apostrophes (oʻ → o, café → cafe), anything else becomes `-`. */
function toSlugChars(text: string): string {
  return transliterate(text)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[ʻʼʹ'’‘`´]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
}

/** A ready slug for a business name: `Бургер Хаус` → `burger-xaus`, at most 30 characters. */
export function slugify(name: string): string {
  return toSlugChars(name).replace(/^-+|-+$/g, '').slice(0, SLUG_MAX).replace(/-+$/, '')
}

/** Cleans what is typed into the address field while keeping a trailing `-` the user is typing. */
export function normalizeSlugInput(value: string): string {
  return toSlugChars(value).replace(/-{2,}/g, '-').replace(/^-+/, '').slice(0, SLUG_MAX)
}

/** Length and characters only; the server has the final word (reserved and taken addresses). */
export function isSlugShapeValid(slug: string): boolean {
  return SLUG_SHAPE.test(slug)
}
