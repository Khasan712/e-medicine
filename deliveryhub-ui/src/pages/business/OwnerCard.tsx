import { useState } from 'react'
import { useNewOwnerPassword } from '../../api/queries'
import type { BusinessDetail, Credentials } from '../../api/types'
import { CredentialsPanel } from '../../components/CredentialsPanel'
import { KeyIcon, UserIcon } from '../../components/icons'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { initialOf } from '../../lib/format'
import { formatPhone } from '../../lib/phone'

export function OwnerCard({ business }: { business: BusinessDetail }) {
  const newPassword = useNewOwnerPassword(business.slug)
  const [confirming, setConfirming] = useState(false)
  // A new password is shown once, here, until closed or the page is left.
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const owner = business.owner

  return (
    <Card title="Egasi" titleId="business-owner" icon={<UserIcon size={18} />}>
      {owner ? (
        <>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-slate-900 font-extrabold text-white"
            >
              {initialOf(owner.name || '?')}
            </span>
            <div className="min-w-0">
              <p className="truncate font-bold text-slate-900">{owner.name || '—'}</p>
              <p className="font-mono text-sm text-slate-500">{formatPhone(owner.phone)}</p>
            </div>
          </div>
          <Button variant="soft" className="mt-4" onClick={() => setConfirming(true)}>
            <KeyIcon size={16} />
            Yangi parol yaratish
          </Button>
          {credentials && (
            <div className="mt-4">
              <CredentialsPanel
                compact
                credentials={credentials}
                adminUrl={business.links.admin}
                onClose={() => setCredentials(null)}
              />
            </div>
          )}
          <ConfirmDialog
            open={confirming}
            onClose={() => setConfirming(false)}
            title="Egasi uchun yangi parol yaratilsinmi?"
            description="Eskisi ishlamay qoladi. Yangi parol faqat bir marta ko'rsatiladi."
            confirmLabel="Yangi parol yaratish"
            icon={<KeyIcon size={22} />}
            onConfirm={async () => setCredentials(await newPassword.mutateAsync())}
          />
        </>
      ) : (
        <p className="text-sm text-slate-500">Admin akkaunt topilmadi.</p>
      )}
    </Card>
  )
}
