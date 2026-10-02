import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { telegramApi } from '../../api/endpoints'
import { IconAlert, IconCheck, IconClock, IconCopy, IconRefresh, IconTelegram } from '../../components/icons'
import { Button, ExternalButton } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { useI18n } from '../../i18n/context'
import { cn } from '../../lib/cn'
import { formatDuration, formatTime } from '../../lib/format'

interface InviteModalProps {
  open: boolean
  onClose: () => void
  /** Another staff member (admins only); omitted — the link is for yourself. */
  userId?: number
}

/** `POST /telegram/invites` → one-time link + QR code to connect a Telegram account. */
export function InviteModal(props: InviteModalProps) {
  // Every opening creates a fresh link (links are single-use).
  return props.open ? <InviteDialog {...props} /> : null
}

function InviteDialog({ onClose, userId }: InviteModalProps) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const inputRef = useRef<HTMLInputElement>(null)
  const invite = useMutation({ mutationFn: () => telegramApi.invite(userId) })
  const { mutate } = invite
  const requested = useRef(false)

  useEffect(() => {
    // Once per opening — StrictMode re-runs effects in development.
    if (requested.current) return
    requested.current = true
    mutate()
  }, [mutate])

  const data = invite.data
  useEffect(() => {
    if (!data) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [data])

  const expiresAt = data ? new Date(data.expires_at).getTime() : Number.NaN
  const secondsLeft = Number.isFinite(expiresAt) ? Math.max(0, Math.round((expiresAt - now) / 1000)) : 0
  const expired = !!data && Number.isFinite(expiresAt) && secondsLeft <= 0

  const copy = async () => {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.url)
    } catch {
      inputRef.current?.select()
      document.execCommand?.('copy')
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const regenerate = () => {
    setNow(Date.now())
    setCopied(false)
    invite.mutate()
  }

  const errorText =
    invite.error instanceof ApiError && invite.error.code === 'bot_missing'
      ? t('tg_bot_missing')
      : invite.error instanceof ApiError && invite.error.status === 403
        ? t('error_forbidden')
        : t('tg_invite_error')

  return (
    <Modal
      open
      onClose={onClose}
      title={t('tg_invite_title')}
      size="sm"
      description={
        data?.user ? (
          <>
            {t('tg_invite_for')}: <span className="font-semibold text-fg">{data.user}</span>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col items-center pb-2 text-center">
        <div
          className={cn(
            'qr-frame relative flex size-60 items-center justify-center overflow-hidden rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200',
            expired && 'opacity-40 blur-[2px]',
          )}
        >
          {invite.isPending && <Spinner size={28} className="text-sky-500" label={t('loading')} />}
          {data && !invite.isPending && (
            <img
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(data.qr_svg)}`}
              alt={t('tg_qr_alt')}
              className="size-full"
            />
          )}
          {invite.isError && (
            <div role="alert" className="flex flex-col items-center gap-2 px-3 text-sm text-rose-600">
              <IconAlert size={24} />
              {errorText}
            </div>
          )}
        </div>

        {invite.isError && (
          <Button variant="secondary" size="sm" className="mt-4" icon={<IconRefresh size={15} />} onClick={regenerate}>
            {t('retry')}
          </Button>
        )}

        {data && !expired && !invite.isPending && (
          <>
            <p className="mt-5 text-sm text-muted">{t('tg_invite_scan')}</p>
            <div className="mt-3 flex w-full items-center gap-2">
              <input
                ref={inputRef}
                readOnly
                value={data.url}
                aria-label={t('tg_invite_title')}
                onFocus={(event) => event.currentTarget.select()}
                className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-subtle px-3 text-xs text-fg-soft"
              />
              <Button
                variant={copied ? 'subtle' : 'secondary'}
                onClick={() => void copy()}
                icon={copied ? <IconCheck size={16} className="text-emerald-500" /> : <IconCopy size={16} />}
              >
                {copied ? t('tg_copied') : t('tg_copy')}
              </Button>
            </div>
            <ExternalButton
              href={data.url}
              variant="telegram"
              size="lg"
              className="mt-3 w-full"
              icon={<IconTelegram size={20} className="-rotate-12" />}
            >
              {t('tg_open_telegram')}
            </ExternalButton>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
              <IconClock size={14} />
              {t('tg_invite_until', { time: formatTime(data.expires_at) })}
              <span className="text-faint tabular">({formatDuration(secondsLeft)})</span>
            </p>
          </>
        )}

        {expired && !invite.isPending && (
          <div className="mt-5 flex flex-col items-center gap-3">
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">{t('tg_invite_expired')}</p>
            <Button icon={<IconRefresh size={16} />} onClick={regenerate}>
              {t('tg_new_link')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
