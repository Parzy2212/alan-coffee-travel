import { ShopIdentitySection } from '@/components/shop/ShopIdentitySection'
import { ContactSection } from '@/components/shop/ContactSection'
import { BusinessSection } from '@/components/shop/BusinessSection'
import { OperatingHoursSection } from '@/components/shop/OperatingHoursSection'

export const metadata = { title: 'Shop Settings — Alan Cafe OS' }

export default function ShopSettingsPage() {
  return (
    <>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 6 }}>ตั้งค่าร้าน</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>ข้อมูลทั่วไปของร้านคุณ</div>
      </div>
      <ShopIdentitySection />
      <ContactSection />
      <BusinessSection />
      <OperatingHoursSection />
    </>
  )
}
