import { PaymentMethodsSection } from '@/components/shop/PaymentMethodsSection'

export const metadata = { title: 'Payment Methods — Alan Cafe OS' }

export default function PaymentSettingsPage() {
  return (
    <>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 6 }}>วิธีชำระเงิน</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>เลือกวิธีชำระเงินที่รับในร้าน</div>
      </div>
      <PaymentMethodsSection />
    </>
  )
}
