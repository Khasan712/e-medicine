import type { Bot } from '../api/types'
import { cx } from '../lib/cx'

export const ALIVE_TEXT = 'Ishlayapti'
export const DEAD_TEXT = "Jarayon o'chiq"

/** Green and pulsing while the bot service polls the bot, amber otherwise. */
export function AliveDot({ alive, className }: { alive: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={cx('relative inline-flex size-2.5 shrink-0', className)}>
      {alive && <span className="absolute inset-0 rounded-full bg-emerald-400 animate-alive" />}
      <span className={cx('relative inline-flex size-2.5 rounded-full', alive ? 'bg-emerald-500' : 'bg-amber-400')} />
    </span>
  )
}

export function AliveBadge({ alive }: { alive: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset',
        alive ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20',
      )}
    >
      <AliveDot alive={alive} className="size-2" />
      {alive ? ALIVE_TEXT : DEAD_TEXT}
    </span>
  )
}

/** One bot of a business on its card in the list. */
export function BotLine({ label, bot }: { label: string; bot: Bot | null }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      {bot ? (
        <span
          className="flex min-w-0 items-center gap-2 font-semibold text-slate-800"
          title={bot.alive ? ALIVE_TEXT : 'Bot jarayoni ishlamayapti'}
        >
          <AliveDot alive={bot.alive} />
          <span className="truncate">@{bot.username}</span>
          <span className="sr-only">({bot.alive ? 'ishlayapti' : 'bot jarayoni ishlamayapti'})</span>
        </span>
      ) : (
        <span className="text-slate-400">ulanmagan</span>
      )}
    </div>
  )
}
