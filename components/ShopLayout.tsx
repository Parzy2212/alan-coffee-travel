'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getInitials } from '@/lib/avatar'

const GOLD = '#c9a84c'

const NAV_ITEMS: { href: string; label: string; icon: string; soon?: boolean; dividerBefore?: boolean }[] = [
  { href: '/shop/settings',          label: 'ทั่วไป',        icon: '⚙️'  },
  { href: '/shop/settings/receipt',  label: 'ใบเสร็จ',       icon: '🧾'  },
  { href: '/shop/settings/payment',  label: 'วิธีชำระเงิน',  icon: '💳'  },
  { href: '/shop/settings/printer',  label: 'เครื่องพิมพ์',  icon: '🖨️'  },
  { href: '/shop/team',              label: 'ทีมงาน',        icon: '👥',  dividerBefore: true },
  { href: '/shop/team/employees',    label: 'พนักงาน POS',   icon: '🏷️'  },
  { href: '/shop/audit-log',         label: 'บันทึกระบบ',    icon: '📋',  dividerBefore: true },
  { href: '/shop/billing',           label: 'ค่าบริการ',     icon: '💰',  dividerBefore: true, soon: true },
]

const STYLES = `
  .shop-root {
    height: 100vh; display: flex; flex-direction: column;
    background: #0a0a0a; color: #fff;
    font-family: var(--font-body, Inter, sans-serif);
    overflow: hidden;
  }
  .shop-topbar {
    height: 56px; display: flex; align-items: center;
    justify-content: space-between; padding: 0 32px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }
  .shop-body { display: flex; flex: 1; min-height: 0; }
  .shop-sidebar {
    width: 220px; flex-shrink: 0;
    border-right: 1px solid rgba(255,255,255,0.06);
    padding: 20px 0; overflow-y: auto;
  }
  .shop-nav { display: flex; flex-direction: column; gap: 2px; padding: 0 12px; }
  .shop-nav-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 6px 2px; }
  .shop-nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; border-radius: 8px;
    text-decoration: none; color: rgba(255,255,255,0.4);
    font-size: 14px; font-weight: 400;
    border-left: 3px solid transparent;
    transition: color 0.15s, background-color 0.15s;
    width: 100%; box-sizing: border-box; cursor: pointer;
  }
  .shop-nav-item:not(.soon):hover {
    color: rgba(255,255,255,0.7);
    background-color: rgba(255,255,255,0.03);
  }
  .shop-nav-item.active {
    color: ${GOLD}; font-weight: 600;
    border-left-color: ${GOLD};
    background-color: rgba(201,168,76,0.06);
  }
  .shop-nav-item.soon { opacity: 0.45; cursor: default; pointer-events: none; }
  .shop-content { flex: 1; overflow-y: auto; padding: 40px 48px; }
  .shop-inner { max-width: 680px; width: 100%; }

  @media (max-width: 767px) {
    .shop-root { height: auto; overflow: visible; }
    .shop-topbar { padding: 0 16px; }
    .shop-body { flex-direction: column; min-height: auto; }
    .shop-sidebar {
      width: 100%; height: auto; overflow-x: auto; overflow-y: hidden;
      border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06);
      padding: 4px 0 0;
    }
    .shop-nav {
      flex-direction: row; gap: 0; padding: 0 12px;
      -webkit-overflow-scrolling: touch; scrollbar-width: none;
    }
    .shop-nav::-webkit-scrollbar { display: none; }
    .shop-nav-divider { display: none; }
    .shop-nav-item {
      border-left: none !important; border-bottom: 2px solid transparent;
      border-radius: 0; padding: 10px 12px;
      white-space: nowrap; background: none !important;
    }
    .shop-nav-item.active {
      border-left-color: transparent !important;
      border-bottom-color: ${GOLD} !important;
      background-color: transparent !important;
    }
    .shop-content { padding: 24px 16px; overflow-y: visible; }
  }
`

export function ShopLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div className="shop-root" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <style>{STYLES}</style>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>กำลังโหลด...</div>
      </div>
    )
  }

  const displayName = user.user_metadata?.full_name as string | undefined
  const email = user.email ?? ''
  const initials = getInitials(displayName ?? '', email)

  return (
    <div className="shop-root">
      <style>{STYLES}</style>

      {/* Top bar */}
      <div className="shop-topbar">
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
      <div className="shop-body">
        <div className="shop-sidebar">
          <nav className="shop-nav">
            {NAV_ITEMS.map(item => (
              <div key={item.href}>
                {item.dividerBefore && <div className="shop-nav-divider" />}
                <a
                  href={item.soon ? undefined : item.href}
                  className={[
                    'shop-nav-item',
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
              </div>
            ))}
          </nav>
        </div>

        <div className="shop-content">
          <div className="shop-inner">{children}</div>
        </div>
      </div>
    </div>
  )
}
