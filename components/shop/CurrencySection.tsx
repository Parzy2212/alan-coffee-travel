'use client'

import { useState, useEffect } from 'react'
import { IBM_Plex_Sans_Thai } from 'next/font/google'
import { type CurrencyCode, saveExchangeRates, saveDisplayCurrencies } from '@/lib/currency'
import {
  GOLD, SUCCESS, BG_VOID, BG_CARD, BORDER_SUBTLE, BORDER_DEFAULT,
  STATE_SELECTED_BG, STATE_SELECTED_BORDER, STATE_FOCUS_RING,
  TEXT_1, TEXT_2, FONT_MONO, RADIUS,
} from '@/lib/pos-theme-tokens'

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

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

export function CurrencySection() {
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
    <div className={`${ibmPlexSansThai.className} currency-section`} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ fontSize: 11, color: TEXT_2, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 12 }}>Exchange Rates (LAK per 1 unit)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {CURRENCIES.map(c => (
            <div key={c.code} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', backgroundColor: BG_CARD, borderRadius: RADIUS.xl, border: `1px solid ${BORDER_SUBTLE}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_1 }}>{c.symbol} {c.code}</div>
                <div style={{ fontSize: 11, color: TEXT_2 }}>{c.name}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  value={rates[c.code]}
                  onChange={e => setRates(prev => ({ ...prev, [c.code]: parseInt(e.target.value, 10) || 0 }))}
                  style={{
                    width: 100, padding: '6px 10px', borderRadius: RADIUS.md,
                    border: `1px solid ${BORDER_DEFAULT}`, backgroundColor: BG_VOID,
                    color: TEXT_1, fontSize: 14, fontWeight: 600, fontFamily: FONT_MONO, textAlign: 'right', outline: 'none',
                  }}
                />
                <span style={{ fontSize: 12, color: TEXT_2 }}>LAK</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, color: TEXT_2, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 12 }}>Show in POS (secondary display)</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          {CURRENCIES.map(c => (
            <button key={c.code} onClick={() => toggleDisplay(c.code)} style={{
              padding: '8px 18px', borderRadius: RADIUS.md, cursor: 'pointer',
              border: `1px solid ${display.includes(c.code) ? STATE_SELECTED_BORDER : BORDER_DEFAULT}`,
              backgroundColor: display.includes(c.code) ? STATE_SELECTED_BG : 'transparent',
              color: display.includes(c.code) ? GOLD : TEXT_2,
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            }}>
              {c.symbol} {c.code}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: TEXT_2, marginTop: 8 }}>Appears below cart total in POS as a reference (e.g., $12.50  ·  ฿450)</div>
      </div>

      <button onClick={save} className="currency-save-btn" style={{
        padding: '14px 0', borderRadius: RADIUS.lg,
        border: `1px solid ${saved ? SUCCESS : GOLD}`,
        backgroundColor: saved ? `${SUCCESS}14` : 'transparent',
        color: saved ? SUCCESS : GOLD, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
      }}>
        {saved ? '✓ Saved' : 'Save Settings'}
      </button>
      <style>{`
        .currency-section input:focus-visible,
        .currency-section .currency-save-btn:focus-visible {
          outline: ${STATE_FOCUS_RING};
          outline-offset: 2px;
        }
      `}</style>
    </div>
  )
}
