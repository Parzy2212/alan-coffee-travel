'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { verifyEmployeePin } from '@/lib/employee-pin'
import type { ActiveEmployee } from '@/lib/active-employee'

const GOLD = '#c9a84c'
const RED  = '#ff6b6b'
const PIN_LENGTH = 4

const SHAKE_CSS = `
@keyframes pinShake {
  0%,100% { transform: translateX(0); }
  15%      { transform: translateX(-8px); }
  30%      { transform: translateX(8px); }
  45%      { transform: translateX(-6px); }
  60%      { transform: translateX(6px); }
  75%      { transform: translateX(-3px); }
  90%      { transform: translateX(3px); }
}
@keyframes pinSuccess {
  0%   { background: rgba(76,186,127,0);  }
  30%  { background: rgba(76,186,127,0.25); }
  100% { background: rgba(76,186,127,0);  }
}
`

interface PinPadProps {
  shopId: string
  onClockIn: (emp: ActiveEmployee) => void
}

type PadStatus = 'idle' | 'checking' | 'error' | 'success'
type RecoveryState = 'closed' | 'owner' | 'master' | 'success'

const NUMPAD = ['1','2','3','4','5','6','7','8','9','','0','⌫'] as const

export function PinPad({ shopId, onClockIn }: PinPadProps) {
  const [pin, setPin]         = useState('')
  const [status, setStatus]   = useState<PadStatus>('idle')
  const [greeting, setGreeting] = useState('')
  const [shake, setShake]     = useState(false)
  const submitLock            = useRef(false)

  // Forgot PIN / master PIN recovery
  const [recovery, setRecovery]     = useState<RecoveryState>('closed')
  const [recEmail, setRecEmail]     = useState('')
  const [recPass,  setRecPass]      = useState('')
  const [recErr,   setRecErr]       = useState('')
  const [recBusy,  setRecBusy]      = useState(false)
  const [newPin,   setNewPin]       = useState('')
  const [masterInput, setMasterInput] = useState('')
  // Hidden gesture: tap logo 5× to reveal master PIN entry
  const logoTaps  = useRef(0)
  const logoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleKey = useCallback((key: string) => {
    if (status === 'checking' || status === 'success') return
    if (key === '⌫') {
      setPin(p => p.slice(0, -1))
      if (status === 'error') setStatus('idle')
      return
    }
    if (!/^[0-9]$/.test(key)) return
    setPin(p => {
      const next = p.length < PIN_LENGTH ? p + key : p
      return next
    })
    if (status === 'error') setStatus('idle')
  }, [status])

  // Physical keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') handleKey('⌫')
      else if (/^[0-9]$/.test(e.key)) handleKey(e.key)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleKey])

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length !== PIN_LENGTH || submitLock.current) return
    submitLock.current = true

    const verify = async () => {
      setStatus('checking')
      const emp = await verifyEmployeePin(shopId, pin)
      if (!emp) {
        setStatus('error')
        setShake(true)
        setTimeout(() => setShake(false), 600)
        setTimeout(() => { setPin(''); setStatus('idle') }, 800)
        submitLock.current = false
        return
      }

      setStatus('success')
      setGreeting(`สวัสดี ${emp.name}!`)

      const { supabase } = await import('@/lib/supabase')
      const { data: shiftData } = await supabase
        .from('employee_shifts')
        .insert({ shop_id: shopId, employee_id: emp.id })
        .select('id')
        .single()

      setTimeout(() => {
        onClockIn({
          id:          emp.id,
          name:        emp.name,
          role:        emp.role,
          shiftId:     shiftData?.id ?? '',
          clockedInAt: new Date().toISOString(),
          shopId,
        })
        submitLock.current = false
      }, 1200)
    }

    verify()
  }, [pin, shopId, onClockIn])

  function handleLogoTap() {
    logoTaps.current += 1
    if (logoTimer.current) clearTimeout(logoTimer.current)
    logoTimer.current = setTimeout(() => { logoTaps.current = 0 }, 2000)
    if (logoTaps.current >= 5) {
      logoTaps.current = 0
      setRecovery('master')
      setMasterInput('')
      setRecErr('')
    }
  }

  async function handleOwnerReset() {
    if (!recEmail.trim() || !recPass) { setRecErr('กรุณาใส่อีเมลและรหัสผ่าน'); return }
    setRecBusy(true); setRecErr('')
    try {
      const res = await fetch('/api/pos/reset-pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recEmail.trim(), password: recPass }),
      })
      const json = await res.json() as { ok?: boolean; newPin?: string; error?: string }
      if (!res.ok || !json.ok) { setRecErr(json.error ?? 'เกิดข้อผิดพลาด'); return }
      setNewPin(json.newPin ?? '1234')
      setRecovery('success')
    } catch { setRecErr('ไม่สามารถเชื่อมต่อได้') } finally { setRecBusy(false) }
  }

  async function handleMasterPin() {
    if (!masterInput) { setRecErr('กรุณาใส่ Master PIN'); return }
    setRecBusy(true); setRecErr('')
    try {
      const res = await fetch('/api/pos/verify-master-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: masterInput }),
      })
      const json = await res.json() as { ok?: boolean }
      if (!res.ok || !json.ok) { setRecErr('Master PIN ไม่ถูกต้อง'); return }
      setRecovery('closed')
      onClockIn({ id: 'master-override', name: 'Manager', role: 'manager', shiftId: '', clockedInAt: new Date().toISOString(), shopId })
    } catch { setRecErr('ไม่สามารถเชื่อมต่อได้') } finally { setRecBusy(false) }
  }

  const dots = Array.from({ length: PIN_LENGTH }, (_, i) => i < pin.length)

  const dotColor = status === 'error'   ? '#ff6b6b'
                 : status === 'success' ? '#4cba7f'
                 : GOLD

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: '#000',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-body, Inter, sans-serif)',
    }}>
      <style>{SHAKE_CSS}</style>

      {/* Success flash overlay */}
      {status === 'success' && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          animation: 'pinSuccess 1.2s ease forwards',
        }} />
      )}

      {/* Logo — tap 5× to access master PIN */}
      <div style={{ marginBottom: 48, textAlign: 'center' }}>
        <div
          onClick={handleLogoTap}
          style={{ fontSize: 22, fontWeight: 800, color: 'white', letterSpacing: '-0.5px', cursor: 'default', userSelect: 'none' }}
        >
          ALAN <span style={{ color: GOLD }}>Cafe OS</span>
        </div>
      </div>

      {/* Heading */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        {status === 'success' ? (
          <>
            <div style={{ fontSize: 36, marginBottom: 10 }}>👋</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#4cba7f' }}>{greeting}</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 8 }}>ยินดีต้อนรับ</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>กรุณาใส่ PIN เพื่อเริ่มทำงาน</div>
          </>
        )}
      </div>

      {/* PIN dots */}
      <div
        style={{
          display: 'flex', gap: 16, marginBottom: 36,
          animation: shake ? 'pinShake 0.55s ease' : 'none',
        }}
      >
        {dots.map((filled, i) => (
          <div key={i} style={{
            width: 18, height: 18, borderRadius: '50%',
            backgroundColor: filled ? dotColor : 'transparent',
            border: `2px solid ${filled ? dotColor : 'rgba(255,255,255,0.2)'}`,
            transition: 'all 0.12s',
            boxShadow: filled ? `0 0 10px ${dotColor}66` : 'none',
          }} />
        ))}
      </div>

      {/* Error message */}
      {status === 'error' && (
        <div style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 20, fontWeight: 600 }}>
          PIN ไม่ถูกต้อง
        </div>
      )}

      {/* Numpad */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 80px)',
        gap: 10,
      }}>
        {NUMPAD.map((key, i) => {
          const isEmpty = key === ''
          const isBackspace = key === '⌫'
          const disabled = status === 'checking' || status === 'success'

          return (
            <button
              key={i}
              onClick={() => !isEmpty && handleKey(key)}
              disabled={disabled || isEmpty}
              style={{
                width: 80, height: 80, borderRadius: 14,
                backgroundColor: isEmpty ? 'transparent' : isBackspace
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(255,255,255,0.07)',
                border: isEmpty ? 'none' : '1px solid rgba(255,255,255,0.08)',
                color: isBackspace ? 'rgba(255,255,255,0.5)' : 'white',
                fontSize: isBackspace ? 20 : 24,
                fontWeight: isBackspace ? 400 : 600,
                cursor: (disabled || isEmpty) ? 'default' : 'pointer',
                fontFamily: 'inherit',
                transition: 'background-color 0.1s, transform 0.08s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
                userSelect: 'none',
              }}
              onMouseDown={e => {
                if (!isEmpty && !disabled) e.currentTarget.style.backgroundColor =
                  isBackspace ? 'rgba(255,255,255,0.08)' : `rgba(201,168,76,0.18)`
              }}
              onMouseUp={e => {
                e.currentTarget.style.backgroundColor =
                  isEmpty ? 'transparent' : isBackspace
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(255,255,255,0.07)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor =
                  isEmpty ? 'transparent' : isBackspace
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(255,255,255,0.07)'
              }}
            >
              {key}
            </button>
          )
        })}
      </div>

      {/* Checking indicator */}
      {status === 'checking' && (
        <div style={{ marginTop: 20, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
          กำลังตรวจสอบ...
        </div>
      )}

      {/* Forgot PIN */}
      {status !== 'success' && (
        <button
          onClick={() => { setRecovery('owner'); setRecEmail(''); setRecPass(''); setRecErr('') }}
          style={{
            marginTop: 28, background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.22)', fontSize: 12, cursor: 'pointer',
            fontFamily: 'inherit', letterSpacing: '0.3px',
          }}
        >
          ลืม PIN?
        </button>
      )}

      {/* ── Recovery modal ── */}
      {recovery !== 'closed' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: 28, width: '100%', maxWidth: 380,
            fontFamily: 'inherit',
          }}>

            {recovery === 'owner' && (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 6 }}>รีเซ็ต PIN พนักงาน</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20, lineHeight: 1.6 }}>
                  ยืนยันตัวตนด้วยอีเมลและรหัสผ่านของเจ้าของร้าน<br />
                  PIN พนักงานทุกคนจะถูกรีเซ็ตเป็น <strong style={{ color: GOLD }}>1234</strong>
                </div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>อีเมล</label>
                <input
                  type="email"
                  value={recEmail}
                  onChange={e => setRecEmail(e.target.value)}
                  placeholder="owner@email.com"
                  style={{ width: '100%', marginBottom: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>รหัสผ่าน</label>
                <input
                  type="password"
                  value={recPass}
                  onChange={e => setRecPass(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleOwnerReset() }}
                  placeholder="••••••••"
                  style={{ width: '100%', marginBottom: 16, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
                {recErr && <div style={{ color: RED, fontSize: 12, marginBottom: 12, fontWeight: 600 }}>{recErr}</div>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setRecovery('closed')} style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button>
                  <button onClick={handleOwnerReset} disabled={recBusy} style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: 'none', backgroundColor: recBusy ? `${GOLD}55` : GOLD, color: '#000', fontSize: 14, fontWeight: 700, cursor: recBusy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                    {recBusy ? 'กำลังรีเซ็ต...' : 'รีเซ็ต PIN'}
                  </button>
                </div>
              </>
            )}

            {recovery === 'master' && (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 6 }}>Manager Override</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>ใส่ Master PIN เพื่อเข้าใช้งาน</div>
                <input
                  type="password"
                  value={masterInput}
                  onChange={e => setMasterInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleMasterPin() }}
                  placeholder="Master PIN"
                  autoFocus
                  style={{ width: '100%', marginBottom: 16, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
                {recErr && <div style={{ color: RED, fontSize: 12, marginBottom: 12, fontWeight: 600 }}>{recErr}</div>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setRecovery('closed')} style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button>
                  <button onClick={handleMasterPin} disabled={recBusy} style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: 'none', backgroundColor: recBusy ? `${GOLD}55` : GOLD, color: '#000', fontSize: 14, fontWeight: 700, cursor: recBusy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                    {recBusy ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
                  </button>
                </div>
              </>
            )}

            {recovery === 'success' && (
              <>
                <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>✓</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#4cba7f', textAlign: 'center', marginBottom: 8 }}>รีเซ็ต PIN สำเร็จ</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.7, marginBottom: 20 }}>
                  PIN ใหม่ของพนักงานทุกคน:<br />
                  <span style={{ fontSize: 32, fontWeight: 800, color: GOLD, letterSpacing: 6 }}>{newPin}</span><br />
                  <span style={{ fontSize: 12 }}>กรุณาเปลี่ยน PIN ทันทีหลังเข้าสู่ระบบ</span>
                </div>
                <button
                  onClick={() => setRecovery('closed')}
                  style={{ width: '100%', padding: '13px 0', borderRadius: 9, border: 'none', backgroundColor: GOLD, color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  ปิดและเข้าสู่ระบบด้วย {newPin}
                </button>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
