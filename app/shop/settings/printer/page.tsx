import { MovedNotice } from '@/components/shop/MovedNotice'

export const metadata = { title: 'Printer Settings — Alan Cafe OS' }

export default function PrinterSettingsPage() {
  return (
    <MovedNotice
      title="เครื่องพิมพ์ใบเสร็จ"
      reason="ตั้งค่าเครื่องพิมพ์แยกที่เครื่อง POS แต่ละเครื่อง: เปิดหน้าขาย → ⚙️ POS Settings → เครื่องพิมพ์ใบเสร็จ (ทดสอบพิมพ์ เปิด/ปิดพิมพ์อัตโนมัติ ขนาดกระดาษ)"
      links={[{ href: '/pos', label: 'ไปหน้าขาย' }]}
    />
  )
}
