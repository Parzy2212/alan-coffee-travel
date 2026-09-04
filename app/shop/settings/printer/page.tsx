import { PrinterSection } from '@/components/shop/PrinterSection'

export const metadata = { title: 'Printer Settings — Alan Cafe OS' }

export default function PrinterSettingsPage() {
  return (
    <>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 6 }}>ตั้งค่าเครื่องพิมพ์</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>เชื่อมต่อและทดสอบเครื่องพิมพ์ใบเสร็จ</div>
      </div>
      <PrinterSection />
    </>
  )
}
