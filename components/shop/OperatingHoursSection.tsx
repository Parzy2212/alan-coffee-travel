'use client'

import { useEffect, useRef, useState } from 'react'
import { IBM_Plex_Sans_Thai } from 'next/font/google'
import { useShop } from '@/lib/use-shop'
import { logAccountEvent } from '@/lib/account-events'
import { SaveButton } from './ShopIdentitySection'
import {
  GOLD, BG_CARD, BG_CARD_ALT, BORDER_SUBTLE, BORDER_DEFAULT,
  TEXT_1, TEXT_2, DANGER, FONT_MONO, RADIUS,
} from '@/lib/pos-theme-tokens'

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

const CARD: React.CSSProperties = { backgroundColor: BG_CARD, border: `1px solid ${BORDER_SUBTLE}`, borderRadius: RADIUS['2xl'], padding: 24, marginBottom: 24 }

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
type DayKey = typeof DAY_KEYS[number]
const DAY_LABELS: Record<DayKey, string> = { mon: 'จันทร์', tue: 'อังคาร', wed: 'พุธ', thu: 'พฤหัส', fri: 'ศุกร์', sat: 'เสาร์', sun: 'อาทิตย์' }
type DaySchedule = { open: string; close: string; closed: boolean }
type Hours = Record<DayKey, DaySchedule>

const DEFAULT_HOURS: Hours = {
  mon: { open: '08:00', close: '18:00', closed: false },
  tue: { open: '08:00', close: '18:00', closed: false },
  wed: { open: '08:00', close: '18:00', closed: false },
  thu: { open: '08:00', close: '18:00', closed: false },
  fri: { open: '08:00', close: '18:00', closed: false },
  sat: { open: '08:00', close: '18:00', closed: false },
  sun: { open: '08:00', close: '18:00', closed: false },
}

const TIME_INP: React.CSSProperties = { backgroundColor: BG_CARD_ALT, border: `1px solid ${BORDER_DEFAULT}`, borderRadius: RADIUS.sm, padding: '7px 10px', color: TEXT_1, fontSize: 13, fontFamily: FONT_MONO, outline: 'none', colorScheme: 'dark' as never }

export function OperatingHoursSection() {
  const { shop, shopId, loading } = useShop()
  const [hours, setHours] = useState<Hours>(DEFAULT_HOURS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!shop?.operating_hours) return
    setHours({ ...DEFAULT_HOURS, ...(shop.operating_hours as Hours) })
  }, [shop])

  const setDay = (day: DayKey, patch: Partial<DaySchedule>) =>
    setHours(h => ({ ...h, [day]: { ...h[day], ...patch } }))

  const copyToAll = () => {
    const first = DAY_KEYS.find(d => !hours[d].closed)
    if (!first) return
    const { open, close } = hours[first]
    setHours(h => {
      const next = { ...h }
      DAY_KEYS.forEach(d => { if (!next[d].closed) next[d] = { ...next[d], open, close } })
      return next
    })
  }

  const handleSave = async () => {
    if (!shopId) return
    setSaving(true); setError('')
    if (timer.current) clearTimeout(timer.current)
    try {
      const { authClient } = await import('@/lib/supabase-auth')
      const { error: err } = await authClient.from('shops').update({ operating_hours: hours }).eq('id', shopId)
      if (err) throw err
      await logAccountEvent('shop_settings_updated' as never, 'Operating hours updated')
      setSaved(true)
      timer.current = setTimeout(() => setSaved(false), 2500)
    } catch (e) { setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด') }
    finally { setSaving(false) }
  }

  return (
    <div className={ibmPlexSansThai.className} style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_2 }}>เวลาทำการ</div>
        <button
          onClick={copyToAll}
          style={{ padding: '5px 12px', backgroundColor: BG_CARD_ALT, border: `1px solid ${BORDER_DEFAULT}`, borderRadius: RADIUS.sm, color: TEXT_2, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          คัดลอกเวลาไปทุกวัน
        </button>
      </div>

      {loading ? (
        <div style={{ height: 200, borderRadius: RADIUS.md, backgroundColor: BG_CARD_ALT }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {DAY_KEYS.map((day, i) => {
            const s = hours[day]
            return (
              <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderBottom: i < 6 ? `1px solid ${BORDER_SUBTLE}` : 'none' }}>
                {/* Day label */}
                <div style={{ width: 64, color: TEXT_2, fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
                  {DAY_LABELS[day]}
                </div>

                {/* Toggle pill */}
                <button
                  onClick={() => setDay(day, { closed: !s.closed })}
                  style={{ width: 44, height: 24, borderRadius: RADIUS.pill, backgroundColor: s.closed ? BORDER_SUBTLE : GOLD, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background-color 0.15s', flexShrink: 0 }}
                >
                  <div style={{ position: 'absolute', top: 3, left: s.closed ? 3 : 23, width: 18, height: 18, borderRadius: '50%', backgroundColor: TEXT_1, transition: 'left 0.15s' }} />
                </button>

                {!s.closed ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="time" value={s.open}  onChange={e => setDay(day, { open: e.target.value })}  style={TIME_INP} />
                    <span style={{ color: TEXT_2, fontSize: 12 }}>–</span>
                    <input type="time" value={s.close} onChange={e => setDay(day, { close: e.target.value })} style={TIME_INP} />
                  </div>
                ) : (
                  <span style={{ color: TEXT_2, fontSize: 13 }}>ปิด</span>
                )}
              </div>
            )
          })}

          {error && <div style={{ backgroundColor: `${DANGER}14`, border: `1px solid ${DANGER}33`, borderRadius: RADIUS.md, padding: '10px 14px', color: DANGER, fontSize: 13, marginTop: 12 }}>{error}</div>}
          <div style={{ marginTop: 16 }}>
            <SaveButton saving={saving} saved={saved} onClick={handleSave} />
          </div>
        </div>
      )}
    </div>
  )
}
