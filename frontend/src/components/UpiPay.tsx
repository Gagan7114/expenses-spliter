import { useState } from 'react'
import { formatMoney } from '../lib/money'
import { upiPayLink } from '../lib/upi'
import { Icon } from './icons'

/**
 * "Pay with UPI" for a payment the current user owes. Opens their UPI app,
 * then calls `onOpened` so the screen can ask whether it went through.
 */
export function UpiPayButton({ upiId, name, amountCents, currency, note, onOpened }: {
  upiId?: string; name: string; amountCents: number; currency: string; note: string; onOpened: () => void
}) {
  const [copied, setCopied] = useState(false)
  if (currency !== 'INR') return null
  if (!upiId) return <p className="text-sm text-muted">{name} hasn't added a UPI ID yet. Ask them to add it in their profile.</p>

  async function copy() {
    try {
      await navigator.clipboard.writeText(upiId!)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked; the ID is visible to copy by hand */ }
  }

  return (
    <div className="flex flex-col gap-2">
      <a href={upiPayLink({ upiId, name, amountCents, note })} onClick={onOpened}
        className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-semibold text-on-primary transition hover:brightness-105 active:scale-[.98]">
        <Icon name="wallet" size={20} /> Pay {formatMoney(amountCents, currency)} with UPI
      </a>
      <button type="button" onClick={copy} className="flex items-center justify-center gap-1.5 text-sm text-muted hover:text-ink">
        <span className="num truncate">{upiId}</span> <Icon name={copied ? 'check' : 'copy'} size={14} />
        <span className="sr-only">{copied ? 'Copied' : 'Copy UPI ID'}</span>
      </button>
    </div>
  )
}
