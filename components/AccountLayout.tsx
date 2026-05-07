'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getInitials } from '@/lib/avatar'

const GOLD = '#c9a84c'

const NAV_ITEMS = [
  { href: '/account/profile',       label: 'โปรไฟล์',     icon: '👤' },
  { href: '/account/security',      label: 'ความปลอดภัย', icon: '🔒' },
  { href: '/account/notifications', label: 'การแจ้งเตือน', icon: '🔔', soon: true },
]

const STYLES = `
  .acct-root {
    height: 100vh; display: flex; flex-direction: column;
    background: #0a0a0a; color: #fff;
    font-family: var(--font-body, Inter, sans-serif);
    overflow: hidden;
  }
  .acct-topbar {
    height: 56px; display: flex; align-items: center;
    justify-content: space-between; padding: 0 32px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }
  .acct-body { display: flex; flex: 1; min-height: 0; }
  .acct-sidebar {
    width: 220px; flex-shrink: 0;
    border-right: 1px solid rgba(255,255,255,0.06);
    padding: 28px 0; overflow-y: auto;
  }
  .acct-nav { display: flex; flex-direction: column; gap: 2px; padding: 0 12px; }
  .acct-nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; border-radius: 8px;
    text-decoration: none; color: rgba(255,255,255,0.4);
    font-size: 14px; font-weight: 400;
    border-left: 3px solid transparent;
    transition: color 0.15s, background-color 0.15s;
    width: 100%; box-sizing: border-box; cursor: pointer;
  }
  .acct-nav-item:not(.soon):hover {
    color: rgba(255,255,255,0.7);
    background-color: rgba(255,255,255,0.03);
  }
  .acct-nav-item.active {
    color: ${GOLD}; font-weight: 600;
    border-left-color: ${GOLD};
    background-color: rgba(201,168,76,0.06);
  }
  .acct-nav-item.soon { opacity: 0.45; cursor: default; pointer-events: none; }
  .acct-content { flex: 1; overflow-y: auto; padding: 40px 48px; }
  .acct-inner { max-width: 680px; width: 100%; }

  @media (max-width: 767px) {
    .acct-root { height: auto; overflow: visible; }
    .acct-topbar { padding: 0 16px; }
    .acct-body { flex-direction: column; min-height: auto; }
    .acct-sidebar {
      width: 100%; height: auto; overflow-x: auto; overflow-y: hidden;
      border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06);
      padding: 4px 0 0;
    }
    .acct-nav {
      flex-direction: row; gap: 0; padding: 0 12px;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .acct-nav::-webkit-scrollbar { display: none; }
    .acct-nav-item {
      border-left: none !important; border-bottom: 2px solid transparent;
      border-radius: 0; padding: 10px 14px;
      white-space: nowrap; background: none !important;
    }
    .acct-nav-item.active {
      border-left-color: transparent !important;
      border-bottom-color: ${GOLD} !important;
      background-color: transparent !important;
    }
    .acct-content { padding: 24px 16px; overflow-y: visible; }
  }
`

interface Props {
  children: ReactNode
}

export function AccountLayout({ children }: Props) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div className="acct-root" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <style>{STYLES}</style>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>กำลังโหลด...</div>
      </div>
    )
  }

  const displayName = user.user_metadata?.full_name as string | undefined
  const email = user.email ?? ''
  const initials = getInitials(displayName ?? '', email)

  return (
    <div className="acct-root">
      <style>{STYLES}</style>

      {/* Top bar */}
      <div className="acct-topbar">
        <a
          href="/cafe"
          style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, textDecoration: 'none', transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
        >
          &larr; แดชบอร์ด
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {email}
          </span>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            backgroundColor: 'rgba(201,168,76,0.15)',
            border: '1.5px solid rgba(201,168,76,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: GOLD, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>{initials}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="acct-body">
        {/* Sidebar */}
        <div className="acct-sidebar">
          <nav className="acct-nav">
            {NAV_ITEMS.map(item => (
              <a
                key={item.href}
                href={item.soon ? undefined : item.href}
                className={[
                  'acct-nav-item',
                  pathname === item.href ? 'active' : '',
                  item.soon ? 'soon' : '',
                ].filter(Boolean).join(' ')}
              >
                <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.soon && (
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', padding: '2px 6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4 }}>
                    เร็วๆ นี้
                  </span>
                )}
              </a>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="acct-content">
          <div className="acct-inner">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
