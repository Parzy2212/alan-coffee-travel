'use client'

import { useState, useEffect } from 'react'
import { type CurrencyCode, saveExchangeRates, saveDisplayCurrencies } from '@/lib/currency'

const GOLD = '#c9a84c'
const GREEN = '#4cba7f'

const CURRENCIES: { code: CurrencyCode; name: string; symbol: string }[] = [
  { code: 'USD', name: 'US Dollar',    symbol: '$'  },
  { code: 'THB', name: 'Thai Baht',    symbol: '฿'  },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥'  },
]

const DEFAULT_RATES: Record<CurrencyCode, number> = {
  USD: 21800,
  THB: 620,
  VND: 1,
  CNY: 3000,
}

export function CurrencyClient() {
  const [rates,    setRates]    = useState<Record<CurrencyCode, number>>(DEFAULT_RATES)
  const [display,  setDisplay]  = useState<CurrencyCode[]>(['USD', 'THB'])
  const [saved,    setSaved]    = useState(false)

  useEffect(() => {
    try {
      const r = localStorage.getItem('pos_exchange_rates')
      if (r) setRates({ ...DEFAULT_RATES, ...JSON.parse(r) })
      const d = localStorage.getItem('pos_display_currencies')
      if (d) setDisplay(JSON.parse(d))
    } catch { /* ignore */ }
  }, [])

  function toggleDisplay(code: CurrencyCode) {
    setDisplay(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  function save() {
    saveExchangeRates(rates)
    saveDisplayCurrencies(display)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#fff', fontFamily: 'var(--font-body, Inter, sans-serif)' }}>
      <header style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', gap: 16 }}>
        <a href="/shop/settings" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: 13 }}>← Settings</a>
        <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>Currency Display</span>
      </header>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 12 }}>Exchange Rates (LAK per 1 unit)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CURRENCIES.map(c => (
              <div key={c.code} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', backgroundColor: '#161616', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{c.symbol} {c.code}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{c.name}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    value={rates[c.code]}
                    onChange={e => setRates(prev => ({ ...prev, [c.code]: parseInt(e.target.value, 10) || 0 }))}
                    style={{
                      width: 100, padding: '6px 10px', borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.15)', backgroundColor: '#0a0a0a',
                      color: '#fff', fontSize: 14, fontWeight: 600, textAlign: 'right', outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>LAK</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 12 }}>Show in POS (secondary display)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            {CURRENCIES.map(c => (
              <button key={c.code} onClick={() => toggleDisplay(c.code)} style={{
                padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${display.includes(c.code) ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`,
                backgroundColor: display.includes(c.code) ? `${GOLD}14` : 'transparent',
                color: display.includes(c.code) ? GOLD : 'rgba(255,255,255,0.4)',
                fontSize: 13, fontWeight: 600,
              }}>
                {c.symbol} {c.code}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>Appears below cart total in POS as a reference (e.g., $12.50  ·  ฿450)</div>
        </div>

        <button onClick={save} style={{
          padding: '14px 0', borderRadius: 10, border: 'none',
          backgroundColor: saved ? GREEN : GOLD,
          color: '#000', fontWeight: 800, fontSize: 14, cursor: 'pointer', transition: 'background 0.2s',
        }}>
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
