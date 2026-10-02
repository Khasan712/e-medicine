import { useState } from 'react'
import { brandColor, prefersLightText } from '../lib/color'
import { cx } from '../lib/cx'
import { initialOf } from '../lib/format'

const SIZES = {
  sm: 'size-9 rounded-xl text-sm',
  md: 'size-12 rounded-2xl text-lg',
  lg: 'size-16 rounded-2xl text-2xl',
  xl: 'size-20 rounded-3xl text-3xl',
}

interface AvatarProps {
  name: string
  logo?: string | null
  color?: string | null
  size?: keyof typeof SIZES
  className?: string
}

/** The business logo, or its initial on the brand color (also when the logo fails to load). */
export function Avatar({ name, logo, color, size = 'md', className }: AvatarProps) {
  const [failed, setFailed] = useState<string | null>(null)

  if (logo && failed !== logo) {
    return (
      <img
        src={logo}
        alt=""
        decoding="async"
        onError={() => setFailed(logo)}
        className={cx(SIZES[size], 'shrink-0 bg-white object-cover ring-1 ring-slate-900/10', className)}
      />
    )
  }

  const background = brandColor(color)
  return (
    <span
      aria-hidden="true"
      className={cx(
        SIZES[size],
        'inline-flex shrink-0 select-none items-center justify-center font-extrabold shadow-sm ring-1 ring-inset ring-black/5',
        prefersLightText(background) ? 'text-white' : 'text-slate-900',
        className,
      )}
      style={{
        backgroundColor: background,
        backgroundImage: 'linear-gradient(145deg, rgb(255 255 255 / 0.22), rgb(0 0 0 / 0.12))',
      }}
    >
      {initialOf(name || '?')}
    </span>
  )
}
