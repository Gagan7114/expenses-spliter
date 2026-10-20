import { useState } from 'react'
import { formatMoney } from '../lib/money'
import { UPI_APPS, upiPayLink } from '../lib/upi'
import { Icon } from './icons'
import { BottomSheet } from './ui'

/**
 * "Pay with UPI" for a payment the current user owes. Asks which UPI app to
 * use, opens it, then calls `onOpened` so the screen can ask whether it went through.
 */
export function UpiPayButton({ upiId, name, amountCents, currency, note, onOpened }: {
  upiId?: string; name: string; amountCents: number; currency: string; note: string; onOpened: () => void
}) {
  const [choosing, setChoosing] = useState(false)
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
      <button type="button" onClick={() => setChoosing(true)}
        className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-semibold text-on-primary transition hover:brightness-105 active:scale-[.98]">
        <Icon name="wallet" size={20} /> Pay {formatMoney(amountCents, currency)} with UPI
      </button>
      <button type="button" onClick={copy} className="flex items-center justify-center gap-1.5 text-sm text-muted hover:text-ink">
        <span className="num truncate">{upiId}</span> <Icon name={copied ? 'check' : 'copy'} size={14} />
        <span className="sr-only">{copied ? 'Copied' : 'Copy UPI ID'}</span>
      </button>

      <BottomSheet open={choosing} onClose={() => setChoosing(false)} title="Pay with which app?">
        <p className="mb-3 text-muted">
          <span className="num font-semibold text-ink">{formatMoney(amountCents, currency)}</span> to {name} · {upiId}
        </p>
        <ul className="flex flex-col gap-2">
          {UPI_APPS.map((app) => (
            <li key={app.id}>
              <a href={upiPayLink({ upiId, name, amountCents, note, app })}
                onClick={() => { setChoosing(false); onOpened() }}
                className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface-2 px-4 font-semibold transition hover:brightness-105 active:scale-[.98]">
                <Icon name="wallet" size={20} />
                <span className="flex-1">{app.name}</span>
                <Icon name="chevron" size={18} />
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">If nothing opens, that app isn't installed. Pick another, or copy the UPI ID and paste it into any UPI app.</p>
      </BottomSheet>
    </div>
  )
}
