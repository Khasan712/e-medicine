import { useState } from 'react'
import { cn } from '../lib/cn'
import { initial } from '../lib/format'

interface BusinessLogoProps {
  name: string | undefined
  logo: string | null | undefined
  className?: string
}

/** The business logo, or its first letter on the brand colour. */
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
        'grid shrink-0 place-items-center bg-brand font-extrabold text-brand-ink',
        className,
      )}
    >
      {initial(name)}
    </span>
  )
}
