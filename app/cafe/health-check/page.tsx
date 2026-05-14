import { AuthGuard } from '@/components/AuthGuard'
import { HealthCheckClient } from './HealthCheckClient'

export const metadata = { title: 'Health Check — Alan Cafe OS' }

export default function HealthCheckPage() {
  return <AuthGuard><HealthCheckClient /></AuthGuard>
}
