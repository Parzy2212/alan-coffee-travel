import type { Metadata } from 'next'
import GuidesClient from './GuidesClient'

export const metadata: Metadata = {
  alternates: {
    canonical: 'https://alancoffeetravel.com/guides',
  },
}

export default function GuidesPage() {
  return <GuidesClient />
}
