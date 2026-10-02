import { useState } from 'react'
import { useSetBusinessStatus } from '../../api/queries'
import type { BusinessDetail, BusinessStatus } from '../../api/types'
import { PowerIcon } from '../../components/icons'
import { Button } from '../../components/ui/Button'
import type { ButtonSize } from '../../components/ui/styles'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { useToast } from '../../components/ui/toast'

const TEXTS = {
  suspended: {
    button: "To'xtatish",
    title: "Biznes to'xtatilsinmi?",
    description: "Do'kon, admin panel va botlar ishlamay qoladi.",
    done: "Biznes to'xtatildi",
  },
  active: {
    button: 'Yoqish',
    title: 'Biznes yoqilsinmi?',
    description: "Do'kon, admin panel va botlar yana ishlay boshlaydi.",
    done: 'Biznes yoqildi',
  },
} satisfies Record<BusinessStatus, Record<string, string>>

/** Suspend / activate with a confirmation. */
interface StatusToggleProps {
  business: BusinessDetail
  size?: ButtonSize
  className?: string
}

export function StatusToggle({ business, size = 'md', className }: StatusToggleProps) {
  const setStatus = useSetBusinessStatus(business.slug)
  const toast = useToast()
  // The change asked for — fixed while the dialog is open, even after the status flips underneath.
  const [target, setTarget] = useState<BusinessStatus | null>(null)
  const next: BusinessStatus = business.status === 'active' ? 'suspended' : 'active'
  const texts = TEXTS[target ?? next]

  return (
    <>
      <Button
        variant={next === 'suspended' ? 'danger' : 'success'}
        size={size}
        className={className}
        onClick={() => setTarget(next)}
      >
        <PowerIcon size={16} />
        {TEXTS[next].button}
      </Button>
      <ConfirmDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        title={texts.title}
        description={texts.description}
        confirmLabel={texts.button}
        tone={target === 'suspended' ? 'danger' : 'success'}
        onConfirm={async () => {
          if (!target) return
          await setStatus.mutateAsync(target)
          toast.success(TEXTS[target].done)
        }}
      />
    </>
  )
}
