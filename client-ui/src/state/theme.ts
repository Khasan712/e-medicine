import { createContext, useContext } from 'react'

export type ThemePreference = 'auto' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export interface ThemeContextValue {
  preference: ThemePreference
  resolved: ResolvedTheme
  /** Inside Telegram the theme always follows Telegram, so there is no toggle. */
  canChange: boolean
  setPreference: (preference: ThemePreference) => void
  cycle: () => void
}

export const THEME_CYCLE: Record<ThemePreference, ThemePreference> = { auto: 'light', light: 'dark', dark: 'auto' }

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme() must be used inside <ThemeProvider>')
  return context
}
