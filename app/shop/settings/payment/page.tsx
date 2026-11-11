import { MovedNotice } from '@/components/shop/MovedNotice'

export const metadata = { title: 'Payment Methods — Alan Cafe OS' }

export default function Page() {
  return (
    <MovedNotice
      title="การรับเงิน"
      reason="QR Code ชำระเงินและบัญชีธนาคารรับโอนที่หน้าขายใช้จริง ตั้งได้ที่หน้า ตั้งค่าร้าน"
      links={[{ href: '/cafe?tab=settings', label: 'ตั้งค่าร้าน' }]}
    />
  )
}
