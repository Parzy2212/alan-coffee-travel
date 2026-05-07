'use client'

import { useEffect, useRef, useState } from 'react'
import { PinInput } from './PinInput'
import { hashEmployeePin } from '@/lib/employee-pin'
import { logAccountEvent } from '@/lib/account-events'

const GOLD = '#c9a84c'
const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
}
const CARD: React.CSSProperties = {
  backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 16, padding: 28, width: '100%', maxWidth: 460,
  maxHeight: '90vh', overflowY: 'auto',
  fontFamily: 'var(--font-body, Inter, sans-serif)',
}
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.4px', display: 'block', marginBottom: 6 }
const INP: React.CSSProperties = { width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '11px 14px', color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

const WEAK_PINS = new Set(['0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321','1230','0123'])

export interface EmployeeRow {
  id: string
  name: string
  role: 'cashier' | 'manager'
  is_active: boolean
  hourly_rate: number | null
  notes: string | null
}

interface EditEmployeeModalProps {
  employee: EmployeeRow
  onSaved: () => void
  onClose: () => void
  initialTab?: 'info' | 'pin'
}

export function EditEmployeeModal({ employee, onSaved, onClose, initialTab = 'info' }: EditEmployeeModalProps) {
  const [tab, setTab]             = useState<'info' | 'pin'>(initialTab)
  const [name, setName]           = useState(employee.name)
  const [role, setRole]           = useState<'cashier' | 'manager'>(employee.role)
  const [hourlyRate, setHourlyRate] = useState(employee.hourly_rate ? String(employee.hourly_rate) : '')
  const [notes, setNotes]         = useState(employee.notes ?? '')
  const [pin, setPin]             = useState('')
  const [pinVisible, setPinVisible] = useState(false)
  const [pinError, setPinError]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const overlayRef                = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSaveInfo = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) { setError('กรุณาใส่ชื่อพนักงาน'); return }
    setSaving(true); setError('')
    try {
      const { authClient } = await import('@/lib/supabase-auth')
      const { error: err } = await authClient.from('employees').update({
        name:        trimmedName,
        role,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        notes:       notes.trim() || null,
      }).eq('id', employee.id)
      if (err) throw err
      await logAccountEvent('shop_settings_updated' as never, `Employee updated: ${trimmedName}`)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  const handleSavePin = async () => {
    if (pin.length !== 4) { setPinError('PIN ต้องมี 4 หลัก'); return }
    if (WEAK_PINS.has(pin)) { setPinError('PIN นี้ง่ายเกินไป กรุณาเลือก PIN อื่น'); return }
    setSaving(true); setPinError(''); setError('')
    try {
      const pinHash = await hashEmployeePin(pin)
      if (!pinHash) throw new Error('ไม่สามารถเข้ารหัส PIN ได้')
      const { authClient } = await import('@/lib/supabase-auth')
      const { error: err } = await authClient.from('employees').update({ pin_hash: pinHash }).eq('id', employee.id)
      if (err) {
        if (err.message.includes('unique')) { setPinError('PIN นี้ถูกใช้แล้ว กรุณาเลือก PIN อื่น') }
        else throw err
        return
      }
      await logAccountEvent('shop_settings_updated' as never, `Employee PIN changed: ${employee.name}`)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={overlayRef} style={OVERLAY} onClick={e => { if (e.target === overlayRef.current) onClose() }}>
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'white' }}>แก้ไขพนักงาน</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {(['info', 'pin'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 16px', background: 'none', border: 'none',
              borderBottom: `2px solid ${tab === t ? GOLD : 'transparent'}`,
              color: tab === t ? GOLD : 'rgba(255,255,255,0.4)',
              fontSize: 13, fontWeight: tab === t ? 600 : 400,
              cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
              transition: 'color 0.15s',
            }}>
              {t === 'info' ? 'ข้อมูล' : 'เปลี่ยน PIN'}
            </button>
          ))}
        </div>

        {tab === 'info' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={LABEL}>ชื่อ <span style={{ color: '#ff6b6b' }}>*</span></label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} style={INP} autoFocus />
            </div>
            <div>
              <label style={{ ...LABEL, marginBottom: 10 }}>บทบาท</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {([['cashier', '👨‍🍳', 'พนักงาน'], ['manager', '👨‍💼', 'ผู้จัดการ']] as const).map(([r, icon, label]) => (
                  <button key={r} onClick={() => setRole(r)} style={{
                    padding: '12px', borderRadius: 10, textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit',
                    backgroundColor: role === r ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `2px solid ${role === r ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.07)'}`,
                    transition: 'all 0.15s',
                  }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                    <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600 }}>{label}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={LABEL}>ค่าจ้างต่อชั่วโมง (LAK)</label>
              <input type="number" min="0" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} placeholder="25000" style={INP} />
            </div>
            <div>
              <label style={LABEL}>หมายเหตุ</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...INP, resize: 'vertical', lineHeight: 1.6 }} />
            </div>
            {error && <div style={{ backgroundColor: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ff6b6b', fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '12px 0', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button>
              <button onClick={handleSaveInfo} disabled={saving || !name.trim()} style={{ flex: 2, padding: '12px 0', borderRadius: 9, border: 'none', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', backgroundColor: (saving || !name.trim()) ? 'rgba(201,168,76,0.3)' : GOLD, color: (saving || !name.trim()) ? 'rgba(255,255,255,0.3)' : '#000', cursor: (saving || !name.trim()) ? 'not-allowed' : 'pointer' }}>
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ padding: '12px 14px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 1.6 }}>
              PIN ปัจจุบันจะถูกยกเลิก PIN ใหม่จะมีผลทันที
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <label style={{ ...LABEL, marginBottom: 0 }}>PIN ใหม่ 4 หลัก</label>
                <button onClick={() => setPinVisible(v => !v)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {pinVisible ? 'ซ่อน' : 'แสดง'}
                </button>
              </div>
              <PinInput value={pin} onChange={p => { setPin(p); setPinError('') }} visible={pinVisible} error={!!pinError} />
              {pinError && <div style={{ color: '#ff6b6b', fontSize: 12, marginTop: 6 }}>{pinError}</div>}
            </div>
            {error && <div style={{ backgroundColor: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ff6b6b', fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '12px 0', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button>
              <button onClick={handleSavePin} disabled={saving || pin.length !== 4} style={{ flex: 2, padding: '12px 0', borderRadius: 9, border: 'none', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', backgroundColor: (saving || pin.length !== 4) ? 'rgba(201,168,76,0.3)' : GOLD, color: (saving || pin.length !== 4) ? 'rgba(255,255,255,0.3)' : '#000', cursor: (saving || pin.length !== 4) ? 'not-allowed' : 'pointer' }}>
                {saving ? 'กำลังบันทึก...' : 'เปลี่ยน PIN'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
