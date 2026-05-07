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
      <TwoFASection />
      <SessionsSection />
      <ActivitySection />
      <DangerZone />
    </AccountLayout>
  )
}

function TwoFASection() {
  return (
    <div style={{
      backgroundColor: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: 24, marginBottom: 24,
      opacity: 0.7,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 28, flexShrink: 0 }}>🛡️</div>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
              การยืนยันสองชั้น (2FA)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>เพิ่มความปลอดภัยให้บัญชีของคุณ</div>
              <span style={{ padding: '2px 8px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 600 }}>
                ยังไม่เปิดใช้งาน
              </span>
            </div>
          </div>
        </div>
        <div title="เร็วๆ นี้" style={{ padding: '9px 18px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'rgba(255,255,255,0.25)', fontSize: 13, fontWeight: 600, cursor: 'not-allowed' }}>
          เปิดใช้งาน — เร็วๆ นี้
        </div>
      </div>
    </div>
  )
}
