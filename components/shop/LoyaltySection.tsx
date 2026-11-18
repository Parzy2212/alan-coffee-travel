'use client'

import { useEffect, useState } from 'react'
import { getLoyaltySettings, saveLoyaltySettings } from '@/lib/customers'
import type { LoyaltySettings } from '@/lib/customers'
import { DEFAULT_SETTINGS } from '@/lib/loyalty'
import { useShop } from '@/lib/use-shop'
import {
  GOLD, SUCCESS, DANGER, WARNING, BG_BASE, BG_CARD_ALT, BORDER_SUBTLE, BORDER_DEFAULT,
  TEXT_1, TEXT_2, FONT_MONO, RADIUS, STATE_DISABLED_OPACITY, STATE_FOCUS_RING,
} from '@/lib/pos-theme-tokens'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: RADIUS.lg,
  border: `1px solid ${BORDER_DEFAULT}`, backgroundColor: BG_BASE,
  color: TEXT_1, fontSize: 14, fontFamily: FONT_MONO, boxSizing: 'border-box',
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${BORDER_SUBTLE}` }}>
      <div style={{ flex: 1, marginRight: 20 }}>
        <div style={{ fontSize: 14, color: TEXT_1, fontWeight: 500 }}>{label}</div>
      </div>
      <div style={{ width: 100, flexShrink: 0 }}>{children}</div>
    </div>
  )
}

const notice = (color: string): React.CSSProperties => ({
  padding: '12px 14px', borderRadius: RADIUS.lg, border: `1px solid ${color}66`,
  backgroundColor: `${color}14`, color, fontSize: 14, lineHeight: 1.6,
})

// Only the VIP % is shown (owner decision 2026-11-18). Points rate, tier thresholds, the
// on/off switch and the birthday % stay hidden until the membership system opens; saving
// sends their loaded values back unchanged.
export function LoyaltySection() {
  const { shopId, loading: shopLoading, error: shopError } = useShop()
  const [settings, setSettings] = useState<LoyaltySettings | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [err,      setErr]      = useState('')
  const [loadFailed, setLoadFailed] = useState(false)

  const s = settings ?? { shop_id: shopId ?? '', ...DEFAULT_SETTINGS }

  useEffect(() => {
    if (!shopId) return
    getLoyaltySettings(shopId).then(
      data => { setSettings(data ?? { shop_id: shopId, ...DEFAULT_SETTINGS } as LoyaltySettings); setLoading(false) },
      // saving the defaults over settings that only failed to load would wipe them: block saving
      (e: Error) => { setErr(e.message); setLoadFailed(true); setLoading(false) },
    )
  }, [shopId])

  function update(key: keyof LoyaltySettings, value: unknown) {
    setSettings(prev => ({ ...(prev ?? { shop_id: shopId ?? '', ...DEFAULT_SETTINGS } as LoyaltySettings), [key]: value }))
  }

  async function handleSave() {
    if (!shopId) return
    setSaving(true); setErr('')
    try {
      setSettings(await saveLoyaltySettings(shopId, s))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  if (shopError) return <div role="alert" style={notice(DANGER)}>{shopError}</div>

  // useShop only finds shops where this account is the owner
  if (!shopLoading && !shopId) {
    return <div role="alert" style={notice(DANGER)}>หน้านี้แก้ได้เฉพาะเจ้าของร้าน ออกจากระบบแล้วเข้าด้วยบัญชีเจ้าของร้าน</div>
  }

  if (shopLoading || loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 3 }).map((_, i) => <div key={i} style={{ height: 56, borderRadius: RADIUS.lg, backgroundColor: BG_CARD_ALT }} />)}
      </div>
    )
  }

  return (
    <div className="font-plex-thai loyalty-section" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!s.enabled && (
        <div style={notice(WARNING)}>ระบบสะสมแต้มของร้านปิดอยู่ ลูกค้า VIP จึงยังไม่ได้ส่วนลด ตั้ง % ไว้ก่อนได้ จะเริ่มใช้เมื่อเปิดระบบสะสมแต้ม (ตอนนี้ยังเปิดในแอปไม่ได้ ต้องให้ผู้ดูแลระบบเปิดให้)</div>
      )}

      <div style={{ backgroundColor: BG_CARD_ALT, border: `1px solid ${BORDER_SUBTLE}`, borderRadius: RADIUS['3xl'], padding: '16px 18px' }}>
        <div style={{ fontSize: 11, color: GOLD, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>ส่วนลด (%) ของลูกค้าแต่ละระดับ</div>
        <div style={{ fontSize: 12, color: TEXT_2, lineHeight: 1.6 }}>ลดให้อัตโนมัติตอนคิดเงินเมื่อเลือกลูกค้า แคชเชียร์ยังให้ส่วนลดเพิ่มได้อีกไม่เกิน 15% โดยไม่ต้องใช้ PIN ผู้จัดการ หน้าขายจะใช้ค่าใหม่หลังโหลดหน้าขายใหม่</div>
        {([
          ['silver_discount_percent',   '⭐ Silver'],
          ['gold_discount_percent',     '👑 Gold'],
          ['platinum_discount_percent', '💎 Platinum'],
        ] as const).map(([key, label]) => (
          <FieldRow key={key} label={label}>
            <input
              type="number" min="0" max="100" aria-label={`ส่วนลดลูกค้า ${label} (%)`}
              value={s[key]}
              onChange={e => update(key, parseInt(e.target.value, 10) || 0)}
              style={{ ...inputStyle, textAlign: 'right' }}
            />
          </FieldRow>
        ))}
      </div>

      {err && <div role="alert" style={notice(DANGER)}>{err}</div>}

      <button
        onClick={handleSave}
        disabled={saving || !shopId || loadFailed}
        className="loyalty-save-btn"
        style={{
          height: 52, borderRadius: RADIUS.xl,
          border: `1px solid ${saved ? SUCCESS : GOLD}`,
          backgroundColor: saved ? `${SUCCESS}14` : 'transparent',
          color: saved ? SUCCESS : GOLD, fontSize: 15, fontWeight: 800,
          cursor: saving ? 'wait' : 'pointer',
          opacity: saving || loadFailed ? STATE_DISABLED_OPACITY : 1,
          transition: 'all 0.2s',
        }}
      >
        {saved ? '✓ บันทึกแล้ว' : saving ? 'กำลังบันทึก...' : 'บันทึกส่วนลด VIP'}
      </button>
      <style>{`
        .loyalty-section .loyalty-save-btn:focus-visible,
        .loyalty-section input:focus-visible {
          outline: ${STATE_FOCUS_RING};
          outline-offset: 2px;
        }
      `}</style>
    </div>
  )
}
