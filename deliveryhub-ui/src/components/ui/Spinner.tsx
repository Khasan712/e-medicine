import { cx } from '../../lib/cx'

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cx('shrink-0 animate-spin', className)}
    >
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="3" opacity="0.22" />
      <path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
