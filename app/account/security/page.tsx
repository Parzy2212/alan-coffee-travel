import { AccountLayout } from '@/components/AccountLayout'
import { PasswordSection } from '@/components/account/PasswordSection'
import { SessionsSection } from '@/components/account/SessionsSection'
import { ActivitySection } from '@/components/account/ActivitySection'
import { DangerZone } from '@/components/account/DangerZone'

export const metadata = { title: 'Security — Alan Cafe OS' }

export default function SecurityPage() {
  return (
    <AccountLayout>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: 'white', fontWeight: 800, fontSize: 22, fontFamily: 'var(--font-heading)', marginBottom: 4 }}>
          ความปลอดภัย
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>จัดการรหัสผ่าน เซสชัน และความปลอดภัยของบัญชี</p>
      </div>

      <PasswordSection />
      <SessionsSection />
      <ActivitySection />
      <DangerZone />
    </AccountLayout>
  )
}
