import { MovedNotice } from '@/components/shop/MovedNotice'

export const metadata = { title: 'Shop Settings — Alan Cafe OS' }

export default function Page() {
  return (
    <MovedNotice
      title="ตั้งค่าร้านรวมอยู่ที่เดียวแล้ว"
      reason="ชื่อร้าน ที่อยู่ ใบเสร็จ VAT การรับเงิน จอคิว และอัตราแลกเปลี่ยน ตั้งได้ที่หน้า ตั้งค่าร้าน หน้าเดียว"
      links={[{ href: '/cafe?tab=settings', label: 'ตั้งค่าร้าน' }]}
    />
  )
}
