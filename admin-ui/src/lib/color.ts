const DARK_TEXT = '#0f172a'
const DARK_TEXT_LUMINANCE = 0.0088

function luminance(hex: string): number | null {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!match) return null
  const [r, g, b] = match.slice(1).map((part) => {
    const channel = parseInt(part, 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** White or dark text — whichever has the higher WCAG contrast on the `#rrggbb` background. */
export function readableTextColor(background: string): '#ffffff' | typeof DARK_TEXT {
  const value = luminance(background)
  if (value === null) return '#ffffff'
  const withWhite = 1.05 / (value + 0.05)
  const withDark = (value + 0.05) / (DARK_TEXT_LUMINANCE + 0.05)
  return withWhite >= withDark ? '#ffffff' : DARK_TEXT
}
