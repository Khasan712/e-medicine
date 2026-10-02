import { useId } from 'react'
import type { Credentials } from '../api/types'
import { cx } from '../lib/cx'
import { hostOf } from '../lib/format'
import { formatPhone } from '../lib/phone'
import { KeyIcon, XIcon } from './icons'
import { CopyButton } from './ui/CopyButton'

interface CredentialsPanelProps {
  credentials: Credentials
  /** The admin panel address of the business. */
  adminUrl: string
  onClose?: () => void
  /** One column (narrow sidebars). */
  compact?: boolean
}

/** The owner's sign-in details, shown once right after they are created. */
export function CredentialsPanel({ credentials, adminUrl, onClose, compact = false }: CredentialsPanelProps) {
  const titleId = useId()
  const everything = `Admin panel: ${adminUrl}\nTelefon: ${credentials.phone}\nParol: ${credentials.password}`

  return (
    <section
      aria-labelledby={titleId}
      className="animate-enter rounded-2xl bg-linear-to-br from-amber-50 to-orange-50 p-5 ring-1 ring-amber-200/80"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-200">
          <KeyIcon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-extrabold text-amber-950">
            Egasi uchun kirish ma'lumotlari — faqat hozir ko'rinadi
          </h2>
          <p className="mt-0.5 text-sm text-amber-800/90">
            Nusxalab, biznes egasiga yuboring: parol boshqa ko'rsatilmaydi.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="-m-1 grid size-8 shrink-0 place-items-center rounded-lg text-amber-700/70 transition hover:bg-amber-100 hover:text-amber-900"
          >
            <XIcon size={18} />
          </button>
        )}
      </div>
      <dl className={cx('mt-4 grid gap-3 text-sm', !compact && 'sm:grid-cols-3')}>
        <div className="min-w-0 rounded-xl bg-white/70 px-3 py-2 ring-1 ring-amber-200/60">
          <dt className="text-xs font-semibold text-amber-700">Admin panel</dt>
          <dd className="mt-0.5 break-all font-mono font-semibold text-slate-900">{hostOf(adminUrl)}</dd>
        </div>
        <div className="min-w-0 rounded-xl bg-white/70 px-3 py-2 ring-1 ring-amber-200/60">
          <dt className="text-xs font-semibold text-amber-700">Telefon</dt>
          <dd className="mt-0.5 font-mono font-semibold text-slate-900">{formatPhone(credentials.phone)}</dd>
        </div>
        <div className="min-w-0 rounded-xl bg-white/70 px-3 py-2 ring-1 ring-amber-200/60">
          <dt className="text-xs font-semibold text-amber-700">Parol</dt>
          <dd className="mt-0.5 select-all break-all font-mono font-semibold text-slate-900">{credentials.password}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CopyButton
          text={everything}
          label="Hammasini nusxalash"
          copiedLabel="Nusxalandi"
          variant="dark"
          size="md"
        />
      </div>
    </section>
  )
}
