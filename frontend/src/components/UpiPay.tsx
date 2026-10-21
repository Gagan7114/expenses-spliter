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
  if (!upiId) return <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-muted">{name} hasn't added a UPI ID yet. Ask them to add it in their profile.</p>

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

  const chip = 'flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[13px] font-semibold text-muted transition hover:border-line-strong hover:text-ink active:scale-[.98]'
  const row = 'flex min-h-16 w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 text-left font-semibold transition hover:border-line-strong hover:bg-surface-2 active:scale-[.99]'
  const appMark = 'grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink'

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => setSheet('apps')}
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-semibold text-on-primary transition hover:opacity-90 active:scale-[.98]">
        <Icon name="wallet" size={19} /> Pay <span className="num">{amount}</span> with UPI
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
        <div className="mb-4 flex items-baseline justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
          <span className="min-w-0 truncate text-sm text-muted">to <b className="text-ink">{name}</b> · <span className="num">{upiId}</span></span>
          <span className="num shrink-0 text-xl font-bold">{amount}</span>
        </div>
        <ul className="flex flex-col gap-2">
          {UPI_APPS.map((app) => (
            <li key={app.id}>
              <a href={upiPayLink({ ...payment, app })} className={row}
                onClick={() => {
                  // Started inside the tap (not awaited) so iOS allows it before the app opens.
                  navigator.clipboard?.writeText(upiAmount(amountCents)).catch(() => {})
                  close(); onOpened()
                }}>
                <span className={appMark}><Icon name="wallet" size={19} /></span>
                <span className="flex-1">
                  {app.name}
                  <span className="block text-[13px] font-normal text-muted">
                    Type or paste <span className="num">{amount}</span> (we copy it)
                  </span>
                </span>
                <span className="text-faint"><Icon name="chevron" size={18} /></span>
              </a>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setSheet('qr')} className={row}>
              <span className={appMark}><Icon name="qr" size={19} /></span>
              <span className="flex-1">Any other app <span className="block text-[13px] font-normal text-muted">Scan a QR code</span></span>
              <span className="text-faint"><Icon name="chevron" size={18} /></span>
            </button>
          </li>
        </ul>
        <p className="mt-4 text-[13px] leading-relaxed text-muted">
          The app opens with {name} filled in. Enter the amount yourself: apps block payments where another app fills it in. If it still fails, use the QR code.
        </p>
      </BottomSheet>

      <BottomSheet open={sheet === 'qr'} onClose={close} title="Scan to pay">
        <div className="flex flex-col items-center gap-4">
          {/* Always dark-on-white: scanners struggle with inverted codes in dark mode. The
              margin is drawn into the canvas so a saved image keeps its quiet zone. */}
          <div className="overflow-hidden rounded-2xl border border-line bg-white p-1">
            <QRCodeCanvas ref={qr} value={upiQrText(payment)} size={240} marginSize={3} level="M" bgColor="#ffffff" fgColor="#000000" />
          </div>
          <p className="text-center text-muted">
            <span className="num text-3xl font-bold tracking-tight text-ink">{amount}</span><br />
            to {name} · <span className="num">{upiId}</span>
          </p>
          <ol className="flex w-full list-decimal flex-col gap-1.5 rounded-2xl bg-surface-2 py-3.5 pr-4 pl-9 text-sm leading-snug marker:font-semibold marker:text-muted">
            <li><b>Save QR</b> to your photos (on iPhone, tap "Save Image").</li>
            <li>Open your UPI app and tap the <b>scanner</b>.</li>
            <li>Tap the <b>gallery</b> icon and pick the QR. The amount fills in by itself.</li>
          </ol>
          <p className="-mt-1 self-start text-[13px] text-muted">Paying from another phone? Just scan this screen.</p>
          {saveError && <p role="alert" className="w-full rounded-xl bg-owes-bg px-4 py-3 text-sm text-owes">Couldn't save it. Take a screenshot instead.</p>}
          <div className="grid w-full grid-cols-2 gap-2">
            <Button variant="ghost" onClick={saveQr}>Save QR</Button>
            <Button onClick={() => { close(); onOpened() }}>I've paid</Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
