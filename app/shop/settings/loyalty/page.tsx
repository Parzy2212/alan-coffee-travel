import { MovedNotice } from '@/components/shop/MovedNotice'

export const metadata = { title: 'Loyalty — Alan Cafe OS' }

// Hidden until loyalty works end to end (2026-11-11); components/shop/LoyaltySection.tsx is kept for that.
export default function LoyaltySettingsPage() {
  return (
    <MovedNotice
      title="ยังไม่เปิดใช้งาน"
      reason="ระบบสะสมแต้มยังไม่พร้อมใช้ ปิดไว้ก่อน"
      links={[{ href: '/cafe?tab=settings', label: 'ตั้งค่าร้าน' }]}
    />
  )
}
