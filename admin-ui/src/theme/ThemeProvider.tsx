import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { STORAGE_KEYS, storage } from '../lib/storage'
import { ThemeContext, applyTheme, storedTheme, systemTheme, type Theme, type ThemeValue } from './theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => storedTheme() ?? systemTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Follow the system theme until the user picks one explicitly.
  useEffect(() => {
    if (storedTheme() || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => {
      if (!storedTheme()) setThemeState(event.matches ? 'dark' : 'light')
    }
    query.addEventListener?.('change', onChange)
    return () => query.removeEventListener?.('change', onChange)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    storage.set(STORAGE_KEYS.theme, next)
    setThemeState(next)
  }, [])

  const value = useMemo<ThemeValue>(
    () => ({ theme, setTheme, toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark') }),
    [theme, setTheme],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}
