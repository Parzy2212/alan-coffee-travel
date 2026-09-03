'use client'

import { useEffect, useRef, useState } from 'react'
import { IBM_Plex_Sans_Thai } from 'next/font/google'
import { useShop } from '@/lib/use-shop'
import { logAccountEvent } from '@/lib/account-events'
import { SaveButton } from './ShopIdentitySection'
import {
  GOLD, BG_CARD, BG_CARD_ALT, BORDER_SUBTLE, BORDER_DEFAULT,
  STATE_SELECTED_BG, STATE_SELECTED_BORDER, STATE_FOCUS_RING,
  TEXT_1, TEXT_2, DANGER, FONT_MONO, RADIUS,
} from '@/lib/pos-theme-tokens'

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

const CARD: React.CSSProperties = { backgroundColor: BG_CARD, border: `1px solid ${BORDER_SUBTLE}`, borderRadius: RADIUS['2xl'], padding: 24, marginBottom: 24 }
const INP: React.CSSProperties = { width: '100%', backgroundColor: BG_CARD_ALT, border: `1px solid ${BORDER_DEFAULT}`, borderRadius: RADIUS.md, padding: '11px 14px', color: TEXT_1, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

interface Methods { cash: boolean; qr: boolean; card: boolean; transfer: boolean }

const METHODS: { key: keyof Methods; icon: string; label: string; sub: string }[] = [
  { key: 'cash',     icon: '💵', label: 'เงินสด',             sub: 'ชำระด้วยเงินสดที่เคาน์เตอร์'      },
  { key: 'qr',       icon: '📱', label: 'QR Code / PromptPay', sub: 'ลูกค้าสแกน QR ชำระเงิน'          },
  { key: 'card',     icon: '💳', label: 'บัตรเครดิต / เดบิต',  sub: 'ชำระผ่านเครื่องรูดบัตร'           },
  { key: 'transfer', icon: '🏦', label: 'โอนผ่านธนาคาร',       sub: 'โอนเข้าบัญชีธนาคาร'               },
]

const DEFAULT_METHODS: Methods = { cash: true, qr: false, card: false, transfer: false }

export function PaymentMethodsSection() {
  const { shop, shopId, loading } = useShop()
  const [methods, setMethods] = useState<Methods>(DEFAULT_METHODS)
  const [qrNumber, setQrNumber] = useState('')
  const [qrName, setQrName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!shop) return
    if (shop.payment_methods) setMethods({ ...DEFAULT_METHODS, ...shop.payment_methods })
  }, [shop])

  const toggle = (key: keyof Methods) =>
    setMethods(m => ({ ...m, [key]: !m[key] }))

  const handleSave = async () => {
    if (!shopId) return
    setSaving(true); setError('')
    if (timer.current) clearTimeout(timer.current)
    try {
      const { authClient } = await import('@/lib/supabase-auth')
      const { error: err } = await authClient.from('shops').update({ payment_methods: methods }).eq('id', shopId)
      if (err) throw err
      await logAccountEvent('shop_settings_updated' as never, 'Payment methods updated')
      setSaved(true)
      timer.current = setTimeout(() => setSaved(false), 2500)
    } catch (e) { setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด') }
    finally { setSaving(false) }
  }

  return (
    <div className={ibmPlexSansThai.className} style={CARD}>
      <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_2, marginBottom: 20 }}>วิธีชำระเงินที่รับ</div>
      {loading ? (
        <div style={{ height: 180, borderRadius: RADIUS.md, backgroundColor: BG_CARD_ALT }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {METHODS.map(m => {
            const on = methods[m.key]
            return (
              <div key={m.key}>
                <button
                  onClick={() => toggle(m.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '14px 16px', backgroundColor: on ? STATE_SELECTED_BG : 'transparent', border: `1px solid ${on ? STATE_SELECTED_BORDER : BORDER_SUBTLE}`, borderRadius: RADIUS.lg, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.15s' }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{m.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: TEXT_1, fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{m.label}</div>
                    <div style={{ color: TEXT_2, fontSize: 12 }}>{m.sub}</div>
                  </div>
                  {/* Toggle */}
                  <div style={{ width: 44, height: 24, borderRadius: RADIUS.pill, backgroundColor: on ? GOLD : BORDER_DEFAULT, position: 'relative', flexShrink: 0, transition: 'background-color 0.15s' }}>
                    <div style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: '50%', backgroundColor: TEXT_1, transition: 'left 0.15s' }} />
                  </div>
                </button>

                {/* QR sub-fields */}
                {m.key === 'qr' && on && (
                  <div className="payment-methods-card" style={{ marginTop: 8, padding: '14px 16px', backgroundColor: BG_CARD_ALT, border: `1px solid ${BORDER_SUBTLE}`, borderRadius: RADIUS.lg, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ color: TEXT_2, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 5 }}>หมายเลข / เบอร์ PromptPay</label>
                      <input type="text" value={qrNumber} onChange={e => setQrNumber(e.target.value)} placeholder="0812345678" style={{ ...INP, fontFamily: FONT_MONO }} />
                    </div>
                    <div>
                      <label style={{ color: TEXT_2, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 5 }}>ชื่อบัญชี</label>
                      <input type="text" value={qrName} onChange={e => setQrName(e.target.value)} placeholder="ALAN COFFEE" style={INP} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {error && <div style={{ backgroundColor: `${DANGER}14`, border: `1px solid ${DANGER}33`, borderRadius: RADIUS.md, padding: '10px 14px', color: DANGER, fontSize: 13 }}>{error}</div>}
          <SaveButton saving={saving} saved={saved} onClick={handleSave} />
        </div>
      )}
      <style>{`
        .payment-methods-card input:focus {
          outline: ${STATE_FOCUS_RING};
          outline-offset: 2px;
          border-color: ${GOLD} !important;
        }
      `}</style>
    </div>
  )
}
