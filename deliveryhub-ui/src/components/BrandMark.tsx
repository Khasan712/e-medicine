import { cx } from '../lib/cx'
import { LayersIcon } from './icons'

export function BrandMark({ size = 'md', className }: { size?: 'md' | 'lg'; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'grid shrink-0 place-items-center bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30 ring-1 ring-inset ring-white/15',
        size === 'lg' ? 'size-14 rounded-2xl' : 'size-9 rounded-xl',
        className,
      )}
    >
      <LayersIcon size={size === 'lg' ? 30 : 20} />
    </span>
  )
}
