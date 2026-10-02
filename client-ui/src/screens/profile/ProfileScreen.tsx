import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { updateMe } from '../../api/shop'
import { Button, IconButton } from '../../components/Button'
import { PageTitle } from '../../components/Card'
import { Field, TextInput } from '../../components/Field'
import { Icon, type IconName } from '../../components/Icon'
import { Segmented } from '../../components/Segmented'
import { useI18n } from '../../i18n/i18n'
import { cn } from '../../lib/cn'
import { errorMessageKey } from '../../lib/errors'
import { useFocusOnMount } from '../../lib/focus'
import { displayPhone } from '../../lib/format'
import { isTelegram } from '../../lib/telegram'
import { avatarLetter, clientName, useAuth } from '../../state/auth'
import { useCatalog } from '../../state/catalog'
import { useChangeLanguage, useDocumentTitle, useFreshClient } from '../../state/hooks'
import { useNav } from '../../state/nav'
import { useTheme } from '../../state/theme'
import { useToast } from '../../state/toast'

function Row({ icon, label, children, tone }: { icon: IconName; label: ReactNode; children?: ReactNode; tone?: 'danger' | 'telegram' }) {
  return (
    <>
      <span
        className={cn(
          'grid size-[38px] shrink-0 place-items-center rounded-xl',
          tone === 'danger' ? 'bg-red-soft text-red' : tone === 'telegram' ? 'bg-surface-2 text-tg' : 'bg-surface-2 text-ink-2',
        )}
      >
        <Icon name={icon} />
      </span>
      <span className={cn('min-w-0 flex-1 text-[15px] font-bold', tone === 'danger' && 'text-red')}>{label}</span>
      {children}
    </>
  )
}

const ROW = 'flex w-full items-center gap-3 px-3.5 py-[13px] text-left'
const LIST = 'mt-3.5 divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface'
const SETTING = 'flex flex-col gap-3 px-3.5 py-[13px] sm:flex-row sm:items-center'

