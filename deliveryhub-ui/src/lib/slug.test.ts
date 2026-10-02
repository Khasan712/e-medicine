import { describe, expect, it } from 'vitest'
import { isSlugShapeValid, normalizeSlugInput, slugify, transliterate } from './slug'

describe('transliterate (Uzbek Cyrillic → Latin)', () => {
  it.each([
    ['Бургер Хаус', 'burger xaus'],
    ['Ёқимли таом', 'yoqimli taom'],
    ['Ғайрат Ўғли', "gayrat ogli"],
    ['Ҳовли', 'hovli'],
    ['Чойхона Шарқ', 'choyxona sharq'],
    ['Юлдуз', 'yulduz'],
    ['Яшил', 'yashil'],
    ['Ер', 'yer'], // е at the start of a word
    ['Поезд', 'poyezd'], // е after a vowel
    ['Объект', 'obyekt'], // е after ъ
    ['Лицей', 'litsey'], // ц after a vowel
    ['Цирк', 'sirk'], // ц at the start of a word
    ['Кафе', 'kafe'],
  ])('%s → %s', (input, output) => {
    expect(transliterate(input)).toBe(output)
  })
})

describe('slugify', () => {
  it.each([
    ['Burger House', 'burger-house'],
    ['Бургер Хаус', 'burger-xaus'],
    ['Ёқимли Таом №1', 'yoqimli-taom-1'],
    ["Oʻzbekiston Gʻalla", 'ozbekiston-galla'],
    ["O'zbek Milliy Taomlari", 'ozbek-milliy-taomlari'],
    ['Café Del Mar!!', 'cafe-del-mar'],
    ['  --Hello__World--  ', 'hello-world'],
    ['Ресторан "Шарқ"', 'restoran-sharq'],
    ['', ''],
  ])('%j → %j', (input, output) => {
    expect(slugify(input)).toBe(output)
  })

  it('keeps at most 30 characters and never ends with a hyphen', () => {
    const slug = slugify(`${'a'.repeat(29)} bcd`)
    expect(slug).toBe('a'.repeat(29))
    expect(slugify('Juda uzun nomli restoran va kafe tarmogi')).toBe('juda-uzun-nomli-restoran-va-ka')
  })
})

describe('normalizeSlugInput', () => {
  it('cleans what is typed but keeps a trailing hyphen while typing', () => {
    expect(normalizeSlugInput('Burger House')).toBe('burger-house')
    expect(normalizeSlugInput('burger-')).toBe('burger-')
    expect(normalizeSlugInput('--burger--house')).toBe('burger-house')
    expect(normalizeSlugInput('Бургер')).toBe('burger')
    expect(normalizeSlugInput('a'.repeat(40))).toHaveLength(30)
  })
})

describe('isSlugShapeValid', () => {
  it('accepts 3–30 characters of a-z, 0-9 and -', () => {
    expect(isSlugShapeValid('abc')).toBe(true)
    expect(isSlugShapeValid('burger-house-2')).toBe(true)
    expect(isSlugShapeValid('ab')).toBe(false)
    expect(isSlugShapeValid('a'.repeat(31))).toBe(false)
    expect(isSlugShapeValid('Burger')).toBe(false)
    expect(isSlugShapeValid('burger_house')).toBe(false)
  })
})
