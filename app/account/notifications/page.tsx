import { AccountLayout } from '@/components/AccountLayout'
import { MovedNotice } from '@/components/shop/MovedNotice'

export const metadata = { title: 'Notifications — Alan Cafe OS' }

// Email/Telegram notifications never sent anything; hidden until they do (2026-11-11). Old code is in git history.
export default function NotificationsPage() {
  return (
    <AccountLayout>
      <MovedNotice
        title="ยังไม่เปิดใช้งาน"
        reason="การแจ้งเตือนทางอีเมลและ Telegram ยังส่งจริงไม่ได้ ปิดไว้ก่อน"
        links={[{ href: '/account/profile', label: 'กลับหน้าโปรไฟล์' }]}
      />
    </AccountLayout>
  )
}