export function ProfileScreen() {
  const { t, lang } = useI18n()
  useDocumentTitle(t('profile'))
  const { client, token, status, signOut } = useAuth()
  useFreshClient()
  const { business } = useCatalog()
  const { openSheet, go } = useNav()
  const changeLanguage = useChangeLanguage()
  const theme = useTheme()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const inTelegram = isTelegram()
  const signedIn = Boolean(token)
  const fullName = clientName(client)
  const subtitle = client ? displayPhone(client.phone) || (client.tg_nick ? `@${client.tg_nick}` : '') : t('loginPrompt')

  return (
    <div className="mx-auto max-w-[560px] pb-12">
      <PageTitle>{t('profile')}</PageTitle>

      <section className="relative flex items-center gap-3.5 overflow-hidden rounded-[28px] bg-[radial-gradient(90%_120%_at_100%_0%,rgb(124_92_255/0.55),transparent_60%),linear-gradient(135deg,#1b1b21,#2b2b35)] p-[22px] text-white">
        <span className="grid size-[58px] shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#7c5cff,#ff5a9e)] text-xl font-extrabold shadow-[0_8px_20px_rgb(0_0_0/0.3)]">
          {(signedIn && avatarLetter(client)) || <Icon name="user" className="size-7" />}
        </span>
        <div className="min-w-0 flex-1">
          {(signedIn && !client) || status === 'loading' ? (
            <>
              <span className="block h-5 w-32 animate-pulse rounded-md bg-white/15" />
              <span className="mt-2 block h-3.5 w-24 animate-pulse rounded-md bg-white/10" />
            </>
          ) : (
            <>
              <h2 className="truncate text-xl font-extrabold tracking-[-0.02em]">{signedIn ? fullName || t('guest') : t('guest')}</h2>
              <p className="mt-0.5 line-clamp-2 text-sm font-semibold opacity-75">{signedIn ? subtitle : t('loginPrompt')}</p>
            </>
          )}
        </div>
        {signedIn && client && !editing && (
          <IconButton
            icon="pencil"
            label={t('editName')}
            onClick={() => setEditing(true)}
            className="text-white/80 hover:bg-white/10"
            iconClassName="size-[18px]"
          />
        )}
      </section>

      {editing && client && token && (
        <NameForm
          token={token}
          firstName={client.first_name}
          lastName={client.last_name}
          onDone={() => setEditing(false)}
        />
      )}

      {!signedIn && status === 'ready' && (
        <Button block className="mt-3.5" iconRight="arrow-right" onClick={() => openSheet({ type: 'auth' })}>
          {t('login')}
        </Button>
      )}

      <div className={LIST}>
        {signedIn && (
          <Link to="/orders" className={cn(ROW, 'transition-colors hover:bg-surface-2')}>
            <Row icon="receipt" label={t('orders')}>
              <Icon name="chevron-right" className="size-4 text-muted" />
            </Row>
          </Link>
        )}
        <div className={SETTING}>
          <div className="flex flex-1 items-center gap-3">
            <Row icon="globe" label={t('language')} />
          </div>
          <Segmented
            label={t('language')}
            size="sm"
            value={lang}
            onChange={changeLanguage}
            className="sm:w-[240px]"
            options={[
              { value: 'uz', label: 'O‘zbekcha' },
              { value: 'ru', label: 'Русский' },
            ]}
          />
        </div>
        {theme.canChange && (
          <div className={SETTING}>
            <div className="flex flex-1 items-center gap-3">
              <Row icon={theme.resolved === 'dark' ? 'moon' : 'sun'} label={t('theme')} />
            </div>
            <Segmented
              label={t('theme')}
              size="sm"
              value={theme.preference}
              onChange={theme.setPreference}
              className="sm:w-[300px]"
              options={[
                { value: 'auto', label: t('theme_auto') },
                { value: 'light', label: t('theme_light') },
                { value: 'dark', label: t('theme_dark') },
              ]}
            />
          </div>
        )}
        {business?.support_phone && (
          <a
            href={`tel:${business.support_phone}`}
            aria-label={`${t('support')}: ${displayPhone(business.support_phone)}`}
            className={cn(ROW, 'transition-colors hover:bg-surface-2')}
          >
            <Row icon="phone" label={t('support')}>
              <span className="tabular text-sm font-bold whitespace-nowrap text-muted">{displayPhone(business.support_phone)}</span>
            </Row>
          </a>
        )}
        {client?.telegram && (
          <div className={ROW}>
            <Row icon="telegram" tone="telegram" label={t('telegramAccount')}>
              <span className="flex items-center gap-1 text-sm font-bold text-green">
                <Icon name="check" className="size-4" />
                {client.tg_nick ? `@${client.tg_nick}` : t('connected')}
              </span>
            </Row>
          </div>
        )}
      </div>

      {signedIn && !inTelegram && (
        <div className={LIST}>
          <button
            type="button"
            aria-label={t('logout')}
            className={cn(ROW, 'transition-colors hover:bg-red-soft')}
            onClick={() => {
              signOut('user')
              toast(t('loggedOut'))
              go('/', { replace: true })
            }}
          >
            <Row icon="logout" tone="danger" label={t('logout')} />
          </button>
        </div>
      )}
    </div>
  )
}

function NameForm({ token, firstName, lastName, onDone }: { token: string; firstName: string; lastName: string; onDone: () => void }) {
  const { t, lang } = useI18n()
  const { setClient } = useAuth()
  const toast = useToast()
  const [first, setFirst] = useState(firstName)
  const [last, setLast] = useState(lastName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const firstInput = useRef<HTMLInputElement>(null)
  useFocusOnMount(firstInput)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!first.trim()) {
      setError(t('required'))
      return
    }
    setSaving(true)
    try {
      const { client } = await updateMe(token, { first_name: first.trim(), last_name: last.trim(), lang })
      setClient(client)
      toast(t('saved'), { type: 'success' })
      onDone()
    } catch (caught) {
      toast(t(errorMessageKey(caught)), { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-3.5 animate-rise-in rounded-[20px] border border-line bg-surface p-4">
      <Field id="profile-first-name" label={t('firstName')} error={error}>
        <TextInput
          id="profile-first-name"
          ref={firstInput}
          value={first}
          onChange={(event) => {
            setFirst(event.target.value)
            setError('')
          }}
          invalid={Boolean(error)}
          autoComplete="given-name"
          maxLength={100}
        />
      </Field>
      <Field id="profile-last-name" label={t('lastName')} hint={t('optional')}>
        <TextInput
          id="profile-last-name"
          value={last}
          onChange={(event) => setLast(event.target.value)}
          autoComplete="family-name"
          maxLength={100}
        />
      </Field>
      <div className="mt-1 flex gap-2">
        <Button type="submit" size="md" className="flex-1" loading={saving}>
          {t('save')}
        </Button>
        <Button variant="soft" size="md" className="flex-1" onClick={onDone}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  )
}
