'use client'

import { useEffect, useRef, useState } from 'react'
import { useShop } from '@/lib/use-shop'
import { logAccountEvent } from '@/lib/account-events'
import { SaveButton } from './ShopIdentitySection'

const GOLD = '#c9a84c'
const CARD: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, marginBottom: 24 }
const INP: React.CSSProperties = { width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '11px 14px', color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

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
    <div style={CARD}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 20 }}>วิธีชำระเงินที่รับ</div>
      {loading ? (
        <div style={{ height: 180, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {METHODS.map(m => {
            const on = methods[m.key]
            return (
              <div key={m.key}>
                <button
                  onClick={() => toggle(m.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '14px 16px', backgroundColor: on ? 'rgba(201,168,76,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${on ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.15s' }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{m.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{m.label}</div>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{m.sub}</div>
                  </div>
                  {/* Toggle */}
                  <div style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: on ? GOLD : 'rgba(255,255,255,0.1)', position: 'relative', flexShrink: 0, transition: 'background-color 0.15s' }}>
                    <div style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: '50%', backgroundColor: 'white', transition: 'left 0.15s' }} />
                  </div>
                </button>

                {/* QR sub-fields */}
                {m.key === 'qr' && on && (
                  <div style={{ marginTop: 8, padding: '14px 16px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 5 }}>หมายเลข / เบอร์ PromptPay</label>
                      <input type="text" value={qrNumber} onChange={e => setQrNumber(e.target.value)} placeholder="0812345678" style={INP} />
                    </div>
                    <div>
                      <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 5 }}>ชื่อบัญชี</label>
                      <input type="text" value={qrName} onChange={e => setQrName(e.target.value)} placeholder="ALAN COFFEE" style={INP} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {error && <div style={{ backgroundColor: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ff6b6b', fontSize: 13 }}>{error}</div>}
          <SaveButton saving={saving} saved={saved} onClick={handleSave} />
        </div>
      )}
    </div>
  )
}
