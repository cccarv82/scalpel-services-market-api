// Anti-RMT keyword filter. Service-for-currency is allowed; real-money trade is not.
// Matched against title + description (lowercased). Hits → 400 + reason.

const BLOCKED = [
  'paypal',
  'pay pal',
  'venmo',
  'zelle',
  'cashapp',
  'cash app',
  'usd',
  'us dollar',
  'eur',
  'euro ',
  'brl',
  'reais',
  'real money',
  'irl money',
  'real-money',
  ' rmt',
  'rmt ',
  '$',
  '€',
  '£',
  'r$',
  'bitcoin',
  'btc ',
  ' btc',
  'eth ',
  ' eth',
  'crypto',
  'gift card',
  'giftcard',
  'amazon card',
  'steam card',
  'wire transfer',
  'pix ',
  ' pix',
]

export interface ScanResult {
  ok: boolean
  match?: string
}

export function scanForRmt(input: string): ScanResult {
  const hay = ` ${input.toLowerCase().replace(/\s+/g, ' ')} `
  for (const term of BLOCKED) {
    if (hay.includes(term)) return { ok: false, match: term.trim() }
  }
  return { ok: true }
}

export function scanFields(...fields: string[]): ScanResult {
  for (const f of fields) {
    const r = scanForRmt(f)
    if (!r.ok) return r
  }
  return { ok: true }
}
