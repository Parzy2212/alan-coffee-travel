import { AuthGuard } from '@/components/AuthGuard'
import { OwnerClient } from './OwnerClient'

export const metadata = { title: 'Owner Dashboard — Alan Cafe OS' }

export default function OwnerPage() {
  return (
    <AuthGuard>
      <OwnerClient />
    </AuthGuard>
  )
}
