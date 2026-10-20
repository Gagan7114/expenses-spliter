import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { formatMoney } from '../lib/money'
import { UPI_APPS, upiAmount, upiPayLink, upiQrText } from '../lib/upi'
import { Icon } from './icons'
import { BottomSheet, Button } from './ui'

/**
 * "Pay with UPI" for a payment the current user owes. Asks which UPI app to
 * use (or shows a QR to scan), then calls `onOpened` so the screen can ask
 * whether it went through. Copy buttons are the fallback when an app refuses
 * a link, which some do for payments to personal UPI IDs.
 */
export function UpiPayButton({ upiId, name, amountCents, currency, note, onOpened }: {
  upiId?: string; name: string; amountCents: number; currency: string; note: string; onOpened: () => void
}) {
  const [sheet, setSheet] = useState<'apps' | 'qr' | null>(null)
  const [copied, setCopied] = useState<'id' | 'amount' | null>(null)
  if (currency !== 'INR') return null
  if (!upiId) return <p className="text-sm text-muted">{name} hasn't added a UPI ID yet. Ask them to add it in their profile.</p>

  const payment = { upiId, name, amountCents, note }
  const amount = formatMoney(amountCents, currency)

  async function copy(what: 'id' | 'amount') {
    try {
      await navigator.clipboard.writeText(what === 'id' ? upiId! : upiAmount(amountCents))
      setCopied(what)
      setTimeout(() => setCopied(null), 1500)
    } catch { /* clipboard blocked; both values are on screen to copy by hand */ }
  }

  const chip = 'flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-surface-2 px-3 text-sm font-semibold transition hover:brightness-105 active:scale-[.98]'

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => setSheet('apps')}
        className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-semibold text-on-primary transition hover:brightness-105 active:scale-[.98]">
        <Icon name="wallet" size={20} /> Pay {amount} with UPI
      </button>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
        <button type="button" onClick={() => copy('id')} className={chip} aria-label="Copy UPI ID">
          <span className="num truncate">{upiId}</span> <Icon name={copied === 'id' ? 'check' : 'copy'} size={14} />
        </button>
        <button type="button" onClick={() => copy('amount')} className={chip} aria-label="Copy amount">
          <span className="num">{copied === 'amount' ? 'Copied' : amount}</span> <Icon name={copied === 'amount' ? 'check' : 'copy'} size={14} />
        </button>
        <button type="button" onClick={() => setSheet('qr')} className={chip}>
          <Icon name="qr" size={16} /> QR
        </button>
      </div>

      <BottomSheet open={sheet === 'apps'} onClose={() => setSheet(null)} title="Pay with which app?">
        <p className="mb-3 text-muted">
          <span className="num font-semibold text-ink">{amount}</span> to {name} · {upiId}
        </p>
        <p className="mb-3 rounded-xl bg-surface-2 px-4 py-3 text-sm">
          We'll copy <span className="num font-semibold">{amount}</span> for you. In the app, tap the amount box and paste it.
          Apps often block payments where another app fills in the amount.
        </p>
        <ul className="flex flex-col gap-2">
          {UPI_APPS.map((app) => (
            <li key={app.id}>
              <a href={upiPayLink({ ...payment, app })}
                onClick={() => {
                  // Started inside the tap (not awaited) so iOS allows it before the app opens.
                  navigator.clipboard?.writeText(upiAmount(amountCents)).catch(() => {})
                  setSheet(null); onOpened()
                }}
                className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface-2 px-4 font-semibold transition hover:brightness-105 active:scale-[.98]">
                <Icon name="wallet" size={20} />
                <span className="flex-1">{app.name}</span>
                <Icon name="chevron" size={18} />
              </a>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setSheet('qr')}
              className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-surface-2 px-4 text-left font-semibold transition hover:brightness-105 active:scale-[.98]">
              <Icon name="qr" size={20} />
              <span className="flex-1">Show QR code</span>
              <Icon name="chevron" size={18} />
            </button>
          </li>
        </ul>
        <p className="mt-3 text-sm text-muted">
          If an app doesn't open or says the payment failed, use the QR code, or copy the UPI ID and amount and pay from any UPI app.
        </p>
      </BottomSheet>

      <BottomSheet open={sheet === 'qr'} onClose={() => setSheet(null)} title="Scan to pay">
        <div className="flex flex-col items-center gap-4">
          {/* Always dark-on-white: scanners struggle with inverted codes in dark mode. */}
          <div className="rounded-2xl bg-white p-4">
            <QRCodeSVG value={upiQrText(payment)} size={220} level="M" bgColor="#ffffff" fgColor="#000000" />
          </div>
          <p className="text-center text-muted">
            <span className="num font-display text-2xl font-bold text-ink">{amount}</span><br />
            to {name} · <span className="num">{upiId}</span>
          </p>
          <p className="text-center text-sm text-muted">
            Scan it with any UPI app. Paying from this same phone? Take a screenshot and open it from your UPI app's scanner (the gallery icon).
          </p>
          <Button className="w-full" onClick={() => { setSheet(null); onOpened() }}>I've paid</Button>
        </div>
      </BottomSheet>
    </div>
  )
}
