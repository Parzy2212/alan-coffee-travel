'use client'

import { useEffect, useRef, useState } from 'react'
import { IBM_Plex_Sans_Thai } from 'next/font/google'
import { SaveButton } from './ShopIdentitySection'
import {
  GOLD, BG_CARD, BG_CARD_ALT, BORDER_SUBTLE, BORDER_DEFAULT,
  STATE_SELECTED_BG, STATE_SELECTED_BORDER,
  TEXT_1, TEXT_2, DANGER, FONT_MONO, RADIUS,
} from '@/lib/pos-theme-tokens'

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

const CARD: React.CSSProperties = { backgroundColor: BG_CARD, border: `1px solid ${BORDER_SUBTLE}`, borderRadius: RADIUS['2xl'], padding: 24, marginBottom: 24 }
const LABEL: React.CSSProperties = { color: TEXT_2, fontSize: 12, fontWeight: 600, letterSpacing: '0.4px', display: 'block', marginBottom: 6 }
const INP: React.CSSProperties = { width: '100%', backgroundColor: BG_CARD_ALT, border: `1px solid ${BORDER_DEFAULT}`, borderRadius: RADIUS.md, padding: '12px 14px', color: TEXT_1, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s' }

const RECEIPT_KEYS = ['shop_name', 'shop_name_th', 'shop_address', 'shop_phone', 'receipt_footer', 'vat_percent', 'service_charge_percent', 'receipt_auto_print'] as const
type ReceiptKey = typeof RECEIPT_KEYS[number]
type ReceiptSettings = Record<ReceiptKey, string>

const DEFAULTS: ReceiptSettings = {
  shop_name: '', shop_name_th: '', shop_address: '',
  shop_phone: '', receipt_footer: '',
  vat_percent: '0', service_charge_percent: '0', receipt_auto_print: 'false',
}

export function ReceiptSection() {
  const [settings, setSettings] = useState<ReceiptSettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    import('@/lib/supabase-auth').then(({ authClient }) => {
      authClient.rpc('get_site_settings').then(({ data }) => {
        if (data) {
          const d = data as Record<string, string>
          setSettings(s => ({
            ...s,
            ...Object.fromEntries(RECEIPT_KEYS.filter(k => d[k] != null).map(k => [k, d[k]])),
          }))
        }
        setLoading(false)
      })
    })
  }, [])

  const set = (k: ReceiptKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setSettings(s => ({ ...s, [k]: e.target.value }))

  const handleSave = async () => {
    setSaving(true); setError('')
    if (timer.current) clearTimeout(timer.current)
    try {
      const { authClient } = await import('@/lib/supabase-auth')
      const { logAccountEvent } = await import('@/lib/account-events')
      await Promise.all(
        RECEIPT_KEYS.map(k => authClient.rpc('update_site_setting', { p_key: k, p_value: settings[k] }))
      )
      await logAccountEvent('shop_settings_updated' as never, 'Receipt settings updated')
      setSaved(true)
      timer.current = setTimeout(() => setSaved(false), 2500)
    } catch (e) { setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด') }
    finally { setSaving(false) }
  }

  if (loading) {
    return (
      <div style={CARD}>
        <div style={{ height: 260, borderRadius: RADIUS.md, backgroundColor: BG_CARD_ALT }} />
      </div>
    )
  }

  return (
    <div className={ibmPlexSansThai.className}>
      {/* Shop header on receipt */}
      <div style={CARD}>
        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_2, marginBottom: 20 }}>หัวใบเสร็จ</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL}>ชื่อร้าน (EN)</label>
              <input type="text" value={settings.shop_name} onChange={set('shop_name')} placeholder="ALAN COFFEE" style={INP} />
            </div>
            <div>
              <label style={LABEL}>ชื่อร้าน (TH)</label>
              <input type="text" value={settings.shop_name_th} onChange={set('shop_name_th')} placeholder="อลัน คอฟฟี่" style={INP} />
            </div>
          </div>
          <div>
            <label style={LABEL}>ที่อยู่</label>
            <textarea value={settings.shop_address} onChange={set('shop_address')} rows={2} placeholder="123 ถนน... เวียงจันทน์" style={{ ...INP, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div>
            <label style={LABEL}>เบอร์โทรศัพท์</label>
            <input type="text" value={settings.shop_phone} onChange={set('shop_phone')} placeholder="020-xxx-xxxx" style={{ ...INP, fontFamily: FONT_MONO }} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={CARD}>
        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_2, marginBottom: 20 }}>ท้ายใบเสร็จ</div>
        <div>
          <label style={LABEL}>ข้อความท้ายใบเสร็จ <span style={{ color: TEXT_2, fontWeight: 400 }}>(ไม่บังคับ)</span></label>
          <textarea value={settings.receipt_footer} onChange={set('receipt_footer')} rows={2} placeholder="ขอบคุณที่ใช้บริการ / Thank you!" style={{ ...INP, resize: 'vertical', lineHeight: 1.6 }} />
          <div style={{ color: TEXT_2, fontSize: 12, marginTop: 4 }}>แสดงที่ด้านล่างสุดของใบเสร็จ</div>
        </div>
      </div>

      {/* Tax & print */}
      <div style={CARD}>
        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_2, marginBottom: 20 }}>ภาษีและการพิมพ์</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL}>VAT (%)</label>
              <input type="number" min="0" max="30" value={settings.vat_percent} onChange={set('vat_percent')} placeholder="0" style={{ ...INP, fontFamily: FONT_MONO }} />
            </div>
            <div>
              <label style={LABEL}>Service Charge (%)</label>
              <input type="number" min="0" max="30" value={settings.service_charge_percent} onChange={set('service_charge_percent')} placeholder="0" style={{ ...INP, fontFamily: FONT_MONO }} />
            </div>
          </div>

          {/* Auto-print toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: settings.receipt_auto_print === 'true' ? STATE_SELECTED_BG : 'transparent', border: `1px solid ${settings.receipt_auto_print === 'true' ? STATE_SELECTED_BORDER : BORDER_SUBTLE}`, borderRadius: RADIUS.lg }}>
            <div>
              <div style={{ color: TEXT_1, fontSize: 14, fontWeight: 600, marginBottom: 2 }}>พิมพ์ใบเสร็จอัตโนมัติ</div>
              <div style={{ color: TEXT_2, fontSize: 12 }}>พิมพ์ทันทีเมื่อชำระเงินเสร็จ</div>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, receipt_auto_print: s.receipt_auto_print === 'true' ? 'false' : 'true' }))}
              style={{ width: 44, height: 24, borderRadius: RADIUS.pill, backgroundColor: settings.receipt_auto_print === 'true' ? GOLD : BORDER_DEFAULT, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background-color 0.15s', flexShrink: 0 }}
            >
              <div style={{ position: 'absolute', top: 3, left: settings.receipt_auto_print === 'true' ? 23 : 3, width: 18, height: 18, borderRadius: '50%', backgroundColor: TEXT_1, transition: 'left 0.15s' }} />
            </button>
          </div>
        </div>
      </div>

      {error && <div style={{ backgroundColor: `${DANGER}14`, border: `1px solid ${DANGER}33`, borderRadius: RADIUS.md, padding: '10px 14px', color: DANGER, fontSize: 13, marginBottom: 16 }}>{error}</div>}
      <SaveButton saving={saving} saved={saved} onClick={handleSave} />
    </div>
  )
}
