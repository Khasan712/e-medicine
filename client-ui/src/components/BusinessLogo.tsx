import { useState } from 'react'
import { cn } from '../lib/cn'
import { initial } from '../lib/format'

interface BusinessLogoProps {
  name: string | undefined
  logo: string | null | undefined
  className?: string
}

/** The business logo, or its first letter on the brand gradient. */
export function BusinessLogo({ name, logo, className }: BusinessLogoProps) {
  const [failed, setFailed] = useState<string | null>(null)
  if (logo && failed !== logo) {
    return (
      <img
        src={logo}
        alt=""
        draggable={false}
        onError={() => setFailed(logo)}
        className={cn('shrink-0 bg-surface object-cover ring-1 ring-line', className)}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'brand-gradient grid shrink-0 place-items-center font-extrabold text-brand-ink shadow-[0_6px_16px_color-mix(in_srgb,var(--brand)_38%,transparent)]',
        className,
      )}
    >
      {initial(name)}
    </span>
  )
}
