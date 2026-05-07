'use client'

import { useEffect, useRef, useState } from 'react'
import { useShop } from '@/lib/use-shop'
import { logAccountEvent } from '@/lib/account-events'
import { SaveButton } from './ShopIdentitySection'

const GOLD = '#c9a84c'
const CARD: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, marginBottom: 24 }

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

const TIME_INP: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '7px 10px', color: 'white', fontSize: 13, fontFamily: 'inherit', outline: 'none', colorScheme: 'dark' as never }

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
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>เวลาทำการ</div>
        <button
          onClick={copyToAll}
          style={{ padding: '5px 12px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          คัดลอกเวลาไปทุกวัน
        </button>
      </div>

      {loading ? (
        <div style={{ height: 200, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {DAY_KEYS.map((day, i) => {
            const s = hours[day]
            return (
              <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderBottom: i < 6 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                {/* Day label */}
                <div style={{ width: 64, color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
                  {DAY_LABELS[day]}
                </div>

                {/* Toggle pill */}
                <button
                  onClick={() => setDay(day, { closed: !s.closed })}
                  style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: s.closed ? 'rgba(255,255,255,0.08)' : GOLD, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background-color 0.15s', flexShrink: 0 }}
                >
                  <div style={{ position: 'absolute', top: 3, left: s.closed ? 3 : 23, width: 18, height: 18, borderRadius: '50%', backgroundColor: 'white', transition: 'left 0.15s' }} />
                </button>

                {!s.closed ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="time" value={s.open}  onChange={e => setDay(day, { open: e.target.value })}  style={TIME_INP} />
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>–</span>
                    <input type="time" value={s.close} onChange={e => setDay(day, { close: e.target.value })} style={TIME_INP} />
                  </div>
                ) : (
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>ปิด</span>
                )}
              </div>
            )
          })}

          {error && <div style={{ backgroundColor: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ff6b6b', fontSize: 13, marginTop: 12 }}>{error}</div>}
          <div style={{ marginTop: 16 }}>
            <SaveButton saving={saving} saved={saved} onClick={handleSave} />
          </div>
        </div>
      )}
    </div>
  )
}
