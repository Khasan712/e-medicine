import type { BusinessCard } from '../api/types'

/**
 * The platform domain for address previews (`<slug>.<domain>`): the one GET /businesses reports, else
 * VITE_PLATFORM_DOMAIN when set at build time, else the domain of an existing business's shop link
 * (`https://burger.portex.uz/` → `portex.uz`; locally `http://burger.localhost:5175/` → `localhost:5175`), else our
 * own host without its first label (`deliveryhub.portex.uz` → `portex.uz`, `hub.localhost:5175` → `localhost:5175`).
 */
export function platformDomain(businesses: BusinessCard[] | undefined, reported?: string): string {
  if (reported?.trim()) return reported.trim()
  const configured = import.meta.env.VITE_PLATFORM_DOMAIN?.trim()
  if (configured) return configured

  for (const business of businesses ?? []) {
    try {
      const host = new URL(business.links.shop).host
      const prefix = `${business.slug}.`
      if (host.startsWith(prefix) && host.length > prefix.length) return host.slice(prefix.length)
    } catch {
      // Not a URL — try the next business.
    }
  }

  const host = window.location.host
  const dot = host.indexOf('.')
  return dot > 0 ? host.slice(dot + 1) : host
}
