import { ShopLayout } from '@/components/ShopLayout'
import { MovedNotice } from '@/components/shop/MovedNotice'

export const metadata = { title: 'Billing — Alan Cafe OS' }

export default function BillingPage() {
  return (
    <ShopLayout>
      <MovedNotice
        title="ยังไม่เปิดใช้งาน"
        reason="หน้าค่าบริการยังไม่พร้อมใช้ ปิดไว้ก่อน"
        links={[{ href: '/cafe?tab=dashboard', label: 'กลับหน้าภาพรวม' }]}
      />
    </ShopLayout>
  )
}
