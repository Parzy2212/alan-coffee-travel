'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  onComplete: () => void
}

export function WelcomeSplash({ onComplete }: Props) {
  const [logoVisible, setLogoVisible] = useState(false)
  const [textVisible, setTextVisible] = useState(false)
  const [barWidth, setBarWidth] = useState(0)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number>(0)
  const FILL_DURATION = 2500

  useEffect(() => {
    const t1 = setTimeout(() => setLogoVisible(true), 100)
    const t2 = setTimeout(() => setTextVisible(true), 500)
    const t3 = setTimeout(onComplete, 3200)

    const startBar = setTimeout(() => {
      const animate = (ts: number) => {
        if (!startRef.current) startRef.current = ts
        const pct = Math.min((ts - startRef.current) / FILL_DURATION, 1)
        setBarWidth(pct * 100)
        if (pct < 1) rafRef.current = requestAnimationFrame(animate)
      }
      rafRef.current = requestAnimationFrame(animate)
    }, 600)

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(startBar)
      cancelAnimationFrame(rafRef.current)
    }
  }, [onComplete])

  return (
    <div
      onClick={onComplete}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', cursor: 'pointer', userSelect: 'none',
        padding: '0 20px',
      }}
    >
      {/* Logo */}
      <div style={{
        opacity: logoVisible ? 1 : 0,
        transform: `scale(${logoVisible ? 1 : 0.85})`,
        transition: 'opacity 0.5s ease-out, transform 0.5s ease-out',
        textAlign: 'center',
        marginBottom: 28,
      }}>
        <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 12 }}>☕</div>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 30, color: '#c9a84c', letterSpacing: '-0.5px' }}>
          ALAN{' '}
          <span style={{ color: 'rgba(201,168,76,0.45)', fontSize: 13, letterSpacing: '3px', fontWeight: 600 }}>
            CafeOS
          </span>
        </div>
      </div>

      {/* Text */}
      <div style={{
        opacity: textVisible ? 1 : 0,
        transform: textVisible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
        textAlign: 'center',
        marginBottom: 44,
      }}>
        <div style={{ color: 'white', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>ยินดีต้อนรับ</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>กำลังเตรียมระบบสำหรับคุณ…</div>
      </div>

      {/* Progress bar */}
      <div style={{ width: 200, height: 4, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 99, backgroundColor: '#c9a84c', width: `${barWidth}%` }} />
      </div>

      <div style={{ marginTop: 18, color: 'rgba(255,255,255,0.2)', fontSize: 11, letterSpacing: '0.5px' }}>
        แตะเพื่อข้าม
      </div>
    </div>
  )
}
