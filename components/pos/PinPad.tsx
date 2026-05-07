'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { verifyEmployeePin } from '@/lib/employee-pin'
import type { ActiveEmployee } from '@/lib/active-employee'

const GOLD = '#c9a84c'
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

const NUMPAD = ['1','2','3','4','5','6','7','8','9','','0','⌫'] as const

export function PinPad({ shopId, onClockIn }: PinPadProps) {
  const [pin, setPin]         = useState('')
  const [status, setStatus]   = useState<PadStatus>('idle')
  const [greeting, setGreeting] = useState('')
  const [shake, setShake]     = useState(false)
  const submitLock            = useRef(false)

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

      {/* Logo */}
      <div style={{ marginBottom: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}>
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
    </div>
  )
}
