'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { GOLD, BLACK, CARD, BORDER, RED, GREEN, ORANGE } from '@/components/cafe/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

type Staff = {
  id: string
  name: string
  name_th: string | null
  avatar_url: string | null
}

type Schedule = {
  id: string
  staff_id: string
  date: string
  shift: Shift
}

type Shift = 'morning' | 'afternoon' | 'evening'

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIFTS: { key: Shift; label: string; icon: string; color: string }[] = [
  { key: 'morning',   label: 'เช้า',  icon: '☀️', color: '#f5a623' },
  { key: 'afternoon', label: 'บ่าย',  icon: '🌤️', color: '#50b8e7' },
  { key: 'evening',   label: 'เย็น',  icon: '🌙', color: '#a66cf5' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() + n)
  return result
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

function shiftLabel(shift: Shift): string {
  if (shift === 'morning')   return 'เช้า☀️'
  if (shift === 'afternoon') return 'บ่าย🌤️'
  return 'เย็น🌙'
}

// ─── Staff Avatar ─────────────────────────────────────────────────────────────

function StaffAvatar({ name, avatarUrl, size = 26 }: { name: string; avatarUrl: string | null; size?: number }) {
  const [err, setErr] = useState(false)
  const ini = name.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      backgroundColor: `${GOLD}22`, border: `1px solid ${BORDER}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {avatarUrl && !err
        ? <img src={avatarUrl} alt={name} width={size} height={size}
            style={{ width: size, height: size, objectFit: 'cover' }}
            onError={() => setErr(true)} />
        : <span style={{ fontSize: size * 0.4, fontWeight: 700, color: GOLD }}>{ini}</span>}
    </div>
  )
}

// ─── Staff Picker Popup ───────────────────────────────────────────────────────

function StaffPickerPopup({
  staff, assigned, label, saving, onToggle, onClose,
  allSchedules, pickerDate, pickerShift,
}: {
  staff: Staff[]
  assigned: string[]
  label: string
  saving: boolean
  onToggle: (staffId: string) => void
  onClose: () => void
  allSchedules: Schedule[]
  pickerDate: string
  pickerShift: Shift
}) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        backgroundColor: '#1c1c1c', border: `1px solid ${GOLD}44`,
        borderRadius: 14, padding: 24, width: 340,
        maxHeight: '72vh', display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>กำหนดพนักงาน</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{label}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {staff.map(s => {
            const isAssigned = assigned.includes(s.id)
            // Check if staff is assigned to ANOTHER shift on the same day
            const conflictShift = allSchedules.find(
              sc => sc.staff_id === s.id && sc.date === pickerDate && sc.shift !== pickerShift
            )
            return (
              <button key={s.id} onClick={() => !saving && onToggle(s.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                borderRadius: 10, border: `2px solid ${isAssigned ? GREEN : 'rgba(255,255,255,0.1)'}`,
                backgroundColor: isAssigned ? `${GREEN}14` : 'rgba(255,255,255,0.03)',
                cursor: saving ? 'wait' : 'pointer', textAlign: 'left',
                transition: 'all .15s', opacity: saving ? 0.7 : 1,
              }}>
                <StaffAvatar name={s.name} avatarUrl={s.avatar_url} size={34} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{s.name_th ?? s.name}</div>
                  {conflictShift && (
                    <div style={{ fontSize: 11, color: ORANGE, marginTop: 2 }}>
                      ⚠️ {shiftLabel(conflictShift.shift)}
                    </div>
                  )}
                </div>
                {isAssigned && <span style={{ color: GREEN, fontSize: 18 }}>✓</span>}
              </button>
            )
          })}
          {staff.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: 24 }}>
              ยังไม่มีพนักงาน
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScheduleTab() {
  const [staff,       setStaff]       = useState<Staff[]>([])
  const [schedules,   setSchedules]   = useState<Schedule[]>([])
  const [loading,     setLoading]     = useState(true)
  const [weekStart,   setWeekStart]   = useState<Date>(() => getMonday(new Date()))
  const [picker,      setPicker]      = useState<{ date: string; shift: Shift } | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [copyingWeek, setCopyingWeek] = useState(false)

  const weekDays = getWeekDays(weekStart)

  const loadData = useCallback(async () => {
    setLoading(true)
    const days = getWeekDays(weekStart)
    const startDate = formatDate(days[0])
    const endDate   = formatDate(days[6])

    const [staffRes, schedRes] = await Promise.all([
      supabase.from('staff').select('id, name, name_th, avatar_url')
        .eq('is_active', true).order('name'),
      supabase.from('staff_schedules').select('id, staff_id, date, shift')
        .gte('date', startDate).lte('date', endDate),
    ])

    setStaff((staffRes.data ?? []) as Staff[])
    setSchedules((schedRes.data ?? []) as Schedule[])
    setLoading(false)
  }, [weekStart])

  useEffect(() => { loadData() }, [loadData])

  function prevWeek() {
    setWeekStart(prev => addDays(prev, -7))
  }
  function nextWeek() {
    setWeekStart(prev => addDays(prev, 7))
  }
  function goToday() {
    setWeekStart(getMonday(new Date()))
  }

  function getAssigned(date: string, shift: Shift): { schedId: string; s: Staff }[] {
    return schedules
      .filter(sc => sc.date === date && sc.shift === shift)
      .map(sc => ({ schedId: sc.id, s: staff.find(st => st.id === sc.staff_id)! }))
      .filter(x => x.s != null)
  }

  async function toggleStaff(staffId: string) {
    if (!picker || saving) return
    const { date, shift } = picker
    const existing = schedules.find(sc => sc.staff_id === staffId && sc.date === date && sc.shift === shift)

    setSaving(true)
    if (existing) {
      await supabase.from('staff_schedules').delete().eq('id', existing.id)
      setSchedules(prev => prev.filter(sc => sc.id !== existing.id))
    } else {
      const { data } = await supabase
        .from('staff_schedules')
        .insert({ staff_id: staffId, date, shift })
        .select('id, staff_id, date, shift')
        .single()
      if (data) setSchedules(prev => [...prev, data as Schedule])
    }
    setSaving(false)
  }

  async function copyPrevWeek() {
    setCopyingWeek(true)
    const prevWeekStart = addDays(weekStart, -7)
    const prevDays = getWeekDays(prevWeekStart)
    const prevStart = formatDate(prevDays[0])
    const prevEnd   = formatDate(prevDays[6])
    const { data: prevSchedules } = await supabase
      .from('staff_schedules').select('staff_id, date, shift')
      .gte('date', prevStart).lte('date', prevEnd)
    if (!prevSchedules || prevSchedules.length === 0) { setCopyingWeek(false); return }
    // Map each prev schedule to current week (add 7 days)
    const toInsert = prevSchedules.map((s: { staff_id: string; date: string; shift: string }) => ({
      staff_id: s.staff_id,
      date: formatDate(addDays(new Date(s.date + 'T00:00:00'), 7)),
      shift: s.shift,
    }))
    // Only insert ones that don't already exist
    for (const row of toInsert) {
      const exists = schedules.find(sc => sc.staff_id === row.staff_id && sc.date === row.date && sc.shift === row.shift)
      if (!exists) {
        await supabase.from('staff_schedules').insert(row)
      }
    }
    await loadData()
    setCopyingWeek(false)
  }

  const pickerAssigned = picker
    ? schedules.filter(sc => sc.date === picker.date && sc.shift === picker.shift).map(sc => sc.staff_id)
    : []

  const today = formatDate(new Date())

  const weekLabel = `${weekDays[0].toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`

  const pickerShift = picker ? SHIFTS.find(s => s.key === picker.shift) : null
  const pickerDay = picker
    ? new Date(picker.date).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short' })
    : ''

  // Summary stats
  const allSlots = weekDays.length * SHIFTS.length // 21
  let staffedSlots = 0
  let understaffedSlots = 0
  let emptySlots = 0
  const uniqueStaffIds = new Set<string>()

  weekDays.forEach(day => {
    const ds = formatDate(day)
    SHIFTS.forEach(sh => {
      const assigned = getAssigned(ds, sh.key)
      if (assigned.length === 0) {
        emptySlots++
      } else if (assigned.length === 1) {
        staffedSlots++
        understaffedSlots++
        assigned.forEach(a => uniqueStaffIds.add(a.s.id))
      } else {
        staffedSlots++
        assigned.forEach(a => uniqueStaffIds.add(a.s.id))
      }
    })
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {picker && (
        <StaffPickerPopup
          staff={staff}
          assigned={pickerAssigned}
          label={`${pickerDay} · ${pickerShift?.icon} ${pickerShift?.label}`}
          saving={saving}
          onToggle={toggleStaff}
          onClose={() => !saving && setPicker(null)}
          allSchedules={schedules}
          pickerDate={picker.date}
          pickerShift={picker.shift}
        />
      )}

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>ตารางงานประจำสัปดาห์</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 3 }}>{weekLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={prevWeek} style={navBtn}>← ก่อนหน้า</button>
          <button onClick={goToday}  style={{ ...navBtn, color: GOLD, borderColor: `${GOLD}44` }}>วันนี้</button>
          <button onClick={nextWeek} style={navBtn}>ถัดไป →</button>
          <button
            onClick={() => void copyPrevWeek()}
            disabled={copyingWeek}
            style={{
              ...navBtn,
              color: copyingWeek ? 'rgba(255,255,255,0.3)' : GOLD,
              borderColor: `${GOLD}33`,
              backgroundColor: `${GOLD}08`,
              opacity: copyingWeek ? 0.7 : 1,
              cursor: copyingWeek ? 'wait' : 'pointer',
            }}>
            {copyingWeek ? 'กำลังคัดลอก...' : '📋 คัดลอกสัปดาห์ที่แล้ว'}
          </button>
        </div>
      </div>

      {/* Shift legend */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {SHIFTS.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.color, display: 'inline-block' }} />
            {s.icon} {s.label}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: RED }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: `${RED}40`, border: `1px solid ${RED}`, display: 'inline-block' }} />
          ขาดพนักงาน
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(245,166,35,0.8)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: 'rgba(245,166,35,0.3)', border: '1px solid rgba(245,166,35,0.5)', display: 'inline-block' }} />
          คนเดียว
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: GREEN }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: `${GREEN}20`, border: `1px solid ${GREEN}33`, display: 'inline-block' }} />
          ครบ
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '20px 0' }}>กำลังโหลด...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 110 }}>วัน / Date</th>
                {SHIFTS.map(s => (
                  <th key={s.key} style={{ ...thStyle, color: s.color }}>
                    {s.icon} {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weekDays.map(day => {
                const ds      = formatDate(day)
                const isToday = ds === today
                const dayLabel = day.toLocaleDateString('th-TH', {
                  weekday: 'short', day: 'numeric', month: 'short',
                })

                return (
                  <tr key={ds} style={{ backgroundColor: isToday ? `${GOLD}0a` : undefined }}>
                    {/* Day label */}
                    <td style={{
                      ...tdStyle,
                      borderLeft: isToday ? `3px solid ${GOLD}` : '3px solid transparent',
                      fontWeight: isToday ? 700 : 400,
                      color: isToday ? GOLD : 'rgba(255,255,255,0.65)',
                      fontSize: 12,
                    }}>
                      {dayLabel}
                      {isToday && (
                        <div style={{ fontSize: 9, color: GOLD, letterSpacing: '1.5px', marginTop: 2, textTransform: 'uppercase' }}>
                          TODAY
                        </div>
                      )}
                    </td>

                    {/* Shift cells */}
                    {SHIFTS.map(shift => {
                      const assigned = getAssigned(ds, shift.key)
                      const cnt = assigned.length

                      let cellBg: string
                      let cellBorder: string
                      if (cnt === 0) {
                        cellBg = `${RED}0a`
                        cellBorder = `1px solid ${RED}22`
                      } else if (cnt === 1) {
                        cellBg = 'rgba(245,166,35,0.06)'
                        cellBorder = '1px solid rgba(245,166,35,0.18)'
                      } else {
                        cellBg = `${GREEN}08`
                        cellBorder = `1px solid ${GREEN}18`
                      }

                      return (
                        <td key={shift.key} style={{
                          ...tdStyle,
                          backgroundColor: cellBg,
                          border: cellBorder,
                        }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 34, alignItems: 'flex-start' }}>
                            {assigned.map(({ schedId, s }) => (
                              <button
                                key={schedId}
                                onClick={() => setPicker({ date: ds, shift: shift.key })}
                                title={`คลิกเพื่อแก้ไข — ${s.name_th ?? s.name}`}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 5,
                                  padding: '3px 9px 3px 5px', borderRadius: 99,
                                  backgroundColor: shift.color + '20',
                                  border: `1px solid ${shift.color}44`,
                                  cursor: 'pointer',
                                  background: 'none',
                                  outline: 'none',
                                }}
                              >
                                <StaffAvatar name={s.name} avatarUrl={s.avatar_url} size={18} />
                                <span style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>{s.name_th ?? s.name}</span>
                              </button>
                            ))}
                            <button
                              onClick={() => setPicker({ date: ds, shift: shift.key })}
                              title="เพิ่มพนักงาน"
                              style={{
                                width: 24, height: 24, borderRadius: '50%',
                                border: `1px dashed ${shift.color}55`,
                                backgroundColor: 'transparent',
                                color: shift.color + '88',
                                fontSize: 16, lineHeight: 1, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >+</button>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary footer */}
      {!loading && (
        <div style={{
          padding: '14px 18px', borderRadius: 10,
          backgroundColor: CARD, border: `1px solid ${BORDER}`,
          fontSize: 12, color: 'rgba(255,255,255,0.45)',
          display: 'flex', gap: 28, flexWrap: 'wrap',
        }}>
          <span>
            ช่วงที่มีพนักงาน:{' '}
            <strong style={{ color: GREEN }}>{staffedSlots}</strong>{' '}/ {allSlots}
          </span>
          <span>
            ไม่ครบ (คนเดียว):{' '}
            <strong style={{ color: understaffedSlots > 0 ? 'rgba(245,166,35,0.9)' : GREEN }}>
              {understaffedSlots}
            </strong>{' '}ช่วง
          </span>
          <span>
            ว่างเปล่า:{' '}
            <strong style={{ color: emptySlots > 0 ? RED : GREEN }}>
              {emptySlots}
            </strong>{' '}ช่วง
          </span>
          <span>
            พนักงานที่ทำงานสัปดาห์นี้:{' '}
            <strong style={{ color: '#fff' }}>{uniqueStaffIds.size}</strong>{' '}คน
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const navBtn: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.12)',
  backgroundColor: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.55)', fontSize: 12,
  cursor: 'pointer',
}

const thStyle: React.CSSProperties = {
  padding: '12px 14px', textAlign: 'left',
  fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.4)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'top',
  border: '1px solid rgba(255,255,255,0.06)',
}
