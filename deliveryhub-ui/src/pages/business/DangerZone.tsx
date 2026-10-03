import { useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { useDeleteBusiness } from '../../api/queries'
import type { BusinessDetail } from '../../api/types'
import { AlertIcon, TrashIcon } from '../../components/icons'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { inputClass } from '../../components/ui/styles'
import { useToast } from '../../components/ui/toast'

/** Deleting the business for good: only a suspended one, and only after its address is typed by hand. */
export function DangerZone({ business }: { business: BusinessDetail }) {
  const navigate = useNavigate()
  const toast = useToast()
  const remove = useDeleteBusiness(business.slug)
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const titleId = useId()
  const hintId = useId()
  const inputId = useId()
  const active = business.status === 'active'

  const close = () => {
    setOpen(false)
    setTyped('')
  }

  return (
    <section aria-labelledby={titleId} className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-red-200 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
            <AlertIcon size={18} />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-[17px] font-extrabold tracking-tight text-slate-900">
              Biznesni o'chirish
            </h2>
            <p id={hintId} className="mt-0.5 text-sm text-slate-500">
              {active
                ? "Avval biznesni to'xtating — faqat to'xtatilgan biznes butunlay o'chiriladi."
                : "Biznes va uning barcha ma'lumotlari butunlay o'chiriladi. Bu amalni qaytarib bo'lmaydi."}
            </p>
          </div>
        </div>
        <Button
          variant="danger"
          className="shrink-0 max-sm:w-full"
          disabled={active}
          aria-describedby={hintId}
          onClick={() => setOpen(true)}
        >
          <TrashIcon size={16} />
          Biznesni o'chirish
        </Button>
      </div>

      <ConfirmDialog
        open={open}
        onClose={close}
        tone="danger"
        icon={<TrashIcon size={22} />}
        title={`«${business.name}» butunlay o'chirilsinmi?`}
        description={
          <>
            Do'kon va admin panel manzillari, barcha buyurtmalar, mijozlar, mahsulotlar, xodimlar va rasmlar
            o'chiriladi. Botlar platformadan uziladi — Telegram'da egalarida qoladi. <b>Bu amalni qaytarib bo'lmaydi.</b>
          </>
        }
        confirmLabel="Butunlay o'chirish"
        confirmDisabled={typed.trim() !== business.slug}
        onConfirm={async () => {
          await remove.mutateAsync(typed.trim())
          toast.success("Biznes o'chirildi", { description: business.name })
          navigate('/', { replace: true })
        }}
      >
        <label htmlFor={inputId} className="block text-sm font-semibold text-slate-700">
          Tasdiqlash uchun manzilni yozing: <code className="font-mono text-red-600">{business.slug}</code>
        </label>
        <input
          id={inputId}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className={inputClass(false, 'mt-1.5 h-11 font-mono text-[15px]')}
        />
      </ConfirmDialog>
    </section>
  )
}
