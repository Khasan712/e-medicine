import { useState } from 'react'
import { IconImage } from '../../components/icons'
import { cn } from '../../lib/cn'

const SIZES = {
  sm: 'size-10 rounded-lg',
  md: 'size-12 rounded-xl',
  lg: 'size-16 rounded-xl',
}

export function ProductThumb({ src, size = 'md', className }: { src: string | null | undefined; size?: keyof typeof SIZES; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={cn('shrink-0 bg-subtle object-cover ring-1 ring-line', SIZES[size], className)}
      />
    )
  }
  return (
    <span className={cn('flex shrink-0 items-center justify-center bg-subtle text-faint ring-1 ring-line', SIZES[size], className)}>
      <IconImage size={size === 'sm' ? 16 : 20} />
    </span>
  )
}
