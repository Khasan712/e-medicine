import { useCallback, useLayoutEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { cssColorToHex } from '../lib/color'
import { readStorage, writeStorage } from '../lib/storage'
import { isTelegram, setTelegramChromeColor, subscribeTelegramTheme, telegramColorScheme } from '../lib/telegram'
import { THEME_CYCLE, ThemeContext, type ResolvedTheme, type ThemePreference } from './theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function subscribeSystemTheme(callback: () => void): () => void {
  const media = window.matchMedia?.(DARK_QUERY)
  media?.addEventListener?.('change', callback)
  return () => media?.removeEventListener?.('change', callback)
}

const systemPrefersDark = () => Boolean(window.matchMedia?.(DARK_QUERY).matches)

function readPreference(): ThemePreference {
  const saved = readStorage<unknown>('theme', 'auto')
  return saved === 'light' || saved === 'dark' ? saved : 'auto'
}

/** Light/dark theme: the system setting (or Telegram's) by default, a manual choice on the website. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const inTelegram = isTelegram()
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference)
  const systemDark = useSyncExternalStore(subscribeSystemTheme, systemPrefersDark, () => false)
  const telegramScheme = useSyncExternalStore(subscribeTelegramTheme, telegramColorScheme, () => null)

  let resolved: ResolvedTheme
  if (inTelegram && telegramScheme) resolved = telegramScheme
  else if (preference === 'auto') resolved = systemDark ? 'dark' : 'light'
  else resolved = preference

  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.theme = resolved
    // The browser / Telegram chrome takes the colour of the page background.
    const background =
      cssColorToHex(getComputedStyle(root).getPropertyValue('--bg').trim()) ??
      cssColorToHex(getComputedStyle(document.body).backgroundColor) ??
      (resolved === 'dark' ? '#0e0f11' : '#f6f5f2')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background)
    setTelegramChromeColor(background)
  }, [resolved, telegramScheme])

  const setPreference = useCallback((next: ThemePreference) => {
    writeStorage('theme', next)
    setPreferenceState(next)
  }, [])

  const cycle = useCallback(() => setPreference(THEME_CYCLE[preference]), [preference, setPreference])

  const value = useMemo(
    () => ({ preference, resolved, canChange: !inTelegram, setPreference, cycle }),
    [preference, resolved, inTelegram, setPreference, cycle],
  )
  return <ThemeContext value={value}>{children}</ThemeContext>
}
