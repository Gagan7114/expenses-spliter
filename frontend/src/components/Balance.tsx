import { formatMoney } from '../lib/money'

/** "you're owed ₹1,200" / "you owe ₹420" / "settled up" as a colored pill. */
export function BalancePill({ cents, currency, you = true }: { cents: number; currency: string; you?: boolean }) {
  if (cents === 0) return <span className="whitespace-nowrap rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted">settled up</span>
  const owed = cents > 0
  const text = you ? (owed ? "you're owed" : 'you owe') : owed ? 'gets back' : 'owes'
  return (
    <span className={`num whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${owed ? 'bg-owed-bg text-owed' : 'bg-owes-bg text-owes'}`}>
      {text} {formatMoney(cents, currency)}
    </span>
  )
}

/** Right-hand column of an expense row: what this expense did to *your* balance. */
export function NetAmount({ net, share, currency, notInvolved = 'not involved' }: { net: number; share: number; currency: string; notInvolved?: string }) {
  if (net === 0) return <span className="num shrink-0 text-right text-[13px] text-faint">{share ? 'even' : notInvolved}</span>
  const lent = net > 0
  return (
    <span className="num flex shrink-0 flex-col items-end leading-tight">
      <span className={`text-[11px] font-medium ${lent ? 'text-owed' : 'text-owes'}`}>{lent ? 'you lent' : 'you borrowed'}</span>
      <span className={`text-[15px] font-semibold ${lent ? 'text-owed' : 'text-owes'}`}>{formatMoney(net, currency)}</span>
    </span>
  )
}
