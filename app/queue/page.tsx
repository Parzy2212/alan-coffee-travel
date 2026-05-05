import { AuthGuard } from '@/components/AuthGuard'
import QueueClient from './QueueClient'

export const metadata = { title: 'Queue Display — Alan Coffee' }

export default function QueuePage() {
  return (
    <AuthGuard>
      <QueueClient />
    </AuthGuard>
  )
}
