/**
 * The business `brand_color` drives the accent of the whole shop. From one hex colour we derive the CSS
 * variables the design uses: a gradient partner, a readable text colour on top of the brand fill and
 * versions of the brand that stay readable as text on light and dark surfaces.
 */

export const DEFAULT_BRAND = '#FF5A1F'

interface Rgb {
  r: number
  g: number
  b: number
}

export type BrandVariables = Record<
  '--brand' | '--brand-2' | '--brand-ink' | '--brand-text-light' | '--brand-text-dark',
  string
>

export function parseHex(color: string | null | undefined): Rgb | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color ?? '').trim())
  if (!match?.[1]) return null
  let hex = match[1]
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c)
  const n = parseInt(hex, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`
}

/** "rgb(12, 34, 56)" / "rgba(...)" / "#abc" → "#0c2238" (null when unknown). */
export function cssColorToHex(color: string): string | null {
  const rgb = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:\s*[,/]\s*([\d.]+%?))?/i.exec(color)
  if (rgb) {
    if (rgb[4] !== undefined && parseFloat(rgb[4]) === 0) return null // transparent
    return toHex({ r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) })
  }
  const parsed = parseHex(color)
  return parsed ? toHex(parsed) : null
}

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

function rgbToHsl({ r, g, b }: Rgb): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return [h * 60, s, l]
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x]
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 }
const LIGHT_SURFACE: Rgb = { r: 255, g: 255, b: 255 }
const DARK_SURFACE: Rgb = { r: 23, g: 24, b: 27 }

/** Moves the lightness of `color` until it reaches `target` contrast against `background`. */
function readableOn(color: Rgb, background: Rgb, target: number): Rgb {
  if (contrast(color, background) >= target) return color
  const [h, s, l] = rgbToHsl(color)
  const darker = luminance(background) > 0.5
  let lightness = l
  for (let i = 0; i < 40; i++) {
    lightness = darker ? lightness - 0.025 : lightness + 0.025
    if (lightness <= 0 || lightness >= 1) break
    const candidate = hslToRgb(h, s, lightness)
    if (contrast(candidate, background) >= target) return candidate
  }
  return darker ? { r: 22, g: 22, b: 26 } : WHITE
}

export function brandVariables(color: string | null | undefined): BrandVariables {
  const rgb = parseHex(color) ?? parseHex(DEFAULT_BRAND)!
  const [h, s, l] = rgbToHsl(rgb)
  const partner = hslToRgb(h - 28, Math.min(1, s * 1.05), Math.min(0.62, Math.max(0.42, l + 0.02)))
  // White text on the brand fill unless the brand is light (yellow, lime, …).
  const ink = contrast(rgb, WHITE) >= 2.4 ? '#ffffff' : '#16161a'
  return {
    '--brand': toHex(rgb),
    '--brand-2': toHex(partner),
    '--brand-ink': ink,
    '--brand-text-light': toHex(readableOn(rgb, LIGHT_SURFACE, 3)),
    '--brand-text-dark': toHex(readableOn(rgb, DARK_SURFACE, 3.2)),
  }
}

export function applyBrandVariables(variables: BrandVariables, root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(variables)) root.style.setProperty(name, value)
}
