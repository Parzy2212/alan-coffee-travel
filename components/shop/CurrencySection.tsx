'use client'

import { useState } from 'react'
import { IBM_Plex_Sans_Thai } from 'next/font/google'
import { type CurrencyCode } from '@/lib/currency'
import {
  GOLD, BG_VOID, BG_CARD, BORDER_SUBTLE, BORDER_DEFAULT,
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

// Controlled: the values live in ตั้งค่าร้าน and are saved with its "บันทึกทั้งหมด" button.
export function CurrencySection({ rates, display, onRates, onDisplay }: {
  rates: Record<CurrencyCode, number>
  display: CurrencyCode[]
  onRates: (r: Record<CurrencyCode, number>) => void
  onDisplay: (d: CurrencyCode[]) => void
}) {
  // What is being typed, so an empty or half-typed number ("0.") is not replaced mid-edit
  const [typing, setTyping] = useState<{ code: CurrencyCode; text: string } | null>(null)

  function toggleDisplay(code: CurrencyCode) {
    onDisplay(display.includes(code) ? display.filter(c => c !== code) : [...display, code])
  }

  return (
    <div className={`${ibmPlexSansThai.className} currency-section`} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ fontSize: 11, color: TEXT_2, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 12 }}>อัตราแลกเปลี่ยน (กี่กีบ ต่อ 1 หน่วย)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {CURRENCIES.map(c => (
            <div key={c.code} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', backgroundColor: BG_CARD, borderRadius: RADIUS.xl, border: `1px solid ${BORDER_SUBTLE}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_1 }}>{c.symbol} {c.code}</div>
                <div style={{ fontSize: 11, color: TEXT_2 }}>{c.name}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number" min="0" step="any" inputMode="decimal"
                  aria-label={`อัตรา ${c.code} เป็นกีบ`}
                  value={typing?.code === c.code ? typing.text : rates[c.code] || ''}
                  onFocus={() => setTyping({ code: c.code, text: String(rates[c.code] || '') })}
                  onBlur={() => setTyping(null)}
                  onChange={e => {
                    setTyping({ code: c.code, text: e.target.value })
                    const n = parseFloat(e.target.value)
                    if (n > 0) onRates({ ...rates, [c.code]: n })
                  }}
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
        <div style={{ fontSize: 11, color: TEXT_2, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 12 }}>แสดงในหน้าขาย</div>
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
        <div style={{ fontSize: 11, color: TEXT_2, marginTop: 8 }}>แสดงใต้ยอดรวมในหน้าขายเป็นราคาอ้างอิง (เช่น $12.50  ·  ฿450) ไม่เลือกเลย = ไม่แสดง</div>
      </div>

      <style>{`
        .currency-section input:focus-visible {
          outline: ${STATE_FOCUS_RING};
          outline-offset: 2px;
        }
      `}</style>
    </div>
  )
}
