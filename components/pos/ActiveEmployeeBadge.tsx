'use client'

import { useState } from 'react'
import type { ActiveEmployee } from '@/lib/active-employee'

const GOLD = '#c9a84c'

interface ActiveEmployeeBadgeProps {
  employee: ActiveEmployee
  onClockOut: () => void
}

export function ActiveEmployeeBadge({ employee, onClockOut }: ActiveEmployeeBadgeProps) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const initial = employee.name.trim()[0]?.toUpperCase() ?? '?'
  const roleLabel = employee.role === 'manager' ? 'ผู้จัดการ' : 'พนักงาน'

  const clockedIn = new Date(employee.clockedInAt)
  const timeStr = clockedIn.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

  // A shift left open is closed as 0 minutes at the next PIN entry, so the hours would be lost:
  // a failed save is shown and the cashier chooses to retry or to leave without saving.
  const handleClockOut = async () => {
    if (!employee.shiftId) { onClockOut(); return }
    setLoading(true); setErr('')
    const { supabase } = await import('@/lib/supabase')
    const { data, error } = await supabase
      .from('employee_shifts')
      .update({ clocked_out: new Date().toISOString() })
      .eq('id', employee.shiftId)
      .is('clocked_out', null)
      .select('id')
      .abortSignal(AbortSignal.timeout(10000))
    setLoading(false)
    if (error) { setErr(error.code ? `บันทึกเวลาออกไม่ได้ (${error.message})` : 'บันทึกเวลาออกไม่ได้เพราะเน็ตหลุด'); return }
    if (!data?.length) {
      // 0 rows = already closed on another device (fine) or refused by row security (hours lost)
      const { data: row, error: readErr } = await supabase
        .from('employee_shifts').select('clocked_out').eq('id', employee.shiftId).maybeSingle()
      if (readErr || !row?.clocked_out) {
        setErr(readErr ? `บันทึกเวลาออกไม่ได้ (${readErr.message})` : 'บันทึกเวลาออกไม่ได้: ระบบไม่ยอมให้บันทึก แจ้งผู้จัดการ')
        return
      }
    }
    onClockOut()
  }

  if (confirming) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {err
          ? <span role="alert" style={{ color: '#ff8080', fontSize: 13 }}>{err} ถ้าออกโดยไม่บันทึก ชั่วโมงทำงานกะนี้จะหาย</span>
          : <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>ออกจากกะ?</span>}
        <button
          onClick={handleClockOut}
          disabled={loading}
          style={{
            padding: '0 12px', height: 32, borderRadius: 6, border: 'none',
            backgroundColor: '#ff6b6b', color: 'white', fontSize: 13, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {loading ? '...' : err ? 'ลองใหม่' : 'ยืนยัน'}
        </button>
        {err && (
          <button
            onClick={() => { setErr(''); setConfirming(false); onClockOut() }}
            style={{
              padding: '0 12px', height: 32, borderRadius: 6,
              border: '1px solid rgba(255,107,107,0.4)', backgroundColor: 'transparent',
              color: '#ff8080', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ออกโดยไม่บันทึก
          </button>
        )}
        <button
          onClick={() => { setErr(''); setConfirming(false) }}
          style={{
            padding: '0 12px', height: 32, borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ยกเลิก
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title={`${employee.name} (${roleLabel}) — เข้างาน ${timeStr} — คลิกเพื่อออกจากกะ`}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px', height: 36, borderRadius: 8,
        border: `1px solid ${GOLD}44`,
        backgroundColor: `${GOLD}10`,
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${GOLD}1a`)}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = `${GOLD}10`)}
    >
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        backgroundColor: `${GOLD}25`, border: `1px solid ${GOLD}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ color: GOLD, fontSize: 11, fontWeight: 700 }}>{initial}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <span style={{ color: GOLD, fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>{employee.name}</span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, lineHeight: 1.2 }}>เข้า {timeStr}</span>
      </div>
    </button>
  )
}
