import { AuthGuard } from '@/components/AuthGuard'
import { TemplatesClient } from './TemplatesClient'

export const metadata = { title: 'Template เริ่มต้น — Alan Cafe OS' }

export default function TemplatesPage() {
  return <AuthGuard><TemplatesClient /></AuthGuard>
}
