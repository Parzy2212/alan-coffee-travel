'use client'

import { useEffect, useRef, useState } from 'react'

const GOLD = '#c9a84c'

const ACTIONS = [
  { icon: '🛒', label: 'เปิด POS',        href: '/pos'  },
  { icon: '➕', label: 'เพิ่มเมนู',        href: '/cafe' },
  { icon: '📦', label: 'บันทึกการซื้อ',   href: '/cafe' },
  { icon: '📊', label: 'ดูรายงาน',        href: '/cafe' },
]

const ANIM = `
@keyframes fab-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
`

export function QuickActionsFAB() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'fixed', bottom: 32, right: 32, zIndex: 900, display: 'flex', flexDirection: 'column-reverse', alignItems: 'flex-end', gap: 10 }}>
      <style>{ANIM}</style>

      {/* Main button */}
      <button
        onClick={() => setOpen(v => !v)}
        title="เมนูด่วน"
        style={{
          width: 52, height: 52, borderRadius: '50%', border: 'none',
          backgroundColor: open ? 'rgba(201,168,76,0.85)' : GOLD,
          color: '#000', fontSize: 24, fontWeight: 700,
          cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s, background-color 0.2s',
          transform: open ? 'rotate(45deg)' : 'none',
        }}
      >
        +
      </button>

      {/* Action items */}
      {open && ACTIONS.map((action, i) => (
        <a
          key={action.label}
          href={action.href}
          title={action.label}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 14px', borderRadius: 28, border: 'none',
            backgroundColor: '#1e1e1e', boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
            color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', whiteSpace: 'nowrap',
            animation: `fab-in 0.15s ease-out ${i * 0.04}s both`,
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#2a2a2a')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#1e1e1e')}
        >
          <span style={{ fontSize: 16 }}>{action.icon}</span>
          {action.label}
        </a>
      ))}
    </div>
  )
}
