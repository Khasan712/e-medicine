import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { authApi } from '../api/endpoints'
import { IconAlert, IconLock, IconPhoneDevice, IconRefresh, IconWifiOff } from '../components/icons'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { useI18n } from '../i18n/context'
import type { DictKey } from '../i18n/dict'
import { STORAGE_KEYS, storage } from '../lib/storage'
import { useTheme } from '../theme/theme'
import { BrandMark, CenteredScreen } from './SystemScreens'
import { rememberedBusiness, useSession } from './session'
import { loadTelegramWebApp } from './telegramWebApp'

type State = 'loading' | 'not_linked' | 'invalid' | 'outside' | 'error' | 'cookies'

const MESSAGES: Record<Exclude<State, 'loading'>, { title: DictKey; text: DictKey; icon: ReactNode }> = {
  not_linked: { title: 'tg_not_linked_title', text: 'tg_not_linked_text', icon: <IconLock size={26} /> },
  invalid: { title: 'tg_invalid_title', text: 'tg_invalid_text', icon: <IconAlert size={26} /> },
  outside: { title: 'tg_outside_title', text: 'tg_outside_text', icon: <IconPhoneDevice size={26} /> },
  error: { title: 'tg_error_title', text: 'tg_error_text', icon: <IconWifiOff size={26} /> },
  cookies: { title: 'tg_cookies_title', text: 'tg_cookies_text', icon: <IconAlert size={26} /> },
}

/** `/tg` — sign-in from the staff bot's Mini App: Telegram initData → session → Sales. */
export function TelegramSignInPage() {
  const { t, setLang } = useI18n()
  const { setTheme } = useTheme()
  const { refresh } = useSession()
  const navigate = useNavigate()
  const [state, setState] = useState<State>('loading')
  const mounted = useRef(true)
  const started = useRef(false)
  const business = rememberedBusiness()

  const signIn = useCallback(async () => {
    setState('loading')
    const app = await loadTelegramWebApp()
    if (!app?.initData) {
      if (mounted.current) setState('outside')
      return
    }
    app.ready()
    app.expand()
    // Inside Telegram follow its language and colours unless the user chose them in the panel.
    if (!storage.get(STORAGE_KEYS.lang)) {
      const code = app.initDataUnsafe?.user?.language_code
      setLang(code === 'ru' ? 'ru' : 'uz')
    }
    if (!storage.get(STORAGE_KEYS.theme) && app.colorScheme) setTheme(app.colorScheme)

    try {
      await authApi.telegram(app.initData)
      const session = await refresh()
      if (!mounted.current) return
      // Signed in, but the session cookie was not kept (third-party cookies blocked in an embedded client).
      if (!session) setState('cookies')
      else navigate('/sales', { replace: true })
    } catch (error) {
      if (!mounted.current) return
      if (error instanceof ApiError && error.code === 'not_linked') setState('not_linked')
      else if (error instanceof ApiError && error.code === 'invalid_init_data') setState('invalid')
      else setState('error')
    }
  }, [navigate, refresh, setLang, setTheme])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    // Sign in once (StrictMode runs effects twice in development).
    if (started.current) return
    started.current = true
    void signIn()
  }, [signIn])

  const message = state === 'loading' ? null : MESSAGES[state]

  return (
    <CenteredScreen>
      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center shadow-2xl backdrop-blur-xl">
        {message ? (
          <>
            <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              {message.icon}
            </div>
            <h1 className="text-xl font-semibold">{t(message.title)}</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{t(message.text)}</p>
            <div className="mt-6 flex flex-col items-center gap-3">
              {(state === 'error' || state === 'invalid' || state === 'cookies') && (
                <Button variant="secondary" icon={<IconRefresh size={16} />} onClick={() => void signIn()}>
                  {t('retry')}
                </Button>
              )}
              <Link to="/login" className="text-[13px] font-medium text-slate-300 underline-offset-4 hover:text-white hover:underline">
                {t('tg_use_password')}
              </Link>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center" aria-busy="true">
            <BrandMark className="mb-6" />
            {business && <p className="mb-2 text-lg font-semibold">{business.name}</p>}
            <div className="flex items-center gap-2.5 text-sm text-slate-300">
              <Spinner size={18} className="text-primary-400" />
              {t('tg_signin_loading')}
            </div>
          </div>
        )}
      </div>
    </CenteredScreen>
  )
}
