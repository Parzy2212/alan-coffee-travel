'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getInitials } from '@/lib/avatar'
import { AppNav } from '@/components/AppNav'

const GOLD = '#c9a84c'


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
    scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent;
  }
  .shop-menu-btn { display: none; }
  .shop-content { flex: 1; overflow-y: auto; padding: 40px 48px; }
  .shop-inner { max-width: 680px; width: 100%; }

  @media (max-width: 767px) {
    .shop-root { height: auto; overflow: visible; }
    .shop-topbar { padding: 0 16px; }
    .shop-body { flex-direction: column; min-height: auto; }
    .shop-sidebar { display: none; width: 100%; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); padding: 8px 0 12px; }
    .shop-sidebar.open { display: block; }
    .shop-menu-btn {
      display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.12); background: transparent; color: rgba(255,255,255,0.7);
      font-size: 13px; font-family: inherit; cursor: pointer;
    }
    .shop-content { padding: 24px 16px; overflow-y: visible; }
  }
`

export function ShopLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

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
        <button type="button" className="shop-menu-btn" aria-expanded={menuOpen} aria-controls="shop-sidebar" onClick={() => setMenuOpen(o => !o)}>
          ☰ เมนู
        </button>
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
        <div id="shop-sidebar" className={menuOpen ? 'shop-sidebar open' : 'shop-sidebar'}>
          <AppNav />
        </div>

        <div className="shop-content">
          <div className="shop-inner">{children}</div>
        </div>
      </div>
    </div>
  )
}
