'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getInitials } from '@/lib/avatar'

const GOLD = '#c9a84c'
const DARK = '#111'

interface MenuItem {
  label: string
  href: string
  icon: string
}

const PERSONAL_ITEMS: MenuItem[] = [
  { label: 'โปรไฟล์', href: '/account/profile', icon: '👤' },
  { label: 'ความปลอดภัย', href: '/account/security', icon: '🔒' },
]

const SHOP_ITEMS: MenuItem[] = [
  { label: 'ตั้งค่าร้าน', href: '/shop/settings', icon: '⚙️' },
  { label: 'ทีมงาน', href: '/shop/team', icon: '👥' },
]

export function AvatarDropdown({ solo = false }: { solo?: boolean }) {
  const { user, signOut } = useAuth()
  const shopItems = solo ? SHOP_ITEMS.filter(i => i.href !== '/shop/team') : SHOP_ITEMS
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const displayName = user?.user_metadata?.full_name as string | undefined
  const email = user?.email ?? ''
  const initials = getInitials(displayName ?? '', email)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [open])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await signOut()
      router.replace('/')
    } finally {
      setLoggingOut(false)
    }
  }

  if (!user) return null

  return (
    <div ref={wrapperRef} style={{ position: 'relative', padding: '12px 16px' }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '10px 12px',
          backgroundColor: open ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${open ? 'rgba(201,168,76,0.35)' : 'rgba(255,255,255,0.07)'}`,
          borderRadius: 10, cursor: 'pointer', textAlign: 'left',
          transition: 'all 0.15s', fontFamily: 'inherit',
        }}
      >
        {/* Avatar circle */}
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          backgroundColor: 'rgba(201,168,76,0.2)',
          border: `1.5px solid rgba(201,168,76,0.5)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: GOLD, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>{initials}</span>
        </div>
        {/* Name + email */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {displayName && (
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
          )}
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2, marginTop: displayName ? 2 : 0 }}>
            {email}
          </div>
        </div>
        {/* Chevron */}
        <span style={{
          color: 'rgba(255,255,255,0.25)', fontSize: 10, flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.18s',
        }}>▲</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% - 4px)', left: 16, right: 16,
          backgroundColor: '#1a1a1a',
          border: '1px solid rgba(201,168,76,0.2)',
          borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
          zIndex: 100,
          animation: 'avatarDrop 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
        }}>
          <style>{`
            @keyframes avatarDrop {
              from { opacity: 0; transform: translateY(8px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {/* Header */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>
              {displayName || email}
            </div>
            {displayName && (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>{email}</div>
            )}
          </div>

          {/* Personal section */}
          <div style={{ padding: '6px 0' }}>
            <div style={{ padding: '4px 14px', fontSize: 9, color: `${GOLD}66`, textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600 }}>
              บัญชีส่วนตัว
            </div>
            {PERSONAL_ITEMS.map(item => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 14px', textDecoration: 'none',
                  color: 'rgba(255,255,255,0.65)', fontSize: 13,
                  transition: 'background-color 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ fontSize: 13, width: 18, textAlign: 'center' }}>{item.icon}</span>
                {item.label}
              </a>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', margin: '2px 0' }} />

          {/* Shop section */}
          <div style={{ padding: '6px 0' }}>
            <div style={{ padding: '4px 14px', fontSize: 9, color: `${GOLD}66`, textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600 }}>
              ร้านค้า
            </div>
            {shopItems.map(item => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 14px', textDecoration: 'none',
                  color: 'rgba(255,255,255,0.65)', fontSize: 13,
                  transition: 'background-color 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ fontSize: 13, width: 18, textAlign: 'center' }}>{item.icon}</span>
                {item.label}
              </a>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', margin: '2px 0' }} />

          {/* Logout */}
          <div style={{ padding: '6px 0 8px' }}>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '8px 14px',
                backgroundColor: 'transparent', border: 'none',
                color: loggingOut ? 'rgba(255,100,100,0.4)' : 'rgba(255,100,100,0.8)',
                fontSize: 13, cursor: loggingOut ? 'wait' : 'pointer',
                fontFamily: 'inherit', textAlign: 'left',
                transition: 'background-color 0.1s',
              }}
              onMouseEnter={e => !loggingOut && (e.currentTarget.style.backgroundColor = 'rgba(255,77,77,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span style={{ fontSize: 13, width: 18, textAlign: 'center' }}>→</span>
              {loggingOut ? 'กำลังออก...' : 'ออกจากระบบ'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
