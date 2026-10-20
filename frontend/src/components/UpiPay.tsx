import { useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { formatMoney } from '../lib/money'
import { UPI_APPS, upiAmount, upiPayLink, upiQrText } from '../lib/upi'
import { Icon } from './icons'
import { BottomSheet, Button } from './ui'

/**
 * "Pay with UPI" for a payment the current user owes. Asks which UPI app to
 * use and opens it, or shows a QR to save and scan. Calls `onOpened` so the
 * screen can ask whether it went through. Copy buttons are the fallback for any other app.
 */
export function UpiPayButton({ upiId, name, amountCents, currency, note, onOpened }: {
  upiId?: string; name: string; amountCents: number; currency: string; note: string; onOpened: () => void
}) {
  const [sheet, setSheet] = useState<'apps' | 'qr' | null>(null)
  const [copied, setCopied] = useState<'id' | 'amount' | null>(null)
  const [saveError, setSaveError] = useState(false)
  const qr = useRef<HTMLCanvasElement>(null)
  if (currency !== 'INR') return null
  if (!upiId) return <p className="text-sm text-muted">{name} hasn't added a UPI ID yet. Ask them to add it in their profile.</p>

  const payment = { upiId, name, amountCents, note }
  const amount = formatMoney(amountCents, currency)
  const close = () => { setSheet(null); setSaveError(false) }

  async function copy(what: 'id' | 'amount') {
    try {
      await navigator.clipboard.writeText(what === 'id' ? upiId! : upiAmount(amountCents))
      setCopied(what)
      setTimeout(() => setCopied(null), 1500)
    } catch { /* clipboard blocked; both values are on screen to copy by hand */ }
  }

  /** Opens the share sheet ("Save Image" on iPhone), or downloads the PNG where sharing files isn't supported. */
  async function saveQr() {
    if (!qr.current) return
    setSaveError(false)
    // Converted synchronously so the share call stays inside the tap, which iOS requires.
    const [, b64] = qr.current.toDataURL('image/png').split(',')
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const file = new File([bytes], `pay-${name.replace(/\W+/g, '-').toLowerCase()}-upi.png`, { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setSaveError(true)
      }
      return
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(file)
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const chip = 'flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-surface-2 px-3 text-sm font-semibold transition hover:brightness-105 active:scale-[.98]'
  const row = 'flex min-h-14 w-full items-center gap-3 rounded-2xl bg-surface-2 px-4 text-left font-semibold transition hover:brightness-105 active:scale-[.98]'

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

      <BottomSheet open={sheet === 'apps'} onClose={close} title="Pay with which app?">
        <p className="mb-3 text-muted">
          <span className="num font-semibold text-ink">{amount}</span> to {name} · {upiId}
        </p>
        <ul className="flex flex-col gap-2">
          {UPI_APPS.map((app) => (
            <li key={app.id}>
              <a href={upiPayLink({ ...payment, app })} className={row}
                onClick={() => {
                  // Started inside the tap (not awaited) so iOS allows it before the app opens.
                  navigator.clipboard?.writeText(upiAmount(amountCents)).catch(() => {})
                  close(); onOpened()
                }}>
                <Icon name="wallet" size={20} />
                <span className="flex-1">
                  {app.name}
                  <span className="block text-sm font-normal text-muted">
                    Type or paste <span className="num">{amount}</span> (we copy it)
                  </span>
                </span>
                <Icon name="chevron" size={18} />
              </a>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setSheet('qr')} className={row}>
              <Icon name="qr" size={20} />
              <span className="flex-1">Any other app <span className="block text-sm font-normal text-muted">Scan a QR code</span></span>
              <Icon name="chevron" size={18} />
            </button>
          </li>
        </ul>
        <p className="mt-3 text-sm text-muted">
          The app opens with {name} filled in. Enter the amount yourself: apps block payments where another app fills it in. If it still fails, use the QR code.
        </p>
      </BottomSheet>

      <BottomSheet open={sheet === 'qr'} onClose={close} title="Scan to pay">
        <div className="flex flex-col items-center gap-4">
          {/* Always dark-on-white: scanners struggle with inverted codes in dark mode. The
              margin is drawn into the canvas so a saved image keeps its quiet zone. */}
          <div className="overflow-hidden rounded-2xl bg-white">
            <QRCodeCanvas ref={qr} value={upiQrText(payment)} size={240} marginSize={3} level="M" bgColor="#ffffff" fgColor="#000000" />
          </div>
          <p className="text-center text-muted">
            <span className="num font-display text-2xl font-bold text-ink">{amount}</span><br />
            to {name} · <span className="num">{upiId}</span>
          </p>
          <ol className="flex w-full list-decimal flex-col gap-1 rounded-xl bg-surface-2 py-3 pr-4 pl-9 text-sm">
            <li><b>Save QR</b> to your photos (on iPhone, tap "Save Image").</li>
            <li>Open your UPI app and tap the <b>scanner</b>.</li>
            <li>Tap the <b>gallery</b> icon and pick the QR. The amount fills in by itself.</li>
          </ol>
          <p className="-mt-2 self-start text-sm text-muted">Paying from another phone? Just scan this screen.</p>
          {saveError && <p role="alert" className="w-full rounded-xl bg-owes-bg px-4 py-3 text-sm text-owes">Couldn't save it. Take a screenshot instead.</p>}
          <Button variant="ghost" className="w-full" onClick={saveQr}>Save QR</Button>
          <Button className="w-full" onClick={() => { close(); onOpened() }}>I've paid</Button>
        </div>
      </BottomSheet>
    </div>
  )
}
