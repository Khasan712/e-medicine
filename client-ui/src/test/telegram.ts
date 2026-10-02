import { vi } from 'vitest'
import {
  initTelegram,
  type TelegramBackButton,
  type TelegramBottomButton,
  type TelegramBottomButtonParams,
  type TelegramWebApp,
} from '../lib/telegram'

export interface TelegramMock {
  webApp: TelegramWebApp
  mainButton: { readonly text: string; readonly visible: boolean; readonly active: boolean; click: () => void }
  backButton: { readonly visible: boolean; click: () => void }
  haptics: { impact: ReturnType<typeof vi.fn>; notification: ReturnType<typeof vi.fn>; selection: ReturnType<typeof vi.fn> }
}

const compareVersions = (a: string, b: string) => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff) return diff
  }
  return 0
}

/** Installs a fake `window.Telegram.WebApp` (like inside the Telegram app) and initialises the app's bridge. */
export function installTelegram(options: { initData?: string; languageCode?: string } = {}): TelegramMock {
  const mainClicks = new Set<() => void>()
  const backClicks = new Set<() => void>()
  const main = { text: '', visible: false, active: true, progress: false }
  const back = { visible: false }

  const mainButton = {
    get isVisible() {
      return main.visible
    },
    get isActive() {
      return main.active
    },
    get isProgressVisible() {
      return main.progress
    },
    setParams(params: TelegramBottomButtonParams) {
      if (params.text !== undefined) main.text = params.text
      if (params.is_visible !== undefined) main.visible = params.is_visible
      if (params.is_active !== undefined) main.active = params.is_active
      return mainButton
    },
    onClick(callback: () => void) {
      mainClicks.add(callback)
      return mainButton
    },
    offClick(callback: () => void) {
      mainClicks.delete(callback)
      return mainButton
    },
    show() {
      main.visible = true
      return mainButton
    },
    hide() {
      main.visible = false
      return mainButton
    },
    showProgress() {
      main.progress = true
      return mainButton
    },
    hideProgress() {
      main.progress = false
      return mainButton
    },
  } as TelegramBottomButton

  const backButton = {
    get isVisible() {
      return back.visible
    },
    onClick(callback: () => void) {
      backClicks.add(callback)
      return backButton
    },
    offClick(callback: () => void) {
      backClicks.delete(callback)
      return backButton
    },
    show() {
      back.visible = true
      return backButton
    },
    hide() {
      back.visible = false
      return backButton
    },
  } as TelegramBackButton

  const haptics = { impact: vi.fn(), notification: vi.fn(), selection: vi.fn() }

  const webApp: TelegramWebApp = {
    initData: options.initData ?? 'query_id=AAE&user=%7B%22id%22%3A42%7D&auth_date=1&hash=abc',
    initDataUnsafe: { user: { id: 42, first_name: 'Aziz', language_code: options.languageCode ?? 'uz' } },
    version: '8.0',
    platform: 'ios',
    colorScheme: 'light',
    themeParams: { bg_color: '#ffffff', text_color: '#000000' },
    MainButton: mainButton,
    BackButton: backButton,
    HapticFeedback: {
      impactOccurred: haptics.impact,
      notificationOccurred: haptics.notification,
      selectionChanged: haptics.selection,
    },
    ready: vi.fn(),
    expand: vi.fn(),
    isVersionAtLeast: (version: string) => compareVersions('8.0', version) >= 0,
    setHeaderColor: vi.fn(),
    setBackgroundColor: vi.fn(),
    setBottomBarColor: vi.fn(),
    disableVerticalSwipes: vi.fn(),
    onEvent: vi.fn(),
    offEvent: vi.fn(),
    openLink: vi.fn(),
    openTelegramLink: vi.fn(),
    requestContact: vi.fn(),
  }

  window.Telegram = { WebApp: webApp }
  initTelegram()

  return {
    webApp,
    mainButton: {
      get text() {
        return main.text
      },
      get visible() {
        return main.visible
      },
      get active() {
        return main.active
      },
      click: () => mainClicks.forEach((callback) => callback()),
    },
    backButton: {
      get visible() {
        return back.visible
      },
      click: () => backClicks.forEach((callback) => callback()),
    },
    haptics,
  }
}
