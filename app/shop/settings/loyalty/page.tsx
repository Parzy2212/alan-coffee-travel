'use client'

import { LoyaltySection } from '@/components/shop/LoyaltySection'

export default function LoyaltySettingsPage() {
  return (
    <div style={{ maxWidth: 580, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>โปรแกรมสะสมแต้ม</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>ตั้งค่าระบบ Loyalty Points และสิทธิพิเศษ VIP</div>
      </div>
      <LoyaltySection />
    </div>
  )
}
