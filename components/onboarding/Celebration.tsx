'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  shopName: string
  menuCount: number
  printerSetup: boolean
  onDone: () => void
  saving: boolean
  error: string | null
  onRetry: () => void
}

const ACTION_CARDS = [
  { href: '/pos',  icon: '☕', label: 'เปิด POS ขายเลย' },
  { href: '/cafe', icon: '📋', label: 'เพิ่มเมนูเพิ่มเติม' },
]

export function Celebration({ shopName, menuCount, printerSetup, onDone, saving, error, onRetry }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!prefersReduced) {
      import('@/lib/confetti').then(({ launchConfetti }) => {
        if (canvasRef.current) {
          cleanupRef.current = launchConfetti(canvasRef.current, 1500)
        }
      })
    }

    // Stagger the check items in
    const t1 = setTimeout(() => setPhase(1), prefersReduced ? 0 : 800)
    const t2 = setTimeout(() => setPhase(2), prefersReduced ? 0 : 1100)
    const t3 = setTimeout(() => setPhase(3), prefersReduced ? 0 : 1400)

    return () => {
      cleanupRef.current?.()
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3)
    }
  }, [])

  const checks = [
    { label: 'ข้อมูลร้านค้าพร้อมแล้ว',      show: phase >= 1 },
    { label: menuCount > 0 ? `เมนู ${menuCount} รายการ` : 'ข้ามเมนู — เพิ่มได้ทีหลัง', show: phase >= 2 },
    { label: printerSetup ? 'เครื่องพิมพ์พร้อมใช้' : 'ระบบพร้อมทำงาน', show: phase >= 3 },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px', maxWidth: 480, margin: '0 auto', width: '100%', position: 'relative' }}>

      {/* Confetti canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
      />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', textAlign: 'center' }}>

        {/* Big gold checkmark */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          backgroundColor: 'rgba(201,168,76,0.12)',
          border: '2px solid rgba(201,168,76,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
          animation: 'celebCheck 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        }}>
          <span style={{ fontSize: 32, lineHeight: 1 }}>✓</span>
        </div>

        {/* Headline */}
        <h2 style={{
          color: 'white', fontWeight: 800, fontSize: 26,
          fontFamily: 'var(--font-heading)', marginBottom: 6, lineHeight: 1.2,
        }}>
          ร้าน{' '}
          <span style={{ color: '#c9a84c' }}>{shopName || 'Alan Coffee'}</span>
          <br />พร้อมขายแล้ว! ☕
        </h2>

        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 28, lineHeight: 1.5 }}>
          คุณได้ตั้งค่าสำเร็จแล้ว:
        </p>

        {/* Animated checklist */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 10,
          marginBottom: 32, textAlign: 'left',
        }}>
          {checks.map((c, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                opacity: c.show ? 1 : 0,
                transform: c.show ? 'translateY(0)' : 'translateY(6px)',
                transition: 'opacity 0.35s ease-out, transform 0.35s ease-out',
                padding: '11px 16px',
                backgroundColor: 'rgba(76,186,127,0.06)',
                border: '1px solid rgba(76,186,127,0.12)',
                borderRadius: 10,
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                backgroundColor: '#4cba7f',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ color: '#000', fontSize: 12, fontWeight: 800 }}>✓</span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15 }}>{c.label}</span>
            </div>
          ))}
        </div>

        {/* Action cards */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {ACTION_CARDS.map(card => (
            <a
              key={card.href}
              href={card.href}
              style={{
                flex: 1, padding: '16px 12px', textAlign: 'center',
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12, textDecoration: 'none',
                transition: 'border-color 0.15s, background-color 0.15s',
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 6, lineHeight: 1 }}>{card.icon}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
                {card.label}
              </div>
            </a>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div style={{
            padding: '14px 16px', marginBottom: 16,
            backgroundColor: 'rgba(255,77,77,0.08)',
            border: '1px solid rgba(255,77,77,0.2)',
            borderRadius: 10, textAlign: 'left',
          }}>
            <div style={{ color: 'rgba(255,120,120,0.9)', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              เกิดข้อผิดพลาด
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{error}</div>
          </div>
        )}

        {/* Primary CTA */}
        <button
          onClick={error ? onRetry : onDone}
          disabled={saving}
          style={{
            width: '100%', padding: '15px',
            backgroundColor: saving ? 'rgba(201,168,76,0.4)' : '#c9a84c',
            color: '#000', border: 'none', borderRadius: 12,
            fontSize: 16, fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
            fontFamily: 'inherit', marginBottom: 16,
            transition: 'background-color 0.15s',
          }}
        >
          {saving ? 'กำลังบันทึก...' : error ? '↺ ลองใหม่' : '→ ไปที่แดชบอร์ด'}
        </button>

        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
          Alan จะช่วยเสมอถ้าคุณต้องการ 💛
        </div>
      </div>
    </div>
  )
}
