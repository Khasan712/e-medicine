const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * An SVG document from the API (the bot setup QR code) as a data: URL for an <img>. Shown as an image it can
 * never run scripts. SVG made for inline HTML usually has no xmlns, which an image needs, so it is added.
 * Returns null for anything that is not SVG markup.
 */
export function svgDataUrl(svg: string): string | null {
  const start = svg.search(/<svg[\s>]/i)
  if (start < 0) return null
  let markup = svg.slice(start).trim()
  const openTagEnd = markup.indexOf('>')
  if (openTagEnd < 0) return null
  if (!/\sxmlns\s*=/.test(markup.slice(0, openTagEnd))) {
    markup = `<svg xmlns="${SVG_NS}"${markup.slice(4)}`
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
}
