'use client'

import { useEffect, useRef, useState } from 'react'
import { IBM_Plex_Sans_Thai } from 'next/font/google'
import { useShop } from '@/lib/use-shop'
import { getInitials } from '@/lib/avatar'
import { logAccountEvent } from '@/lib/account-events'
import {
  GOLD, SUCCESS, BG_CARD, BG_CARD_ALT, BORDER_SUBTLE, BORDER_DEFAULT, BORDER_GOLD,
  TEXT_1, TEXT_2, DANGER, RADIUS, STATE_DISABLED_OPACITY, STATE_FOCUS_RING,
} from '@/lib/pos-theme-tokens'

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

const CARD: React.CSSProperties = { backgroundColor: BG_CARD, border: `1px solid ${BORDER_SUBTLE}`, borderRadius: RADIUS['2xl'], padding: 24, marginBottom: 24 }
const LABEL: React.CSSProperties = { color: TEXT_2, fontSize: 12, fontWeight: 600, letterSpacing: '0.4px', display: 'block', marginBottom: 6 }
const INP: React.CSSProperties = { width: '100%', backgroundColor: BG_CARD_ALT, border: `1px solid ${BORDER_DEFAULT}`, borderRadius: RADIUS.md, padding: '12px 14px', color: TEXT_1, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s' }

export function ShopIdentitySection() {
  const { shop, shopId, loading } = useShop()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!shop) return
    setName(shop.name ?? '')
    setDescription(shop.description ?? '')
  }, [shop])

  const handleSave = async () => {
    if (!shopId || !name.trim()) return
    setSaving(true); setError('')
    if (timer.current) clearTimeout(timer.current)
    try {
      const { authClient } = await import('@/lib/supabase-auth')
      const { error: err } = await authClient.from('shops').update({ name: name.trim(), description: description.trim() || null }).eq('id', shopId)
      if (err) throw err
      await logAccountEvent('shop_settings_updated' as never, 'Shop name / description updated')
      setSaved(true)
      timer.current = setTimeout(() => setSaved(false), 2500)
    } catch (e) { setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด') }
    finally { setSaving(false) }
  }

  const initials = getInitials(name, '')

  return (
    <div className={ibmPlexSansThai.className} style={CARD}>
      <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_2, marginBottom: 20 }}>ข้อมูลร้านค้า</div>

      {/* Logo placeholder */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: 'rgba(201,168,76,0.12)', border: `2px solid ${BORDER_GOLD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ color: GOLD, fontSize: 26, fontWeight: 700 }}>{initials || '?'}</span>
        </div>
        <div>
          <div style={{ color: TEXT_2, fontSize: 13, marginBottom: 8 }}>อัปโหลดโลโก้ร้าน</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', backgroundColor: BG_CARD_ALT, border: `1px solid ${BORDER_SUBTLE}`, borderRadius: RADIUS.md, cursor: 'not-allowed', color: TEXT_2, fontSize: 13 }}>
            เลือกรูปภาพ
            <span style={{ fontSize: 10, color: TEXT_2, padding: '1px 5px', backgroundColor: BG_CARD, borderRadius: RADIUS.sm }}>เร็วๆ นี้</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ height: 120, borderRadius: RADIUS.md, backgroundColor: BG_CARD_ALT, animation: 'pulse 1.5s ease-in-out infinite' }}>
          <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.7}}`}</style>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={LABEL}>
              ชื่อร้าน <span style={{ color: DANGER }}>*</span>
            </label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Alan Coffee & Travel" style={INP} />
          </div>
          <div>
            <label style={LABEL}>
              คำอธิบายสั้น <span style={{ color: TEXT_2, fontWeight: 400 }}>(ไม่บังคับ)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="ร้านกาแฟบรรยากาศดี..."
              rows={3}
              style={{ ...INP, resize: 'vertical' as const, lineHeight: 1.6 }}
            />
            <div style={{ color: TEXT_2, fontSize: 12, marginTop: 4 }}>จะแสดงในใบเสร็จและหน้าแรก</div>
          </div>
          {error && <div style={{ backgroundColor: `${DANGER}14`, border: `1px solid ${DANGER}33`, borderRadius: RADIUS.md, padding: '10px 14px', color: DANGER, fontSize: 13 }}>{error}</div>}
          <SaveButton saving={saving} saved={saved} disabled={!name.trim()} onClick={handleSave} />
        </div>
      )}
    </div>
  )
}

export function SaveButton({ saving, saved, disabled, onClick }: { saving: boolean; saved: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <>
      <button
        onClick={onClick}
        disabled={saving || disabled}
        className="pos-save-btn"
        style={{
          alignSelf: 'flex-start', padding: '11px 24px',
          backgroundColor: saved ? `${SUCCESS}14` : 'transparent',
          color: saved ? SUCCESS : disabled ? TEXT_2 : GOLD,
          border: `1px solid ${saved ? SUCCESS : disabled ? BORDER_DEFAULT : GOLD}`,
          borderRadius: RADIUS.lg, fontSize: 14, fontWeight: 700,
          cursor: (saving || disabled) ? 'not-allowed' : 'pointer',
          opacity: saving ? STATE_DISABLED_OPACITY : 1,
          fontFamily: 'inherit', transition: 'all 0.2s',
        }}
      >
        {saving ? 'กำลังบันทึก...' : saved ? 'บันทึกแล้ว ✓' : 'บันทึกการเปลี่ยนแปลง'}
      </button>
      <style>{`
        .pos-save-btn:focus-visible {
          outline: ${STATE_FOCUS_RING};
          outline-offset: 2px;
        }
      `}</style>
    </>
  )
}
