import { formatMoney } from '../lib/money'

/** "you're owed ₹1,200" / "you owe ₹420" / "settled up" as a colored pill. */
export function BalancePill({ cents, currency, you = true }: { cents: number; currency: string; you?: boolean }) {
  if (cents === 0) return <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted">settled up</span>
  const owed = cents > 0
  const text = you ? (owed ? "you're owed" : 'you owe') : owed ? 'gets back' : 'owes'
  return (
    <span className={`num whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${owed ? 'bg-owed-bg text-owed' : 'bg-owes-bg text-owes'}`}>
      {text} {formatMoney(cents, currency)}
    </span>
  )
}
