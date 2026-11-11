import { MovedNotice } from '@/components/shop/MovedNotice'

export const metadata = { title: 'Shop Settings — Alan Cafe OS' }

export default function ShopSettingsPage() {
  return (
    <MovedNotice
      title="ข้อมูลร้าน"
      reason="ชื่อร้าน ที่อยู่ และเบอร์โทรที่ขึ้นบนใบเสร็จ ตั้งได้ที่ ข้อมูลร้าน & การรับเงิน หรือ ใบเสร็จ (ใช้ค่าชุดเดียวกัน) ข้อความท้ายบิลและ VAT ตั้งที่ ใบเสร็จ"
      links={[
        { href: '/cafe?tab=settings', label: 'ข้อมูลร้าน & การรับเงิน' },
        { href: '/shop/settings/receipt', label: 'ใบเสร็จ' },
      ]}
    />
  )
}
