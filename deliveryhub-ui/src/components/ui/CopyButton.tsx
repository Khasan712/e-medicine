import { copyText } from '../../lib/clipboard'
import { useFlag } from '../../lib/hooks'
import { CheckIcon, CopyIcon } from '../icons'
import { Button } from './Button'
import type { ButtonSize, ButtonVariant } from './styles'
import { useToast } from './toast'

interface CopyButtonProps {
  text: string
  label?: string
  copiedLabel?: string
  variant?: ButtonVariant
  size?: ButtonSize
  /** Only the icon is visible; `label` becomes the accessible name. */
  iconOnly?: boolean
  className?: string
}

export function CopyButton({
  text,
  label = 'Nusxalash',
  copiedLabel = 'Nusxalandi',
  variant = 'secondary',
  size = 'sm',
  iconOnly = false,
  className,
}: CopyButtonProps) {
  const [copied, flash] = useFlag(2000)
  const toast = useToast()

  const copy = async () => {
    if (await copyText(text)) flash()
    else toast.error("Nusxalab bo'lmadi", { description: 'Matnni belgilab, qo\'lda nusxalang.' })
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={copy}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        className={className}
      >
        {copied ? <CheckIcon size={15} className="text-emerald-600" /> : <CopyIcon size={15} />}
        {!iconOnly && (copied ? copiedLabel : label)}
      </Button>
      <output className="sr-only">{copied ? copiedLabel : ''}</output>
    </>
  )
}
