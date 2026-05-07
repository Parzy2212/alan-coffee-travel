import { ShopLayout } from '@/components/ShopLayout'

export const metadata = { title: 'Billing — Alan Cafe OS' }

export default function BillingPage() {
  return (
    <ShopLayout>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 20 }}>💰</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 10 }}>ค่าบริการ</div>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', maxWidth: 360, lineHeight: 1.7, marginBottom: 28 }}>
          ระบบจัดการค่าบริการและแผนการสมัครสมาชิกกำลังพัฒนาอยู่
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', backgroundColor: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 20 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#c9a84c', display: 'inline-block' }} />
          <span style={{ color: '#c9a84c', fontSize: 13, fontWeight: 600 }}>เร็วๆ นี้</span>
        </div>
      </div>
    </ShopLayout>
  )
}
