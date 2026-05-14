import { AuthGuard } from '@/components/AuthGuard'
import { ImportClient } from './ImportClient'

export const metadata = { title: 'Bulk Import — Alan Cafe OS' }

export default function ImportPage() {
  return <AuthGuard><ImportClient /></AuthGuard>
}
