import { AuthGuard } from '@/components/AuthGuard'
import { SessionBadge } from '@/components/SessionBadge'
import CafeClient from './CafeClient'

export const metadata = { title: 'Dashboard — Alan Cafe OS' }

export default function CafePage() {
  return (
    <AuthGuard>
      <CafeClient />
      <SessionBadge />
    </AuthGuard>
  )
}
