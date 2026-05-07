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

interface AddEmployeeModalProps {
  shopId: string
  onSaved: () => void
  onClose: () => void
}

export function AddEmployeeModal({ shopId, onSaved, onClose }: AddEmployeeModalProps) {
  const [name, setName]           = useState('')
  const [role, setRole]           = useState<'cashier' | 'manager'>('cashier')
  const [pin, setPin]             = useState('')
  const [pinVisible, setPinVisible] = useState(false)
  const [hourlyRate, setHourlyRate] = useState('')
  const [notes, setNotes]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [pinError, setPinError]   = useState('')
  const overlayRef                = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const validatePin = (p: string) => {
    if (p.length !== 4) return 'PIN ต้องมี 4 หลัก'
    if (WEAK_PINS.has(p)) return 'PIN นี้ง่ายเกินไป กรุณาเลือก PIN อื่น'
    return ''
  }

  const handleSave = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) { setError('กรุณาใส่ชื่อพนักงาน'); return }
    const pErr = validatePin(pin)
    if (pErr) { setPinError(pErr); return }

    setSaving(true); setError(''); setPinError('')
    try {
      const pinHash = await hashEmployeePin(pin)
      if (!pinHash) throw new Error('ไม่สามารถเข้ารหัส PIN ได้')

      const { authClient } = await import('@/lib/supabase-auth')
      const { error: insertErr } = await authClient.from('employees').insert({
        shop_id:     shopId,
        name:        trimmedName,
        role,
        pin_hash:    pinHash,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        notes:       notes.trim() || null,
      })

      if (insertErr) {
        if (insertErr.message.includes('unique')) {
          setPinError('PIN นี้ถูกใช้แล้ว กรุณาเลือก PIN อื่น')
        } else {
          throw insertErr
        }
        return
      }

      await logAccountEvent('shop_settings_updated' as never, `Employee added: ${trimmedName}`)
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'white' }}>เพิ่มพนักงาน</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Name */}
          <div>
            <label style={LABEL}>ชื่อ <span style={{ color: '#ff6b6b' }}>*</span></label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="เช่น น้องแนน" style={INP} autoFocus />
          </div>

          {/* Role */}
          <div>
            <label style={{ ...LABEL, marginBottom: 10 }}>บทบาท</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {([['cashier', '👨‍🍳', 'พนักงาน', 'รับออเดอร์ / ชำระเงิน'], ['manager', '👨‍💼', 'ผู้จัดการ', 'จัดการเมนูและรายงาน']] as const).map(([r, icon, label, sub]) => (
                <button key={r} onClick={() => setRole(r)} style={{
                  padding: '12px 14px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                  backgroundColor: role === r ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `2px solid ${role === r ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.07)'}`,
                  transition: 'all 0.15s',
                }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                  <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600 }}>{label}</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>{sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* PIN */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ ...LABEL, marginBottom: 0 }}>PIN 4 หลัก <span style={{ color: '#ff6b6b' }}>*</span></label>
              <button onClick={() => setPinVisible(v => !v)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                {pinVisible ? 'ซ่อน' : 'แสดง'}
              </button>
            </div>
            <PinInput value={pin} onChange={p => { setPin(p); setPinError('') }} visible={pinVisible} error={!!pinError} />
            {pinError && <div style={{ color: '#ff6b6b', fontSize: 12, marginTop: 6 }}>{pinError}</div>}
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 6 }}>พนักงานใช้ PIN นี้เพื่อเข้าสู่ระบบ POS</div>
          </div>

          {/* Hourly rate */}
          <div>
            <label style={LABEL}>ค่าจ้างต่อชั่วโมง (LAK) <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>(ไม่บังคับ)</span></label>
            <input type="number" min="0" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} placeholder="25000" style={INP} />
          </div>

          {/* Notes */}
          <div>
            <label style={LABEL}>หมายเหตุ <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>(ไม่บังคับ)</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="ข้อมูลเพิ่มเติม..." style={{ ...INP, resize: 'vertical', lineHeight: 1.6 }} />
          </div>

          {error && <div style={{ backgroundColor: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ff6b6b', fontSize: 13 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px 0', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              ยกเลิก
            </button>
            <button onClick={handleSave} disabled={saving || !name.trim() || pin.length !== 4} style={{
              flex: 2, padding: '12px 0', borderRadius: 9, border: 'none', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
              backgroundColor: (saving || !name.trim() || pin.length !== 4) ? 'rgba(201,168,76,0.3)' : GOLD,
              color: (saving || !name.trim() || pin.length !== 4) ? 'rgba(255,255,255,0.3)' : '#000',
              cursor: (saving || !name.trim() || pin.length !== 4) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}>
              {saving ? 'กำลังบันทึก...' : 'เพิ่มพนักงาน'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
