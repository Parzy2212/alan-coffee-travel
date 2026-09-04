import { ReceiptSection } from '@/components/shop/ReceiptSection'

export const metadata = { title: 'Receipt Settings — Alan Cafe OS' }

export default function ReceiptSettingsPage() {
  return (
    <>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 6 }}>ตั้งค่าใบเสร็จ</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>ปรับแต่งข้อมูลที่แสดงในใบเสร็จ</div>
      </div>
      <ReceiptSection />
    </>
  )
}
