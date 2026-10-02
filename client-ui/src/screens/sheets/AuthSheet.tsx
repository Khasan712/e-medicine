import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { isApiError } from '../../api/client'
import { checkTelegramLogin, requestPhoneCode, startTelegramLogin, updateMe, verifyPhoneCode } from '../../api/shop'
import type { AuthResult, Client } from '../../api/types'
import { Button, IconButton } from '../../components/Button'
import { TextInput } from '../../components/Field'
import { Icon, type IconName } from '../../components/Icon'
import { PhoneInput } from '../../components/PhoneInput'
import { Sheet, SheetBody, SheetGrabber, SheetHeader } from '../../components/Sheet'
import { useSheet } from '../../components/sheet-context'
import { useI18n } from '../../i18n/i18n'
import { cn } from '../../lib/cn'
import { errorMessageKey } from '../../lib/errors'
import { useFocusOnMount } from '../../lib/focus'
import { displayPhone, isCompleteLocalPhone, toE164 } from '../../lib/format'
import { haptic, isTelegram } from '../../lib/telegram'
import { HIDE_MAIN_BUTTON, MAIN_BUTTON_SHEET, useMainButton } from '../../lib/useTelegram'
import { useAuth } from '../../state/auth'
import { useCatalog } from '../../state/catalog'
import { useNav } from '../../state/nav'
import { useToast } from '../../state/toast'

/** How often the website asks whether the customer pressed "Start" in the bot. */
export const TELEGRAM_POLL_MS = 2000

type Step = 'choose' | 'phone' | 'code' | 'telegram' | 'name'

export function AuthSheet() {
  const { sheet, closeSheet, go } = useNav()
  const open = sheet?.type === 'auth'
  const requestedNext = sheet?.type === 'auth' ? sheet.next : undefined
  const [next, setNext] = useState(requestedNext)
  if (open && requestedNext !== next) setNext(requestedNext)

  return (
    <Sheet open={open} onClose={closeSheet}>
      <AuthFlow
        open={open}
        onClose={closeSheet}
        onDone={() => (next ? go(next, { replace: true }) : closeSheet())}
      />
    </Sheet>
  )
}

function AuthHero({ icon, telegram = false }: { icon: IconName; telegram?: boolean }) {
  return (
    <div className={cn('mx-auto mt-1.5 mb-4 w-fit rounded-[26px]', telegram && 'pulse-ring text-tg')}>
      <div
        className={cn(
          'grid size-[76px] place-items-center rounded-[26px]',
          telegram
            ? 'bg-[linear-gradient(135deg,#37bbfe,#2aabee_60%,#1e96d1)] text-white shadow-[0_14px_30px_rgb(42_171_238/0.35)]'
            : 'brand-gradient text-brand-ink shadow-[0_14px_30px_color-mix(in_srgb,var(--brand)_35%,transparent)]',
        )}
      >
        <Icon name={icon} className="size-[34px]" />
      </div>
    </div>
  )
}

/** The heading of the current step — it also names the dialog. */
function Title({ children }: { children: string }) {
  const { titleId } = useSheet()
  return (
    <h2 id={titleId} className="text-center text-[23px] font-extrabold tracking-[-0.025em]">
      {children}
    </h2>
  )
}

function Lead({ children }: { children: ReactNode }) {
  return <p className="mx-auto mt-2 mb-[22px] max-w-[340px] text-center text-[14.5px] font-medium text-muted">{children}</p>
}

function FormError({ message }: { message: string }) {
  if (!message) return null
  return (
    <div role="alert" className="mt-3 rounded-xl bg-red-soft px-3 py-2.5 text-center text-[13.5px] font-bold text-red">
      {message}
    </div>
  )
}

interface AuthFlowProps {
  open: boolean
  onClose: () => void
  onDone: () => void
}

