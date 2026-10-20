/**
 * A `upi://pay` link that opens GPay, PhonePe, Paytm or any UPI app with the
 * payee, amount and note filled in. Money goes straight to the payee's bank;
 * the app gets no confirmation back, so the payer marks it paid afterwards.
 */
export function upiPayLink({ upiId, name, amountCents, note }: { upiId: string; name: string; amountCents: number; note: string }) {
  // Built by hand: URLSearchParams turns spaces into '+', which some UPI apps show as-is.
  const params: Record<string, string> = {
    pa: upiId,
    pn: name,
    am: (amountCents / 100).toFixed(2),
    cu: 'INR',
    tn: note.slice(0, 50),
  }
  return 'upi://pay?' + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
}
