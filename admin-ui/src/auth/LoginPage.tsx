import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { ApiError } from '../api/client'
import { authApi } from '../api/endpoints'
import { errorMessage, mapFieldErrors } from '../api/errors'
import { BusinessLogo } from '../components/BusinessLogo'
import { IconAlert, IconInfo, IconLogOut, IconPhone, IconTelegram } from '../components/icons'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { Button } from '../components/ui/Button'
import { Field, Input, PasswordInput } from '../components/ui/Form'
import { useI18n } from '../i18n/context'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { BrandMark, CenteredScreen, FullPageLoader } from './SystemScreens'
import { rememberedBusiness, safeNext, useSession } from './session'

export function LoginPage() {
  const { t } = useI18n()
  const session = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const reason = (location.state as { reason?: string } | null)?.reason

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ phone?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const business = session.business ?? rememberedBusiness()
  const phoneRef = useRef<HTMLInputElement>(null)
  useDocumentTitle(t('sign_in'), business?.name ?? t('app_admin_panel'))

  // Focus the phone field on desktop; on phones the keyboard should not pop up by itself.
  useEffect(() => {
    if (window.matchMedia?.('(pointer: fine)').matches) phoneRef.current?.focus()
  }, [session.status])

  const login = useMutation({
    mutationFn: () => authApi.login(phone.trim(), password),
    onSuccess: (data) => {
      session.signIn(data)
      navigate(next, { replace: true })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'invalid_credentials') {
        setFormError(t('invalid_credentials'))
        return
      }
      const fields = mapFieldErrors(error, t)
      if (Object.keys(fields).length) setErrors(fields)
      else setFormError(errorMessage(error, t))
    },
  })

  if (session.status === 'loading') return <FullPageLoader />
  if (session.status === 'authenticated' && !login.isPending) return <Navigate to={next} replace />

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: typeof errors = {}
    if (!phone.trim()) nextErrors.phone = t('enter_phone')
    if (!password) nextErrors.password = t('enter_password')
    setErrors(nextErrors)
    setFormError(null)
    if (Object.keys(nextErrors).length) return
    login.mutate()
  }

  return (
    <CenteredScreen corner={<LanguageSwitch variant="dark" />}>
      <div className="mb-8 flex flex-col items-center text-center">
        {business ? (
          <BusinessLogo name={business.name} logo={business.logo} brandColor={business.brand_color} size="xl" className="shadow-lg ring-1 ring-white/20" />
        ) : (
          <BrandMark />
        )}
        <h1 className="mt-5 text-3xl font-bold tracking-tight">{business?.name ?? t('app_platform')}</h1>
        <p className="mt-1.5 text-sm text-slate-400">{t('app_admin_panel')}</p>
      </div>

      <div className="rounded-3xl border border-line bg-card p-6 text-fg shadow-2xl shadow-black/40 sm:p-8">
        <h2 className="text-xl font-semibold">{t('sign_in_to_account')}</h2>
        <p className="mt-1 text-sm text-muted">{t('sign_in_subtitle')}</p>

        {reason === 'expired' && !formError && (
          <p className="mt-5 flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            <IconInfo size={16} className="shrink-0" />
            {t('session_expired')}
          </p>
        )}
        {reason === 'logout' && !formError && (
          <p className="mt-5 flex items-center gap-2 rounded-xl bg-subtle px-3.5 py-2.5 text-[13px] font-medium text-fg-soft">
            <IconLogOut size={16} className="shrink-0" />
            {t('logged_out')}
          </p>
        )}
        {formError && (
          <p
            role="alert"
            className="mt-5 flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
          >
            <IconAlert size={16} className="shrink-0" />
            {formError}
          </p>
        )}

        <form onSubmit={submit} noValidate className="mt-6 space-y-5">
          <Field label={t('phone_number')} error={errors.phone}>
            {(props) => (
              <Input
                {...props}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="username"
                placeholder="+998 90 123 45 67"
                inputSize="lg"
                leading={<IconPhone size={18} />}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                ref={phoneRef}
              />
            )}
          </Field>
          <Field label={t('password')} error={errors.password}>
            {(props) => (
              <PasswordInput
                {...props}
                name="password"
                autoComplete="current-password"
                inputSize="lg"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            )}
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
            {login.isPending ? t('signing_in') : t('sign_in')}
          </Button>
        </form>
      </div>

      <p className="mt-6 flex items-center justify-center gap-2 text-center text-[13px] text-slate-400">
        <IconTelegram size={16} className="-rotate-12" />
        {t('login_telegram_hint')}
      </p>
      <p className="mt-2 text-center text-xs text-slate-500">
        {t('app_platform')} · {t('universal_delivery_system')}
      </p>
    </CenteredScreen>
  )
}
