const formatters = new Map<string, Intl.NumberFormat>()

/** ₹1,200 for whole amounts, ₹1,875.50 otherwise. */
export function formatMoney(cents: number, currency = 'INR', opts: { sign?: boolean } = {}) {
  const digits = cents % 100 === 0 ? 0 : 2
  const key = `${currency}:${digits}`
  if (!formatters.has(key)) {
    formatters.set(key, new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }))
  }
  const text = formatters.get(key)!.format(Math.abs(cents) / 100)
  if (opts.sign && cents !== 0) return (cents > 0 ? '+' : '−') + text
  return text
}

export function currencySymbol(currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency
}

/** '1,250.5' -> 125050, or null if not a valid amount. Mirrors the server's rules. */
export function parseCents(input: string): number | null {
  const clean = input.replace(/,/g, '').trim()
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null
  const [whole, frac = ''] = clean.split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'))
}

/** Same rule as the server: ids sorted, first ones get the extra paise. */
export function equalSplit(total: number, ids: number[]): Map<number, number> {
  const sorted = [...new Set(ids)].sort((a, b) => a - b)
  const out = new Map<number, number>()
  if (!sorted.length) return out
  const base = Math.floor(total / sorted.length)
  const extra = total % sorted.length
  sorted.forEach((id, i) => out.set(id, base + (i < extra ? 1 : 0)))
  return out
}
