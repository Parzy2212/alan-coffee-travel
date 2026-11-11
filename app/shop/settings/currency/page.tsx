import { MovedNotice } from '@/components/shop/MovedNotice'

export const metadata = { title: 'Currency — Alan Cafe OS' }

export default function Page() {
  return (
    <MovedNotice
      title="สกุลเงิน"
      reason="อัตราแลกเปลี่ยนย้ายไปอยู่ในหน้า ตั้งค่าร้าน → ตั้งค่าเฉพาะเครื่องนี้ (เก็บแยกในแต่ละเครื่อง ให้ตั้งบนเครื่อง POS ที่ใช้ขาย)"
      links={[{ href: '/cafe?tab=settings', label: 'ตั้งค่าร้าน' }]}
    />
  )
}
