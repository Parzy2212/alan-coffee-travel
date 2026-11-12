export type CurrencyCode = 'USD' | 'THB' | 'VND' | 'CNY'

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  THB: '฿',
  VND: '₫',
  CNY: '¥',
}

// LAK per 1 unit. Starting values only: the shop sets the real rates in ตั้งค่าร้าน.
export const DEFAULT_RATES: Record<CurrencyCode, number> = {
  USD: 21800,
  THB: 620,
  VND: 0.85,
  CNY: 3000,
}

/** Parses a saved rates JSON; bad or non-positive entries fall back to the defaults. */
export function parseRates(raw: string | null | undefined): Record<CurrencyCode, number> {
  const out = { ...DEFAULT_RATES }
  try {
    const p = JSON.parse(raw || '{}') as Record<string, unknown>
    for (const c of Object.keys(out) as CurrencyCode[]) {
      const n = Number(p[c])
      if (Number.isFinite(n) && n > 0) out[c] = n
    }
  } catch { /* defaults */ }
  return out
}

export function parseDisplayCurrencies(raw: string | null | undefined): CurrencyCode[] {
  try {
    const p = JSON.parse(raw || '') as unknown
    if (Array.isArray(p)) return p.filter((c): c is CurrencyCode => typeof c === 'string' && Object.hasOwn(DEFAULT_RATES, c))
  } catch { /* default */ }
  return ['USD', 'THB']
}

function getRates(): Record<CurrencyCode, number> {
  try { return parseRates(localStorage.getItem('pos_exchange_rates')) } catch { return DEFAULT_RATES }
}

export function getDisplayCurrencies(): CurrencyCode[] {
  try { return parseDisplayCurrencies(localStorage.getItem('pos_display_currencies')) } catch { return ['USD', 'THB'] }
}

export function convertFromLAK(lak: number, currency: CurrencyCode): number {
  const rates = getRates()
  return lak / rates[currency]
}

export function formatSecondary(lak: number, currencies?: CurrencyCode[]): string {
  const codes = currencies ?? getDisplayCurrencies()
  return codes.map(code => {
    const amount = convertFromLAK(lak, code)
    const sym = CURRENCY_SYMBOLS[code]
    if (code === 'VND') return `${sym}${Math.round(amount).toLocaleString('en-US')}`
    if (amount < 10) return `${sym}${amount.toFixed(2)}`
    return `${sym}${amount.toFixed(0)}`
  }).join('  ·  ')
}
