import { AuthGuard } from '@/components/AuthGuard'
import StaffClient from './StaffClient'

export const metadata = { title: 'Staff — Alan Cafe OS' }

export default function StaffPage() {
  return (
    <AuthGuard>
      <StaffClient />
    </AuthGuard>
  )
}
