'use client'

import { useRef, useState } from 'react'
import type { TestModeStartResult } from '@/lib/test-mode'

const YELLOW = '#f59e0b'
const RED    = '#e05555'

const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Vientiane' })

export function TestModeBanner({ until, onDisable }: { until: number; onDisable: () => void }) {
  return (
    <div style={{
      backgroundColor: `${YELLOW}18`,
      border: `1px solid ${YELLOW}55`,
      borderRadius: 0,
      padding: '6px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14 }}>🧪</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: YELLOW, letterSpacing: '0.5px' }}>
          โหมดทดสอบ (เครื่องนี้) ถึง {fmtTime(until)} — บิลเป็น TEST ไม่นับยอดขาย ห้ามรับเงินจริง
        </span>
      </div>
      <button
        onClick={onDisable}
        style={{
          padding: '3px 12px', borderRadius: 6, border: `1px solid ${YELLOW}66`,
          backgroundColor: `${YELLOW}20`, color: YELLOW, fontSize: 11, fontWeight: 700,
          cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        ปิดโหมดทดสอบ
      </button>
    </div>
  )
}

export function TestModePinDialog({ onStart, onClose }: {
  onStart: (managerPin: string) => Promise<TestModeStartResult>
  onClose: () => void
}) {
  const [pin,     setPin]     = useState('')
  const [errMsg,  setErrMsg]  = useState('')
  const [loading, setLoading] = useState(false)
  const inFlight = useRef(false)

  async function submit() {
    if (inFlight.current) return
    if (pin.length !== 4) { setErrMsg('ใส่ PIN ผู้จัดการ 4 หลัก'); return }
    inFlight.current = true
    setLoading(true); setErrMsg('')
    const r = await onStart(pin)
    inFlight.current = false
    setLoading(false)
    if (r.ok) { onClose(); return }
    setErrMsg(r.error); setPin('')
  }

  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', backgroundColor: '#1a1a1a', color: '#fff', fontSize: 16, outline: 'none', boxSizing: 'border-box' }

  return (
    <div onClick={e => { if (e.target === e.currentTarget && !loading) onClose() }}
      onKeyDown={e => { if (e.key === 'Escape' && !loading) { e.nativeEvent.stopImmediatePropagation(); onClose() } }}
      style={{ position: 'fixed', inset: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form role="dialog" aria-label="เปิดโหมดทดสอบ" onSubmit={e => { e.preventDefault(); void submit() }}
        style={{ backgroundColor: '#111', border: `1px solid ${YELLOW}55`, borderRadius: 14, width: '100%', maxWidth: 360, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>เปิดโหมดทดสอบ 30 นาที</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4, lineHeight: 1.5 }}>
            บิลทดสอบไม่ตัดสต็อก ไม่เข้ายอดขาย แต่ขึ้นเป็นบรรทัดแยกในใบสรุปปิดกะ · ต้องใช้ PIN ผู้จัดการ (แจ้งเจ้าของร้าน)
          </div>
        </div>
        <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="PIN ผู้จัดการ" type="password" inputMode="numeric" autoComplete="off" autoFocus disabled={loading}
          style={{ ...input, letterSpacing: pin ? '0.4em' : undefined }} />
        {errMsg && <div role="alert" style={{ color: RED, fontSize: 13 }}>{errMsg}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onClose} disabled={loading}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: 14, cursor: 'pointer' }}>
            ยกเลิก
          </button>
          <button type="submit" disabled={loading}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', backgroundColor: YELLOW, color: '#111', fontSize: 14, fontWeight: 800, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'กำลังตรวจ...' : 'เปิดโหมดทดสอบ'}
          </button>
        </div>
      </form>
    </div>
  )
}
