import { formatNumber } from '../lib/format'

/** An amount in so'm with a quieter currency that can wrap to the next line on narrow tiles. */
export function Money({ value }: { value: number }) {
  return (
    <>
      {formatNumber(value)} <span className="text-[0.6em] font-bold text-slate-400">so'm</span>
    </>
  )
}
