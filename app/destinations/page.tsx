import type { Metadata } from 'next'
import DestinationsClient from './DestinationsClient'

export const metadata: Metadata = {
  alternates: {
    canonical: 'https://alancoffeetravel.com/destinations',
  },
}

export default function DestinationsPage() {
  return <DestinationsClient />
}
