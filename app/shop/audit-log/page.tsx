import { ShopLayout } from '@/components/ShopLayout'
import { MovedNotice } from '@/components/shop/MovedNotice'

export const metadata = { title: 'Audit Log — Alan Cafe OS' }

// The old audit-log screen is hidden until it works (2026-11-11); its code is in git history.
export default function AuditLogPage() {
  return (
    <ShopLayout>
      <MovedNotice
        title="ยังไม่เปิดใช้งาน"
        reason="หน้าบันทึกการแก้ไข (Audit Log) ยังไม่พร้อมใช้ ปิดไว้ก่อน ประวัติการเข้าใช้ของบัญชีคุณดูได้ที่ บัญชีของฉัน → กิจกรรม"
        links={[{ href: '/account/activity', label: 'กิจกรรมของบัญชี' }]}
      />
    </ShopLayout>
  )
}
