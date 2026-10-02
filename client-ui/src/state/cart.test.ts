import { describe, expect, it } from 'vitest'
import { products } from '../test/fixtures'
import { cartTotals, MAX_QTY, minOrderLeft, pruneItems, resolveLines, sanitizeItems, setItemQty } from './cart'

const byId = new Map(products.map((product) => [product.id, product]))

describe('cart math', () => {
  it('adds, updates and removes quantities keeping the order products were added in', () => {
    let items = setItemQty([], 3, 1)
    items = setItemQty(items, 1, 2)
    items = setItemQty(items, 3, 4)
    expect(items).toEqual([
      { id: 3, qty: 4 },
      { id: 1, qty: 2 },
    ])
    expect(setItemQty(items, 3, 0)).toEqual([{ id: 1, qty: 2 }])
    expect(setItemQty(items, 1, -5)).toEqual([{ id: 3, qty: 4 }])
    expect(setItemQty(items, 1, 500)).toContainEqual({ id: 1, qty: MAX_QTY })
  })

  it('computes lines, the item count and the total from catalog prices', () => {
    const lines = resolveLines(
      [
        { id: 1, qty: 2 },
        { id: 3, qty: 3 },
        { id: 999, qty: 1 }, // not in the menu
      ],
      byId,
    )
    expect(lines.map((line) => [line.product.id, line.qty, line.total])).toEqual([
      [1, 2, 70000],
      [3, 3, 27000],
    ])
    expect(cartTotals(lines)).toEqual({ count: 5, total: 97000 })
    expect(cartTotals([])).toEqual({ count: 0, total: 0 })
  })

  it('tells how much is missing to the minimum order', () => {
    expect(minOrderLeft(35000, 50000)).toBe(15000)
    expect(minOrderLeft(50000, 50000)).toBe(0)
    expect(minOrderLeft(1000, 0)).toBe(0)
  })

  it('drops products that left the menu and reports them', () => {
    const { items, removed } = pruneItems(
      [
        { id: 1, qty: 1 },
        { id: 42, qty: 2 },
      ],
      byId,
    )
    expect(items).toEqual([{ id: 1, qty: 1 }])
    expect(removed).toEqual([42])
  })

  it('accepts only sane data from storage', () => {
    expect(sanitizeItems('nope')).toEqual([])
    expect(
      sanitizeItems([
        { id: 1, qty: 2 },
        { id: 1, qty: 3 }, // duplicate
        { id: 'x', qty: 1 },
        { id: 2, qty: 0 },
        { id: 3, qty: 250 },
        null,
      ]),
    ).toEqual([
      { id: 1, qty: 2 },
      { id: 3, qty: MAX_QTY },
    ])
  })
})
