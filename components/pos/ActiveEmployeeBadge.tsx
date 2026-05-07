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

  const initial = employee.name.trim()[0]?.toUpperCase() ?? '?'
  const roleLabel = employee.role === 'manager' ? 'ผู้จัดการ' : 'พนักงาน'

  const clockedIn = new Date(employee.clockedInAt)
  const timeStr = clockedIn.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

  const handleClockOut = async () => {
    setLoading(true)
    try {
      if (employee.shiftId) {
        const { supabase } = await import('@/lib/supabase')
        await supabase
          .from('employee_shifts')
          .update({ clocked_out: new Date().toISOString() })
          .eq('id', employee.shiftId)
      }
    } catch { /* non-critical */ }
    onClockOut()
    setLoading(false)
  }

  if (confirming) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>ออกจากกะ?</span>
        <button
          onClick={handleClockOut}
          disabled={loading}
          style={{
            padding: '0 12px', height: 32, borderRadius: 6, border: 'none',
            backgroundColor: '#ff6b6b', color: 'white', fontSize: 13, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {loading ? '...' : 'ยืนยัน'}
        </button>
        <button
          onClick={() => setConfirming(false)}
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
