export type CurrencyCode = 'USD' | 'THB' | 'VND' | 'CNY'

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  THB: '฿',
  VND: '₫',
  CNY: '¥',
}

const DEFAULT_RATES: Record<CurrencyCode, number> = {
  USD: 21800,
  THB: 620,
  VND: 1,
  CNY: 3000,
}

function getRates(): Record<CurrencyCode, number> {
  try {
    const raw = localStorage.getItem('pos_exchange_rates')
    if (raw) return { ...DEFAULT_RATES, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return DEFAULT_RATES
}

export function getDisplayCurrencies(): CurrencyCode[] {
  try {
    const raw = localStorage.getItem('pos_display_currencies')
    if (raw) {
      const parsed = JSON.parse(raw) as CurrencyCode[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* ignore */ }
  return ['USD', 'THB']
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

export function saveExchangeRates(rates: Partial<Record<CurrencyCode, number>>) {
  try { localStorage.setItem('pos_exchange_rates', JSON.stringify({ ...getRates(), ...rates })) } catch { /* ignore */ }
}

export function saveDisplayCurrencies(codes: CurrencyCode[]) {
  try { localStorage.setItem('pos_display_currencies', JSON.stringify(codes)) } catch { /* ignore */ }
}
