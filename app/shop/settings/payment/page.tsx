import { MovedNotice } from '@/components/shop/MovedNotice'

export const metadata = { title: 'Payment Methods — Alan Cafe OS' }

export default function PaymentSettingsPage() {
  return (
    <MovedNotice
      title="การรับเงิน"
      reason="QR Code ชำระเงินและบัญชีธนาคารรับโอนที่หน้าขายใช้จริง ตั้งได้ที่ ข้อมูลร้าน & การรับเงิน"
      links={[{ href: '/cafe?tab=settings', label: 'ข้อมูลร้าน & การรับเงิน' }]}
    />
  )
}
