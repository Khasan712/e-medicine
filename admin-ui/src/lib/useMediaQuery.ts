import { useCallback, useSyncExternalStore } from 'react'

function getMatcher(query: string): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null
}

/** `true` while the media query matches (re-renders on change). */
export function useMediaQuery(query: string, fallback = true): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const matcher = getMatcher(query)
      matcher?.addEventListener?.('change', onChange)
      return () => matcher?.removeEventListener?.('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => getMatcher(query)?.matches ?? fallback,
    () => fallback,
  )
}

export const DESKTOP_QUERY = '(min-width: 768px)'
export const SIDEBAR_QUERY = '(min-width: 1024px)'
