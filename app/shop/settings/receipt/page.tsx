import { MovedNotice } from '@/components/shop/MovedNotice'

export const metadata = { title: 'Receipt Settings — Alan Cafe OS' }

export default function Page() {
  return (
    <MovedNotice
      title="ใบเสร็จ"
      reason="ข้อมูลบนใบเสร็จ (ชื่อร้าน ที่อยู่ เบอร์โทร ข้อความท้ายบิล VAT) ย้ายไปอยู่ในหน้า ตั้งค่าร้าน แล้ว"
      links={[{ href: '/cafe?tab=settings', label: 'ตั้งค่าร้าน' }]}
    />
  )
}
