import { useEffect, useState } from 'react'

export const prefersReducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

/**
 * Keeps an element mounted while its exit animation plays: `mounted` stays true for `ms` after `open`
 * turns false, `closing` is true during that time.
 */
export function usePresence(open: boolean, ms: number): { mounted: boolean; closing: boolean } {
  const [rendered, setRendered] = useState(open)
  if (open && !rendered) setRendered(true)

  useEffect(() => {
    if (open || !rendered) return
    const delay = prefersReducedMotion() ? 0 : ms
    const timer = setTimeout(() => setRendered(false), delay)
    return () => clearTimeout(timer)
  }, [open, rendered, ms])

  return { mounted: open || rendered, closing: !open && rendered }
}

let scrollLocks = 0

/** Locks page scrolling while any sheet is open (ref-counted). */
export function lockScroll(): () => void {
  scrollLocks += 1
  if (scrollLocks === 1) document.documentElement.style.overflow = 'hidden'
  return () => {
    scrollLocks = Math.max(0, scrollLocks - 1)
    if (scrollLocks === 0) document.documentElement.style.overflow = ''
  }
}
