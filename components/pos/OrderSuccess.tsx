'use client'

import { useEffect, useRef, useState } from 'react'

const GOLD = '#c9a84c'

type Particle = {
  id: number; x: number; delay: number; color: string
  duration: number; size: number; rotation: number; wide: boolean
}

const COLORS = ['#c9a84c', '#c9a84c', '#ffd700', '#4cba7f', '#a0c4ff', '#fff', '#c9a84c']

function mkParticles(n: number): Particle[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 1.4,
    color: COLORS[i % COLORS.length],
    duration: 2.5 + Math.random() * 2.5,
    size: 5 + Math.random() * 8,
    rotation: Math.random() * 360,
    wide: i % 3 === 0,
  }))
}

const CSS = `
@keyframes _os_tick   { from{stroke-dashoffset:120;opacity:0} to{stroke-dashoffset:0;opacity:1} }
@keyframes _os_ring   { 0%{transform:scale(0);opacity:0} 55%{transform:scale(1.1)} to{transform:scale(1);opacity:1} }
@keyframes _os_in     { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:none} }
@keyframes _os_fall   { 0%{transform:translateY(-20px) rotate(var(--r));opacity:1} to{transform:translateY(110vh) rotate(calc(var(--r) + 720deg));opacity:0} }
@keyframes _os_blink  { 0%,100%{opacity:0.9} 50%{opacity:0.3} }
@media (prefers-reduced-motion:reduce){
  [data-os]{animation:none!important;stroke-dashoffset:0!important;opacity:1!important}
}
`

export interface OrderSuccessProps {
  queue: number
  total: number
  onDismiss: () => void
}

export function OrderSuccess({ queue, total, onDismiss }: OrderSuccessProps) {
  const [count, setCount] = useState(3)
  const particles = useRef(mkParticles(52)).current

  useEffect(() => {
    const t = setInterval(() => {
      setCount(n => {
        if (n <= 1) { clearInterval(t); onDismiss(); return 0 }
        return n - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [onDismiss])

  return (
    <div
      role="alertdialog"
      aria-live="polite"
      aria-label="ออเดอร์สำเร็จ"
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        backgroundColor: '#0a0a0a',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <style>{CSS}</style>

      {/* confetti */}
      {particles.map(p => (
        <div
          key={p.id}
          aria-hidden="true"
          data-os="confetti"
          style={{
            position: 'absolute', top: 0,
            left: `${p.x}%`,
            width: p.wide ? p.size * 2.2 : p.size,
            height: p.wide ? p.size * 0.45 : p.size,
            backgroundColor: p.color,
            borderRadius: p.id % 4 === 0 ? '50%' : 2,
            animation: `_os_fall ${p.duration}s ${p.delay}s ease-in forwards`,
            ['--r' as string]: `${p.rotation}deg`,
            opacity: 0,
          }}
        />
      ))}

      {/* animated tick */}
      <div
        data-os="ring"
        style={{
          marginBottom: 36,
          animation: '_os_ring 0.65s cubic-bezier(0.175,0.885,0.32,1.275) forwards',
          opacity: 0,
        }}
      >
        <svg width={108} height={108} viewBox="0 0 108 108" aria-hidden="true">
          <circle cx={54} cy={54} r={50} fill="rgba(201,168,76,0.07)" stroke="rgba(201,168,76,0.18)" strokeWidth={2} />
          <polyline
            data-os="tick"
            points="32,54 47,69 76,37"
            fill="none"
            stroke={GOLD}
            strokeWidth={5.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={120}
            strokeDashoffset={120}
            style={{ animation: '_os_tick 0.5s 0.5s cubic-bezier(0.4,0,0.2,1) forwards' }}
          />
        </svg>
      </div>

      {/* text content */}
      <div
        data-os="text"
        style={{ textAlign: 'center', animation: '_os_in 0.5s 0.2s both' }}
      >
        <div style={{
          fontSize: 26, fontWeight: 900, color: '#fff',
          marginBottom: 16, fontFamily: 'var(--font-heading)',
          letterSpacing: '-0.5px',
        }}>
          ออเดอร์สำเร็จ!
        </div>
        <div style={{
          fontSize: 88, fontWeight: 900, color: GOLD, lineHeight: 1,
          fontFamily: 'var(--font-heading)', letterSpacing: '-3px',
          marginBottom: 16, fontVariantNumeric: 'tabular-nums',
        }}>
          #{String(queue).padStart(3, '0')}
        </div>
        <div style={{
          fontSize: 22, color: 'rgba(255,255,255,0.4)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {total.toLocaleString('en-US')} ₭
        </div>
      </div>

      {/* actions */}
      <div
        data-os="actions"
        style={{
          marginTop: 52,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 16,
          animation: '_os_in 0.5s 0.5s both',
        }}
      >
        <div style={{
          fontSize: 13, color: 'rgba(255,255,255,0.25)',
          animation: '_os_blink 1.2s ease-in-out infinite',
        }}>
          อัตโนมัติกลับใน {count} วินาที...
        </div>
        <button
          onClick={onDismiss}
          aria-label="ทำออเดอร์ใหม่"
          style={{
            padding: '15px 40px', borderRadius: 14,
            border: `1px solid rgba(201,168,76,0.3)`,
            backgroundColor: 'rgba(201,168,76,0.1)',
            color: GOLD, fontSize: 16, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'var(--font-heading)',
            letterSpacing: '0.5px', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(201,168,76,0.2)'; e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(201,168,76,0.1)'; e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)' }}
        >
          ทำออเดอร์ใหม่ →
        </button>
      </div>
    </div>
  )
}
