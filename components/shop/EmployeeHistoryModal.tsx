'use client'

import { useEffect, useRef, useState } from 'react'

const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
}
const CARD: React.CSSProperties = {
  backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 16, padding: 0, width: '100%', maxWidth: 500,
  maxHeight: '85vh', display: 'flex', flexDirection: 'column',
  fontFamily: 'var(--font-body, Inter, sans-serif)',
}

type Shift = {
  id: string
  clocked_in: string
  clocked_out: string | null
  total_minutes: number | null
}

interface EmployeeHistoryModalProps {
  employeeId: string
  employeeName: string
  hourlyRate: number | null
  onClose: () => void
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}
function fmtHours(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h} ชม. ${m} น.` : `${m} น.`
}

export function EmployeeHistoryModal({ employeeId, employeeName, hourlyRate, onClose }: EmployeeHistoryModalProps) {
  const [shifts, setShifts]   = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const overlayRef            = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    const load = async () => {
      const { authClient } = await import('@/lib/supabase-auth')
      const since = new Date()
      since.setDate(since.getDate() - 30)
      const { data } = await authClient
        .from('employee_shifts')
        .select('id, clocked_in, clocked_out, total_minutes')
        .eq('employee_id', employeeId)
        .gte('clocked_in', since.toISOString())
        .order('clocked_in', { ascending: false })
      setShifts((data as Shift[]) ?? [])
      setLoading(false)
    }
    load()
  }, [employeeId])

  const completedShifts = shifts.filter(s => s.clocked_out)
  const totalMinutes    = completedShifts.reduce((s, sh) => s + (sh.total_minutes ?? 0), 0)
  const totalHours      = totalMinutes / 60
  const totalEarnings   = hourlyRate ? Math.round(totalHours * hourlyRate) : null

  return (
    <div ref={overlayRef} style={OVERLAY} onClick={e => { if (e.target === overlayRef.current) onClose() }}>
      <div style={CARD}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{employeeName}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>ประวัติกะทำงาน — 30 วันล่าสุด</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {/* Summary */}
        {!loading && (
          <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 24, flexShrink: 0 }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>กะทั้งหมด</div>
              <div style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>{completedShifts.length}</div>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>ชั่วโมงรวม</div>
              <div style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>{totalMinutes > 0 ? fmtHours(totalMinutes) : '—'}</div>
            </div>
            {totalEarnings !== null && (
              <div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>รายได้</div>
                <div style={{ color: '#c9a84c', fontSize: 20, fontWeight: 700 }}>{totalEarnings.toLocaleString()} ₭</div>
              </div>
            )}
          </div>
        )}

        {/* Shift list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3].map(i => <div key={i} style={{ height: 52, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)' }} />)}
            </div>
          ) : shifts.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
              ยังไม่มีประวัติกะ
            </div>
          ) : (
            <div style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {shifts.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600 }}>{fmtDate(s.clocked_in)}</div>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>
                      {fmtTime(s.clocked_in)} — {s.clocked_out ? fmtTime(s.clocked_out) : <span style={{ color: '#4cba7f' }}>ยังทำงานอยู่</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {s.total_minutes != null ? (
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600 }}>{fmtHours(s.total_minutes)}</div>
                    ) : (
                      <div style={{ color: '#4cba7f', fontSize: 12 }}>ทำงานอยู่</div>
                    )}
                    {s.total_minutes != null && hourlyRate && (
                      <div style={{ color: '#c9a84c', fontSize: 11, marginTop: 1 }}>
                        {Math.round(s.total_minutes / 60 * hourlyRate).toLocaleString()} ₭
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
