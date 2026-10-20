const isIOS = typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

/**
 * Apps we open directly. There's deliberately no plain `upi://` option: it goes
 * to whichever app claimed it (often WhatsApp) with no choice, since Android uses
 * the default app and iOS has no chooser at all. Anyone else can copy the UPI ID.
 */
export const UPI_APPS = [
  // Google Pay registers `gpay://` on iOS and the older `tez://` on Android.
  { id: 'gpay', name: 'Google Pay', prefix: isIOS ? 'gpay://upi/pay' : 'tez://upi/pay' },
  { id: 'phonepe', name: 'PhonePe', prefix: 'phonepe://pay' },
  { id: 'paytm', name: 'Paytm', prefix: 'paytmmp://pay' },
] as const

export type UpiApp = (typeof UPI_APPS)[number]

/**
 * A link that opens a UPI app with the payee, amount and note filled in.
 * Money goes straight to the payee's bank; the app gets no confirmation back,
 * so the payer marks it paid afterwards.
 */
export function upiPayLink({ app, ...payment }: UpiPayment & { app: UpiApp }) {
  return app.prefix + '?' + upiQuery(payment)
}

/** What a UPI QR code holds. Any UPI app's scanner reads it, and scans aren't
 * blocked the way links to personal UPI IDs often are. */
export function upiQrText(payment: UpiPayment) {
  return 'upi://pay?' + upiQuery(payment)
}

/** '1250.50', for pasting into a UPI app's amount box. */
export const upiAmount = (amountCents: number) => (amountCents / 100).toFixed(2)

type UpiPayment = { upiId: string; name: string; amountCents: number; note: string }

function upiQuery({ upiId, name, amountCents, note }: UpiPayment) {
  // Built by hand: URLSearchParams turns spaces into '+', which some UPI apps show as-is.
  const params: Record<string, string> = {
    pa: upiId,
    pn: name,
    am: upiAmount(amountCents),
    cu: 'INR',
    tn: note.slice(0, 50),
  }
  return Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
}
