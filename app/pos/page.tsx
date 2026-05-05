import type { Metadata } from 'next'
import { AuthGuard } from '@/components/AuthGuard'
import POSClient from './POSClient'

export const metadata: Metadata = {
  title: 'POS | Alan Cafe OS',
  robots: { index: false, follow: false },
}

export default function POSPage() {
  return (
    <AuthGuard>
      <POSClient />
    </AuthGuard>
  )
}
