import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router'

/**
 * New screens start at the top, "back" returns to where the customer was. Opening or closing a sheet
 * (same pathname, different history entry) never moves the page.
 */
export function useScrollRestoration(): void {
  const location = useLocation()
  const navigationType = useNavigationType()
  const positions = useRef(new Map<string, number>())
  const lastPathname = useRef(location.pathname)

  useEffect(() => {
    const key = location.key
    let frame = 0
    const save = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => positions.current.set(key, window.scrollY))
    }
    window.addEventListener('scroll', save, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', save)
    }
  }, [location.key])

  useLayoutEffect(() => {
    const samePage = lastPathname.current === location.pathname
    lastPathname.current = location.pathname
    if (samePage) return
    const saved = navigationType === 'POP' ? positions.current.get(location.key) : undefined
    window.scrollTo(0, saved ?? 0)
  }, [location.key, location.pathname, navigationType])
}
