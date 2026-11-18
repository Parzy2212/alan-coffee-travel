import { LoyaltySection } from '@/components/shop/LoyaltySection'

export const metadata = { title: 'VIP Discount — Alan Cafe OS' }

export default function LoyaltySettingsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>ส่วนลด VIP</div>
      <LoyaltySection />
    </div>
  )
}
