/* Telegram Mini App bridge (https://core.telegram.org/bots/webapps). The official script is loaded only
   when the page is opened inside Telegram, so regular browser sessions never download it. */

export interface TelegramWebApp {
  initData: string
  initDataUnsafe?: { user?: { language_code?: string; first_name?: string } }
  colorScheme?: 'light' | 'dark'
  ready: () => void
  expand: () => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
    TelegramWebviewProxy?: unknown
  }
}

const SCRIPT_SRC = 'https://telegram.org/js/telegram-web-app.js'

/** Telegram passes the launch parameters in the URL hash (or keeps them in sessionStorage after a reload). */
export function launchedFromTelegram(): boolean {
  if (window.Telegram?.WebApp?.initData) return true
  if (/tgWebApp(Data|Version|Platform)=/.test(window.location.hash)) return true
  if (typeof window.TelegramWebviewProxy !== 'undefined') return true
  try {
    return !!window.sessionStorage.getItem('__telegram__initParams')
  } catch {
    return false
  }
}

let loading: Promise<TelegramWebApp | null> | null = null

/** Resolves with the Mini App object, or `null` outside Telegram / when the script cannot be loaded. */
export function loadTelegramWebApp(timeoutMs = 8000): Promise<TelegramWebApp | null> {
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp)
  if (!launchedFromTelegram()) return Promise.resolve(null)
  loading ??= new Promise<TelegramWebApp | null>((resolve) => {
    const finish = () => resolve(window.Telegram?.WebApp ?? null)
    const timer = window.setTimeout(finish, timeoutMs)
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => {
      window.clearTimeout(timer)
      finish()
    }
    script.onerror = () => {
      window.clearTimeout(timer)
      resolve(null)
    }
    document.head.append(script)
  }).finally(() => {
    loading = null
  })
  return loading
}
