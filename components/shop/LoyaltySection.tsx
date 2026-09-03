'use client'

import { useEffect, useState } from 'react'
import { IBM_Plex_Sans_Thai } from 'next/font/google'
import { getLoyaltySettings, upsaveLoyaltySettings } from '@/lib/customers'
import type { LoyaltySettings } from '@/lib/customers'
import { DEFAULT_SETTINGS, computePointsEarned } from '@/lib/loyalty'
import { useShop } from '@/lib/use-shop'
import {
  GOLD, SUCCESS, BG_BASE, BG_CARD_ALT, BORDER_SUBTLE, BORDER_DEFAULT, BORDER_GOLD,
  TEXT_1, TEXT_2, FONT_MONO, RADIUS, STATE_DISABLED_OPACITY, STATE_FOCUS_RING,
} from '@/lib/pos-theme-tokens'

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: RADIUS.lg,
  border: `1px solid ${BORDER_DEFAULT}`, backgroundColor: BG_BASE,
  color: TEXT_1, fontSize: 14, fontFamily: FONT_MONO, boxSizing: 'border-box',
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: GOLD, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 700, marginBottom: 12, marginTop: 4 }}>
      {children}
    </div>
  )
}

function FieldRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${BORDER_SUBTLE}` }}>
      <div style={{ flex: 1, marginRight: 20 }}>
        <div style={{ fontSize: 14, color: TEXT_1, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: TEXT_2, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ width: 100, flexShrink: 0 }}>{children}</div>
    </div>
  )
}

export function LoyaltySection() {
  const { shopId } = useShop()
  const [settings, setSettings] = useState<LoyaltySettings | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)

  const s = settings ?? { shop_id: shopId ?? '', ...DEFAULT_SETTINGS }

  useEffect(() => {
    if (!shopId) return
    getLoyaltySettings(shopId).then(data => {
      setSettings(data ?? { shop_id: shopId, ...DEFAULT_SETTINGS } as LoyaltySettings)
      setLoading(false)
    })
  }, [shopId])

  function update(key: keyof LoyaltySettings, value: unknown) {
    setSettings(prev => ({ ...(prev ?? { shop_id: shopId ?? '', ...DEFAULT_SETTINGS } as LoyaltySettings), [key]: value }))
  }

  async function handleSave() {
    if (!shopId) return
    setSaving(true)
    await upsaveLoyaltySettings({ ...s, shop_id: shopId })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const sampleTotal   = 100000
  const samplePoints  = computePointsEarned(sampleTotal, s)
  const sampleLak     = Math.floor(samplePoints / 10)

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ height: 56, borderRadius: RADIUS.lg, backgroundColor: BG_CARD_ALT }} />)}
      </div>
    )
  }

  return (
    <div className={`${ibmPlexSansThai.className} loyalty-section`} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Enable toggle */}
      <div style={{ padding: '16px 0', borderBottom: `1px solid ${BORDER_SUBTLE}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_1 }}>เปิดใช้งานสะสมแต้ม</div>
          <div style={{ fontSize: 12, color: TEXT_2, marginTop: 2 }}>ลูกค้าได้รับคะแนนทุกครั้งที่ซื้อ</div>
        </div>
        <button
          onClick={() => update('enabled', !s.enabled)}
          style={{
            width: 52, height: 28, borderRadius: RADIUS.pill, border: 'none',
            backgroundColor: s.enabled ? GOLD : BORDER_DEFAULT,
            cursor: 'pointer', position: 'relative', transition: 'all 0.2s',
          }}
        >
          <div style={{
            position: 'absolute', top: 3, width: 22, height: 22, borderRadius: '50%',
            backgroundColor: TEXT_1, transition: 'left 0.2s',
            left: s.enabled ? 27 : 3,
          }} />
        </button>
      </div>

      {/* Points rate */}
      <div style={{ backgroundColor: BG_CARD_ALT, border: `1px solid ${BORDER_GOLD}`, borderRadius: RADIUS['3xl'], padding: '16px 18px', marginBottom: 16 }}>
        <SectionTitle>อัตราสะสมแต้ม</SectionTitle>
        <FieldRow label="แต้มต่อ LAK" sub="คะแนนที่ได้รับต่อ 1 LAK ที่ใช้จ่าย">
          <input
            type="number" step="0.0001" min="0.0001"
            value={s.points_per_lak}
            onChange={e => update('points_per_lak', parseFloat(e.target.value) || 0.0001)}
            style={{ ...inputStyle, textAlign: 'right' }}
          />
        </FieldRow>

        {/* Preview */}
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: RADIUS.lg,
          backgroundColor: `${SUCCESS}14`, border: `1px solid ${SUCCESS}33`,
          fontSize: 13, color: SUCCESS, lineHeight: 1.7,
        }}>
          ตัวอย่าง: ซื้อ {sampleTotal.toLocaleString()} ₭ → ได้ <strong>{samplePoints} แต้ม</strong>
          {sampleLak > 0 && <> (≈ {sampleLak.toLocaleString()} ₭ ส่วนลด)</>}
        </div>
      </div>

      {/* VIP thresholds */}
      <div style={{ backgroundColor: BG_CARD_ALT, border: `1px solid ${BORDER_SUBTLE}`, borderRadius: RADIUS['3xl'], padding: '16px 18px', marginBottom: 16 }}>
        <SectionTitle>เกณฑ์ระดับ VIP</SectionTitle>
        {([
          ['vip_silver_threshold', '⭐ Silver', 'จำนวนแต้มขั้นต่ำสำหรับ Silver'],
          ['vip_gold_threshold',   '👑 Gold',   'จำนวนแต้มขั้นต่ำสำหรับ Gold'],
          ['vip_platinum_threshold', '💎 Platinum', 'จำนวนแต้มขั้นต่ำสำหรับ Platinum'],
        ] as const).map(([key, label, sub]) => (
          <FieldRow key={key} label={label} sub={sub}>
            <input
              type="number" min="1"
              value={s[key]}
              onChange={e => update(key, parseInt(e.target.value, 10) || 0)}
              style={{ ...inputStyle, textAlign: 'right' }}
            />
          </FieldRow>
        ))}
      </div>

      {/* VIP discounts */}
      <div style={{ backgroundColor: BG_CARD_ALT, border: `1px solid ${BORDER_SUBTLE}`, borderRadius: RADIUS['3xl'], padding: '16px 18px', marginBottom: 16 }}>
        <SectionTitle>ส่วนลด VIP (%)</SectionTitle>
        {([
          ['silver_discount_percent',   '⭐ Silver discount %',   'ส่วนลดอัตโนมัติ'],
          ['gold_discount_percent',     '👑 Gold discount %',     'ส่วนลดอัตโนมัติ'],
          ['platinum_discount_percent', '💎 Platinum discount %', 'ส่วนลดอัตโนมัติ'],
          ['birthday_discount_percent', '🎂 Birthday discount %', 'ส่วนลดวันเกิด'],
        ] as const).map(([key, label, sub]) => (
          <FieldRow key={key} label={label} sub={sub}>
            <input
              type="number" min="0" max="100"
              value={s[key]}
              onChange={e => update(key, parseInt(e.target.value, 10) || 0)}
              style={{ ...inputStyle, textAlign: 'right' }}
            />
          </FieldRow>
        ))}
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving || !shopId}
        className="loyalty-save-btn"
        style={{
          height: 52, borderRadius: RADIUS.xl,
          border: `1px solid ${saved ? SUCCESS : GOLD}`,
          backgroundColor: saved ? `${SUCCESS}14` : 'transparent',
          color: saved ? SUCCESS : GOLD, fontSize: 15, fontWeight: 800,
          cursor: saving ? 'wait' : 'pointer',
          opacity: saving ? STATE_DISABLED_OPACITY : 1,
          transition: 'all 0.2s',
        }}
      >
        {saved ? '✓ บันทึกแล้ว' : saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
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