function AuthFlow({ open, onClose, onDone }: AuthFlowProps) {
  const { t, lang } = useI18n()
  const { signIn, setClient } = useAuth()
  const { botUsername } = useCatalog()
  const toast = useToast()
  const telegramOption = Boolean(botUsername) && !isTelegram()

  const [step, setStep] = useState<Step>(telegramOption ? 'choose' : 'phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [debugCode, setDebugCode] = useState('')
  const [resendAt, setResendAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [otpFocused, setOtpFocused] = useState(false)
  const [telegramLogin, setTelegramLogin] = useState<{ token: string; url: string; expiresAt: number } | null>(null)
  const [telegramExpired, setTelegramExpired] = useState(false)
  const [session, setSession] = useState<AuthResult | null>(null)
  const otpInput = useRef<HTMLInputElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  useFocusOnMount(otpInput, step === 'code')
  useFocusOnMount(nameInput, step === 'name')

  // Inside Telegram the page's own buttons are used here; keep the MainButton out of the way.
  useMainButton(open ? HIDE_MAIN_BUTTON : null, MAIN_BUTTON_SHEET)

  const goTo = (target: Step) => {
    setStep(target)
    setError('')
  }

  const finish = (client: Client) => {
    toast(client.first_name ? t('welcomeName', { name: client.first_name }) : t('welcome'), { type: 'success' })
    onDone()
  }

  const onAuthenticated = (result: AuthResult) => {
    signIn(result)
    setSession(result)
    haptic('success')
    if (!result.client.first_name?.trim()) goTo('name')
    else finish(result.client)
  }
  const onAuthenticatedRef = useRef(onAuthenticated)
  useLayoutEffect(() => {
    onAuthenticatedRef.current = onAuthenticated
  })

  // --- phone + SMS code ------------------------------------------------------------------------
  const enterCodeStep = (resendIn: number) => {
    goTo('code')
    setCode('')
    setResendAt(Date.now() + resendIn * 1000)
    setNow(Date.now())
  }

  const requestCode = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!isCompleteLocalPhone(phone)) {
      setError(t('invalidPhone'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await requestPhoneCode(toE164(phone))
      setDebugCode(result.debug_code ?? '')
      enterCodeStep(result.resend_in || 60)
    } catch (caught) {
      if (isApiError(caught) && caught.code === 'too_soon') enterCodeStep(Number(caught.data.retry_after) || 60)
      else setError(t(errorMessageKey(caught)))
    } finally {
      setLoading(false)
    }
  }

  const verify = async (value: string) => {
    if (value.length !== 6 || loading) return
    setLoading(true)
    setError('')
    try {
      onAuthenticated(await verifyPhoneCode(toE164(phone), value, lang))
    } catch (caught) {
      const attemptsLeft = isApiError(caught) ? caught.data.attempts_left : undefined
      if (isApiError(caught) && caught.code === 'invalid_code' && typeof attemptsLeft === 'number') {
        setError(attemptsLeft > 0 ? t('attemptsLeft', { count: attemptsLeft }) : t('errTooManyAttempts'))
      } else {
        setError(t(errorMessageKey(caught)))
      }
      setCode('')
      haptic('error')
      requestAnimationFrame(() => otpInput.current?.focus())
    } finally {
      setLoading(false)
    }
  }

  // Resend countdown.
  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000))
  useEffect(() => {
    if (step !== 'code' || secondsLeft <= 0) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [step, secondsLeft])

  // --- "Telegram orqali kirish": deep link + polling ------------------------------------------
  const startTelegram = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await startTelegramLogin()
      setTelegramLogin({ token: result.token, url: result.url, expiresAt: Date.now() + result.expires_in * 1000 })
      setTelegramExpired(false)
      goTo('telegram')
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } catch (caught) {
      setError(t(errorMessageKey(caught)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (step !== 'telegram' || !telegramLogin || telegramExpired) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let running = false
    let stopped = false

    const check = async () => {
      if (stopped || running) return
      if (Date.now() > telegramLogin.expiresAt) {
        setTelegramExpired(true)
        return
      }
      running = true
      clearTimeout(timer)
      try {
        const result = await checkTelegramLogin(telegramLogin.token, controller.signal)
        if (stopped) return
        if (result.status === 'confirmed') {
          stopped = true
          onAuthenticatedRef.current(result)
          return
        }
        if (result.status === 'expired') {
          setTelegramExpired(true)
          return
        }
      } catch (caught) {
        if (stopped) return
        if (isApiError(caught) && caught.status === 404) {
          setTelegramExpired(true)
          return
        }
      } finally {
        running = false
      }
      timer = setTimeout(check, TELEGRAM_POLL_MS)
    }

    // Coming back from the Telegram app: check right away.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    timer = setTimeout(check, TELEGRAM_POLL_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      stopped = true
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [step, telegramLogin, telegramExpired])

  // --- name for a new account -----------------------------------------------------------------
  const saveName = async (event: FormEvent) => {
    event.preventDefault()
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (!parts.length || !session) {
      setError(t('required'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const { client } = await updateMe(session.token, { first_name: parts[0], last_name: parts.slice(1).join(' '), lang })
      setClient(client)
      finish(client)
    } catch (caught) {
      setError(t(errorMessageKey(caught)))
    } finally {
      setLoading(false)
    }
  }

  const backTarget: Step | null =
    step === 'code' ? 'phone' : (step === 'phone' || step === 'telegram') && telegramOption ? 'choose' : null

  return (
    <>
      <SheetGrabber />
      <SheetHeader
        className="pb-0"
        leading={
          backTarget ? (
            <IconButton icon="chevron-left" label={t('back')} variant="soft" size="sm" onClick={() => goTo(backTarget)} />
          ) : null
        }
        hideClose={false}
      />
      <SheetBody className="pb-7">
        <div key={step} className="animate-rise-in">
          {step === 'choose' && (
            <div>
              <AuthHero icon="user" />
              <Title>{t('loginTitle')}</Title>
              <Lead>{t('loginText')}</Lead>
              <Button variant="telegram" block icon="telegram" loading={loading} onClick={startTelegram}>
                {t('viaTelegram')}
              </Button>
              <div className="my-3.5 flex items-center gap-3 text-[12.5px] font-bold text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
                {t('or')}
              </div>
              <Button variant="soft" block icon="smartphone" onClick={() => goTo('phone')}>
                {t('viaPhone')}
              </Button>
            </div>
          )}

          {step === 'phone' && (
            <form onSubmit={requestCode} noValidate>
              <AuthHero icon="smartphone" />
              <Title>{t('phoneTitle')}</Title>
              <Lead>{t('phoneText')}</Lead>
              <PhoneInput
                value={phone}
                onChange={(digits) => {
                  setPhone(digits)
                  setError('')
                }}
                size="lg"
                focusOnMount
                label={t('phone')}
                invalid={Boolean(error)}
              />
              <Button type="submit" block className="mt-3.5" loading={loading} disabled={!isCompleteLocalPhone(phone)}>
                {t('getCode')}
              </Button>
            </form>
          )}

          {step === 'code' && (
            <div>
              <AuthHero icon="message" />
              <Title>{t('codeTitle')}</Title>
              <Lead>
                {t('codeSentTo')} <b className="whitespace-nowrap text-ink">{displayPhone(toE164(phone))}</b>
                <br />
                <button type="button" className="mt-1 font-bold text-brand-text hover:underline" onClick={() => goTo('phone')}>
                  {t('changeNumber')}
                </button>
              </Lead>
              <div className="relative grid grid-cols-6 gap-2">
                {Array.from({ length: 6 }, (_, index) => (
                  <div
                    key={index}
                    aria-hidden="true"
                    className={cn(
                      'grid h-[60px] place-items-center rounded-[15px] border-[1.5px] border-transparent bg-surface-2 text-[25px] font-extrabold transition-[border-color,background-color,box-shadow] duration-150',
                      otpFocused && !loading && code.length === index && 'border-brand bg-surface shadow-[0_0_0_4px_var(--brand-soft)]',
                      error && 'border-red bg-red-soft',
                    )}
                  >
                    {code[index] ?? ''}
                  </div>
                ))}
                <input
                  ref={otpInput}
                  value={code}
                  onChange={(event) => {
                    const value = event.target.value.replace(/\D/g, '').slice(0, 6)
                    setCode(value)
                    setError('')
                    if (value.length === 6) void verify(value)
                  }}
                  onFocus={() => setOtpFocused(true)}
                  onBlur={() => setOtpFocused(false)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  disabled={loading}
                  aria-label={t('codeInput')}
                  aria-invalid={Boolean(error) || undefined}
                  className="absolute inset-0 size-full cursor-text text-base opacity-0 caret-transparent"
                />
              </div>
              {debugCode && (
                <div className="mt-3.5 rounded-xl bg-blue-soft px-3 py-2.5 text-center text-[13px] font-bold text-blue">
                  {t('devCode')} <b className="tabular tracking-[0.12em]">{debugCode}</b>
                </div>
              )}
              <div className="mt-4 flex min-h-8 items-center justify-center">
                {loading ? (
                  <span className="spinner text-brand" role="status" aria-label={t('signingIn')} />
                ) : secondsLeft > 0 ? (
                  <span className="tabular text-[13px] font-semibold text-muted">
                    {t('resendIn', { time: `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}` })}
                  </span>
                ) : (
                  <button type="button" onClick={() => void requestCode()} className="px-1 py-1.5 text-sm font-extrabold text-brand-text hover:underline">
                    {t('resend')}
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'telegram' && telegramLogin && (
            <div className="text-center">
              <AuthHero icon="telegram" telegram />
              <Title>{t('tgTitle')}</Title>
              <Lead>{t('tgText')}</Lead>
              <a
                href={telegramLogin.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-tg px-5 text-[15.5px] font-extrabold text-white shadow-[0_10px_24px_rgb(42_171_238/0.3)] transition-[filter,transform] hover:brightness-105 active:scale-[0.98]"
              >
                <Icon name="telegram" />
                {t('openTelegram')}
              </a>
              {telegramExpired ? (
                <>
                  <FormError message={t('linkExpired')} />
                  <Button variant="soft" block className="mt-3" loading={loading} onClick={startTelegram}>
                    {t('tryAgain')}
                  </Button>
                </>
              ) : (
                <div className="mt-4 flex items-center justify-center gap-2 text-[13px] font-semibold text-muted" role="status">
                  <span className="spinner size-3.5! border-2!" aria-hidden="true" />
                  {t('waiting')}
                </div>
              )}
            </div>
          )}

          {step === 'name' && (
            <form onSubmit={saveName} noValidate>
              <AuthHero icon="user" />
              <Title>{t('nameTitle')}</Title>
              <Lead>{t('nameText')}</Lead>
              <TextInput
                ref={nameInput}
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setError('')
                }}
                autoComplete="name"
                maxLength={100}
                placeholder={t('yourName')}
                aria-label={t('yourName')}
              />
              <Button type="submit" block className="mt-3.5" iconRight="arrow-right" loading={loading} disabled={!name.trim()}>
                {t('continue')}
              </Button>
              <button
                type="button"
                onClick={() => (session ? finish(session.client) : onClose())}
                className="mx-auto mt-3 block px-2 py-1.5 text-sm font-bold text-muted hover:text-ink-2"
              >
                {t('skip')}
              </button>
            </form>
          )}

          {step !== 'telegram' && <FormError message={error} />}
        </div>
      </SheetBody>
    </>
  )
}
