import { AccountLayout } from '@/components/AccountLayout'
import { ProfileSection } from '@/components/account/ProfileSection'

export const metadata = { title: 'Profile — Alan Cafe OS' }

export default function ProfilePage() {
  return (
    <AccountLayout>
      <ProfileSection />
    </AccountLayout>
  )
}
