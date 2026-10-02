/** Page buttons to show: `1 … 4 5 6 … 12`. */
export function pageList(page: number, pages: number): Array<number | 'gap'> {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1)
  const items: Array<number | 'gap'> = [1]
  const start = Math.max(2, Math.min(page - 1, pages - 4))
  const end = Math.min(pages - 1, Math.max(page + 1, 5))
  if (start > 2) items.push('gap')
  for (let value = start; value <= end; value++) items.push(value)
  if (end < pages - 1) items.push('gap')
  items.push(pages)
  return items
}
