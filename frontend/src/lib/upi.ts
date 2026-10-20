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
 * A link that opens a UPI app with the payee and note filled in, but not the
 * amount: Google Pay flags links that pre-fill an amount for a personal UPI ID
 * as fraud and declines them. The payer pastes the amount (we copy it first).
 * Money goes straight to the payee's bank; the app gets no confirmation back,
 * so the payer marks it paid afterwards.
 */
export function upiPayLink({ app, upiId, name, note }: UpiPayment & { app: UpiApp }) {
  return app.prefix + '?' + upiQuery({ upiId, name, note })
}

/** What a UPI QR code holds, amount included. Scans count as started by the
 * payer, so apps don't block them the way they block links. */
export function upiQrText(payment: UpiPayment) {
  return 'upi://pay?' + upiQuery(payment)
}

/** '500' or '1250.50', for pasting into a UPI app's amount box. */
export const upiAmount = (amountCents: number) =>
  amountCents % 100 === 0 ? String(amountCents / 100) : (amountCents / 100).toFixed(2)

type UpiPayment = { upiId: string; name: string; amountCents: number; note: string }

function upiQuery({ upiId, name, amountCents, note }: Omit<UpiPayment, 'amountCents'> & { amountCents?: number }) {
  // Built by hand: URLSearchParams turns spaces into '+', which some UPI apps show as-is.
  const params: Record<string, string> = { pa: upiId, pn: name }
  if (amountCents !== undefined) params.am = (amountCents / 100).toFixed(2)
  params.cu = 'INR'
  params.tn = note.slice(0, 50)
  return Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
}
