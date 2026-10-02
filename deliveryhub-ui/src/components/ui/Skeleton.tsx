import { cx } from '../../lib/cx'

/** A shimmering placeholder block; size it (and round it, `rounded-lg` by default) with classes. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={cx('skeleton', !className.includes('rounded') && 'rounded-lg', className)} />
}
