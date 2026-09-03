'use client'

import { CurrencySection } from '@/components/shop/CurrencySection'

export function CurrencyClient() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#fff', fontFamily: 'var(--font-body, Inter, sans-serif)' }}>
      <header style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', gap: 16 }}>
        <a href="/shop/settings" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: 13 }}>← Settings</a>
        <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>Currency Display</span>
      </header>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 20px' }}>
        <CurrencySection />
      </div>
    </div>
  )
}
